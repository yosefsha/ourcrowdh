# Implementation Plan — Press Mentions Monitoring

The brief is `docs/TASKS.md` and the vocabulary is in `CONTEXT.md`. This file is the
**shared contract** that lets the GitHub issues be built in parallel: every issue
codes against the ports, schema and API shapes defined here, and touches only
the files its row in [File ownership](#file-ownership) gives it. A change to
anything in this file is a change to the contract — make it in its own PR first,
never inside a feature PR.

## Decisions

| Area | Decision |
|---|---|
| Backend | NestJS (TypeScript, strict), TypeORM, PostgreSQL 16 |
| Frontend | React + TypeScript + Vite, TanStack React Query, React Router, Recharts, inline styles |
| Serving | NestJS serves the built SPA (`@nestjs/serve-static`); API under `/api/*`; `GET /health` at the root |
| Redis | **Not used.** Removed from compose, CI and the backend instructions |
| Packaging | One root multi-stage `Dockerfile` (frontend build → backend build → runtime); root `package.json` wraps both builds |
| Local run | `docker compose up --build` → `postgres` → `migrate` (migrations + seed) → `app` on :8000 |
| Ollama | Host Ollama by default (`OLLAMA_URL=http://host.docker.internal:11434`); containerised Ollama behind `--profile ollama` |
| Model | Default `qwen2.5:7b`; final choice made by the classification eval (#14) |
| News source | Google News RSS search, behind the `NewsSource` port. Headline + outlet only, no article body |
| Classification | One Ollama call per Mention returns relevance **and** sentiment, as structured JSON output |
| Scheduling | One entry point, `cli run`. Locally triggered by `@nestjs/schedule` when `SCHEDULER_ENABLED=true`; in AWS by EventBridge (README only) |
| Seeding | `cli seed` upserts the company list; compose's `migrate` service runs it on every `up`. A Run reads Tracked Companies, it never seeds |
| Concurrency | A Run holds a Postgres advisory lock; a second concurrent Run fails fast |
| Alerts | `Notifier` port; console implementation only |
| Quarter | Trailing 90 days ending now |
| Cloud | README section only; CDK considered after everything works locally |
| Testing | Backend: Jest + Supertest (unit with fakes, e2e against real Postgres). Frontend: Vitest + React Testing Library + MSW. Full stack: one Playwright smoke test. LLM quality: labelled gold set + eval script |

## Configuration

Read only through `ConfigService`; validated at boot. `GOOGLE_NEWS_*` belong to the adapter: declared and validated in `news/google-news-rss/google-news-rss.config.ts`, not in the global schema.

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8000` | |
| `DATABASE_URL` | `postgresql://app:app@localhost:5432/app` | |
| `STATIC_DIR` | `../frontend/dist` (resolved from `backend/`) | `/app/public` in the image |
| `OLLAMA_URL` | `http://localhost:11434` | compose sets `http://host.docker.internal:11434` |
| `OLLAMA_MODEL` | `qwen2.5:7b` | |
| `COMPANIES_FILE` | `seed/companies.txt` (resolved from `backend/`) | |
| `SCHEDULER_ENABLED` | `false` | compose sets `true` |
| `RUN_CRON` | `0 6 * * *` | UTC |
| `BACKFILL_DAYS` | `90` | window of the first Run |
| `ALERT_WINDOW_HOURS` | `48` | a New Mention must be published within this window |
| `GOOGLE_NEWS_REQUEST_DELAY_MS` | `1500` | politeness delay between Google News requests |
| `GOOGLE_NEWS_LOCALE` | `hl=en-US&gl=US&ceid=US:en` | edition queried |

## Entities and flow

Terms are defined in `CONTEXT.md`. Four entities are stored; everything else is derived at read time.

| Entity | Table | Created by | Changed by |
|---|---|---|---|
| Tracked Company | `companies` | `cli seed` (upsert on `slug`) | `cli seed` when the Company List changes |
| Article | `articles` | Run, collect step (upsert on `url`) | — |
| Mention | `mentions` | Run, collect step — `pending` (upsert on article + company) | Run, classify step — `classified` or `failed` (retried next Run) |
| Run | `runs` | Run start — `running` | Run end — `succeeded` / `failed` with counts |

| Derived | From |
|---|---|
| Relevant Mention | `mentions.relevant = true` (implies `classified`) |
| Mention Status | newest `articles.published_at` over a company's Relevant Mentions, banded per the HTTP API |
| Quarter counts | Relevant Mentions published in the trailing 90 days, per Sentiment |
| New Mentions / Alert | Relevant Mentions with `first_seen_run_id` = this Run and published within `ALERT_WINDOW_HOURS` |

```
 Company List ──cli seed──▶ Tracked Company
                                  │
 Run ─────────────────────────────┤ collect: NewsSource.fetchArticles(company, window)
                                  ▼
                              Article ──┬──▶ Mention [pending]
                     Tracked Company ───┘          │ classify: MentionClassifier.classify
                                                   ▼
                                    Mention [classified | failed]
                                                   │
          ┌────────────────────────────────────────┼─────────────────────────────┐
          ▼                                        ▼                             ▼
   New Mentions → Notifier.notify(Alert)   Dashboard read model          Export read model → data/
   (end of the Run)                        (Mention Status, Quarter)     (CSV, JSON, summary)
```

Writes happen only in `cli seed` and the Run. The dashboard and export only read.

## Run pipeline

```
cli run | POST /api/runs | cron
  1. acquire pg advisory lock ............ else RunAlreadyInProgressError (409 over HTTP)
  2. classifier.assertReady() ............ Ollama unreachable / model not pulled → Run fails, message names the fix
  3. for each Tracked Company:
       window = (last successful Run start − 2 days) … now   |  first Run: now − BACKFILL_DAYS … now
       newsSource.fetchArticles(query, window)            (adapter bisects windows that hit the 100-item cap)
       mentionWriter.recordDiscovered(...)                (idempotent on article URL + company)
  4. for each pending Mention: classifier.classify(...) → mentionWriter.saveClassification(...)
       item failure (bad JSON after retries) → classification failed, counted, retried next Run
  5. newMentions = relevant Mentions first seen in this Run and published within ALERT_WINDOW_HOURS
     notifier.notify(alert)  — always, an empty Alert prints "no new mentions"
  6. finish Run with counts; release lock
```

## Data model (initial migration)

```
companies   id uuid pk · slug text unique · name text · former_names text[] · disambiguator text null
            · created_at · updated_at
articles    id uuid pk · url text unique · title text · outlet text · source text · published_at timestamptz · first_seen_at timestamptz
runs        id uuid pk · trigger enum(schedule,manual,cli) · status enum(running,succeeded,failed)
            · started_at · finished_at null · articles_fetched int · mentions_discovered int
            · mentions_classified int · classification_failures int · new_mentions int · error text null
mentions    id uuid pk · article_id fk · company_id fk · unique(article_id, company_id)
            · first_seen_run_id fk runs · classification_status enum(pending,classified,failed)
            · relevant bool null · sentiment enum(positive,negative,neutral) null
            · confidence real null · rationale text null · model text null · classified_at null
            CHECK classified  ⇔ relevant IS NOT NULL
            CHECK relevant = true ⇔ sentiment IS NOT NULL
            index (company_id, published_at via article) for status/quarter queries
```

## Ports

Each port file exports the interface, an injection token and its domain errors.
In-memory fakes live next to the port as `in-memory-<name>.ts` and are used by every
unit test that needs the port.

```ts
// companies/company.ts
export interface TrackedCompany {
  readonly id: string; readonly slug: string; readonly name: string;
  readonly formerNames: readonly string[]; readonly disambiguator: string | null;
}
export interface SeedEntry { readonly slug: string; readonly name: string;
  readonly formerNames: readonly string[]; readonly disambiguator: string | null; }

// companies/company.repository.ts            token COMPANY_REPOSITORY
export interface CompanyRepository {
  upsertAll(entries: readonly SeedEntry[]): Promise<void>;
  findAll(): Promise<readonly TrackedCompany[]>;
}

// news/news-source.ts                        token NEWS_SOURCE
export interface DateWindow { readonly from: Date; readonly to: Date; }
export interface FetchedArticle { readonly url: string; readonly title: string;
  readonly outlet: string; readonly publishedAt: Date;
  readonly source: string; }                            // provenance, e.g. 'google-news-rss'
export interface NewsSource {
  fetchArticles(company: TrackedCompany, window: DateWindow): Promise<readonly FetchedArticle[]>;
}
export class NewsSourceError extends Error {}           // transport / parse failure after retries

// classification/mention-classifier.ts      token MENTION_CLASSIFIER
export type Sentiment = 'positive' | 'negative' | 'neutral';
export interface ClassificationInput { readonly company: TrackedCompany;
  readonly title: string; readonly outlet: string; }
export type Classification =
  | { readonly relevant: false; readonly rationale: string; readonly model: string }
  | { readonly relevant: true; readonly sentiment: Sentiment; readonly confidence: number;
      readonly rationale: string; readonly model: string };
export interface MentionClassifier {
  assertReady(): Promise<void>;                          // throws ClassifierUnavailableError
  classify(input: ClassificationInput): Promise<Classification>; // throws ClassificationFailedError
}

// alerts/notifier.ts                         token NOTIFIER
export interface NewMention { readonly companyName: string; readonly title: string;
  readonly url: string; readonly outlet: string; readonly publishedAt: Date;
  readonly sentiment: Sentiment; }
export interface Alert { readonly runId: string; readonly generatedAt: Date;
  readonly mentions: readonly NewMention[]; }
export interface Notifier { notify(alert: Alert): Promise<void>; }

// mentions/mention-writer.ts                 token MENTION_WRITER   (write side, used by the Run)
export interface PendingMention { readonly id: string; readonly company: TrackedCompany;
  readonly title: string; readonly outlet: string; }
export interface MentionWriter {
  recordDiscovered(runId: string, companyId: string, articles: readonly FetchedArticle[]): Promise<number>; // count of new Mentions
  findPending(): Promise<readonly PendingMention[]>;    // pending + previously failed
  saveClassification(mentionId: string, result: Classification): Promise<void>;
  markFailed(mentionId: string, reason: string): Promise<void>;
  findNewMentions(runId: string, publishedSince: Date): Promise<readonly NewMention[]>;
}

// runs/run.repository.ts                     token RUN_REPOSITORY
export type RunTrigger = 'schedule' | 'manual' | 'cli';
export interface RunRepository {
  withLock<T>(work: () => Promise<T>): Promise<T>;      // throws RunAlreadyInProgressError
  start(trigger: RunTrigger): Promise<RunRecord>;
  lastSuccessfulStart(): Promise<Date | null>;
  finish(id: string, counts: RunCounts): Promise<void>;
  fail(id: string, error: string, counts: RunCounts): Promise<void>;
  list(limit: number): Promise<readonly RunRecord[]>;
}
```

The dashboard and the export read through their **own** read ports
(`dashboard/dashboard-read-model.ts`, `export/export-read-model.ts`), so the read
side never waits on the write side.

## News Source isolation

Collection is a **port + adapter** (a Gateway, in Fowler's terms — not a Repository:
a Repository models a persisted collection the domain writes to; a News Source is a
read-only external service). Everything Google-specific stays inside
`news/google-news-rss/`; nothing outside `news/` imports from it.

```
news/
  news-source.ts                 port: NewsSource, NEWS_SOURCE token, DateWindow, FetchedArticle, NewsSourceError
  in-memory-news-source.ts       fake for tests
  news-source.contract.ts        shared spec suite every implementation must pass
  news.module.ts                 the ONE line choosing the implementation
  google-news-rss/
    google-news-rss.source.ts    implements NewsSource; composes the pieces below
    query-builder.ts             pure: company + window → Google query string
    search-overrides.ts          context terms for colliding names
    rss-parser.ts                pure: RSS XML → FetchedArticle[]
    rss-http-client.ts           fetch + politeness delay + retry/backoff → NewsSourceError
    window-bisector.ts           splits windows that hit Google's 100-item cap
    google-news-rss.config.ts    GOOGLE_NEWS_* settings, registered with ConfigModule
```

Rules that keep the adapter replaceable:
- The port speaks only domain types. No query syntax, item caps, XML or HTTP status leaks out.
- Source quirks (100-item cap, `after:`/`before:` operators, redirect links) are handled inside the adapter.
- Every implementation passes `news-source.contract.ts`: results inside the window, de-duplicated by URL, `source` set, failures surface only as `NewsSourceError`.
- Replacing the source = a new folder + one line in `news.module.ts`. Running two sources at once = a `CompositeNewsSource` implementing the same port (fan out, merge, de-duplicate). Neither is built now.

## HTTP API

Frontend mirrors these in `frontend/src/types.ts`. All dates are ISO-8601 strings.

```ts
type Sentiment = 'positive' | 'negative' | 'neutral';
type StatusBand = 'fresh' | 'recent' | 'quiet' | 'dormant' | 'none'; // ≤7d, ≤30d, ≤90d, >90d, never

interface MentionStatusDto { lastMentionedAt: string | null; daysSinceLastMention: number | null; band: StatusBand; }
interface SentimentCountsDto { total: number; positive: number; negative: number; neutral: number; }
interface CompanySummaryDto { slug: string; name: string; formerNames: string[];
  status: MentionStatusDto; quarter: SentimentCountsDto; }
interface QuarterDto { from: string; to: string; }
interface MentionDto { id: string; title: string; url: string; outlet: string; publishedAt: string;
  sentiment: Sentiment; confidence: number; rationale: string; }
interface RunDto { id: string; trigger: 'schedule' | 'manual' | 'cli'; status: 'running' | 'succeeded' | 'failed';
  startedAt: string; finishedAt: string | null; articlesFetched: number; mentionsDiscovered: number;
  mentionsClassified: number; classificationFailures: number; newMentions: number; error: string | null; }
```

| Method | Path | Response |
|---|---|---|
| GET | `/api/companies` | `{ quarter: QuarterDto; companies: CompanySummaryDto[] }` |
| GET | `/api/companies/:slug` | `{ quarter: QuarterDto; company: CompanySummaryDto; mentions: MentionDto[] }` — 404 unknown slug |
| GET | `/api/runs?limit=10` | `{ runs: RunDto[] }` — `limit` 1–50 |
| POST | `/api/runs` | 202 `RunDto` (started in the background) — 409 while a Run holds the lock |
| GET | `/health` | 200 `{ status: 'ok' }` |

Only relevant, classified Mentions are counted, listed or used for Mention Status.

## File ownership

`backend/src/` unless stated. "Skeleton" means the issue creates the file with its
final public shape; the owning feature issue fills in behaviour without changing
that shape.

| Path | Created by | Then owned by |
|---|---|---|
| `main.ts`, `app.module.ts`, `config/`, `health/`, `database/` | Backend scaffold | Contracts (registers modules once) |
| `migrations/<initial>` | Contracts | — (later changes add new migration files) |
| `companies/` port, entity, fake, module | Contracts | Seed loader |
| `news/` port, fake, module | Contracts | News source |
| `classification/` port, fake, module | Contracts | Ollama classifier |
| `alerts/` port, fake, module | Contracts | Console notifier |
| `mentions/` port, entities, fake, module | Contracts | Run orchestrator |
| `runs/` port, entity, fake, module | Contracts | Run orchestrator |
| `dashboard/` module | Contracts | Dashboard API |
| `export/` module | Contracts | Export |
| `cli.ts`, `cli.module.ts` | Contracts | (commands live in their own modules) |
| `frontend/` scaffold, `types.ts`, `api/`, MSW handlers | Frontend scaffold | — |
| `frontend/src/pages/DashboardPage.tsx` + its components | Frontend scaffold (route stub) | Dashboard page |
| `frontend/src/pages/CompanyPage.tsx` + its components | Frontend scaffold (route stub) | Company page |
| root `package.json`, `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml` (images job; backend job's Redis removal is in the backend scaffold), `docs/*-instructions.md` | Container & CI | — |
| `eval/` | Classification eval | — |
| `e2e/` (Playwright) | Smoke test | — |
| `data/` | Real run | — |
| `README.md`, `docs/ai-prompts/` | README | — |

## Waves

```
M1 Scaffold          backend scaffold ─┐        frontend scaffold ─┐
                                        │                           │
M2 Contracts         contracts ◀────────┘   container & CI ◀────────┴── (needs both scaffolds)
                         │
M3 Features          seed · news source · ollama classifier · notifier · run orchestrator
  (all parallel)     dashboard API · export                     dashboard page · company page
                         │                                              (frontend: needs scaffold only)
M4 Validate/Deliver  classification eval (needs classifier) · Playwright smoke · real run → data/ · README
```

Each issue lists its blockers. Anything whose blockers are closed can start in a
separate worktree.
