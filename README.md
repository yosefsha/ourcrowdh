# Press Mentions Monitoring

Tracks press coverage of OurCrowd's portfolio and fund companies. Each day the system:

1. collects news Articles for every company on the Company List,
2. uses a **local Ollama model** to decide whether each Mention is really about that company and whether it is positive, negative or neutral,
3. sends an Alert listing the day's New Mentions.

A dashboard shows every company's **Mention Status** (e.g. "last mentioned 3 days ago" or "no coverage found") and its coverage over the last **Quarter**, with a link to each source article.

The brief is in [`docs/TASKS.md`](docs/TASKS.md).

> **Status: work in progress.** The scaffolding, the container setup and the shared contracts are on `main`. The pipeline features (news collection, classification, alerts, dashboard pages) are being built. See [Project status](#project-status).

## Documentation map

| Document | What it holds |
|---|---|
| [`CONTEXT.md`](CONTEXT.md) | Domain glossary: Tracked Company, Article, Mention, Sentiment, Run, Alert… Code and docs use these terms. |
| [`docs/PLAN.md`](docs/PLAN.md) | Implementation contract: decisions, configuration, entities and flow, Run pipeline, schema, ports, HTTP API, file ownership. |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records (listed below). |
| [`docs/coding-instructions.md`](docs/coding-instructions.md), [`docs/backend-nestjs-instructions.md`](docs/backend-nestjs-instructions.md) | Coding standards for the repo, the frontend and the backend. |
| [`CLAUDE.md`](CLAUDE.md) | Instructions for AI coding agents, including the branch → PR → review workflow each issue follows. |

### Architecture Decision Records

| ADR | Decision |
|---|---|
| [ADR-0001](docs/adr/0001-backend-esm-nestjs-12.md) | The backend runs as native ESM on NestJS 12, which is published ESM-only, rather than pinning NestJS 11 on CommonJS. |

## Architecture

| Part | Technology |
|---|---|
| Backend and data collection | NestJS 12 (TypeScript, ESM), TypeORM |
| Database | PostgreSQL 16 |
| Frontend | React + TypeScript + Vite, TanStack React Query, React Router |
| LLM | Ollama, running locally (default model `qwen2.5:7b`, to be confirmed by evaluation) |
| News source | Google News RSS search: free, no API key ([why, and its limits](docs/PLAN.md#decisions)) |
| Packaging | One Docker image. NestJS serves the API under `/api` and the built SPA, and `GET /health` is the health check. |

External services (the News Source, the Ollama classifier and the Notifier) sit behind port interfaces, so any of them can be replaced without touching the code that uses them. See [`docs/PLAN.md#ports`](docs/PLAN.md#ports) and [`#news-source-isolation`](docs/PLAN.md#news-source-isolation). The entities and the Run flow are in [`docs/PLAN.md#entities-and-flow`](docs/PLAN.md#entities-and-flow).

```
backend/     NestJS service: API, Run pipeline, CLI (dist/cli.js), migrations
frontend/    React SPA, built into the app image and served by NestJS
docs/        brief, plan, ADRs, coding standards, Company List
Dockerfile   multi-stage: frontend build → backend build → runtime
docker-compose.yml   postgres → migrate (one-shot) → app; optional `ollama` profile
```

## Running locally

### Prerequisites

- Docker Desktop
- Node.js 22+ (only to work outside Docker)
- Ollama, running on the host, **once classification lands**. Starting the app doesn't need it.
  ```bash
  brew install ollama && brew services start ollama
  ollama pull qwen2.5:7b
  ```
  Or run Ollama in a container instead: `OLLAMA_URL=http://ollama:11434 docker compose --profile ollama up --build`.

### With Docker (the whole stack)

```bash
docker compose up --build
```

Then open <http://localhost:8000>. `GET /health` returns `{"status":"ok"}`. Postgres is reachable only on the compose network; it isn't published to the host. Stop with `docker compose down`, or add `-v` to also delete the database volume.

### Without Docker (development)

```bash
npm run setup          # install the root, backend and frontend packages
npm run dev            # Nest in watch mode on :8000 + Vite on :5173 (proxies /api)
npm run lint && npm run type-check && npm test
```

The backend expects Postgres at `postgresql://app:app@localhost:5432/app` unless you set `DATABASE_URL`. All settings are listed in [`docs/PLAN.md#configuration`](docs/PLAN.md#configuration).

## Project status

Work is tracked as GitHub issues grouped into milestones. Each issue is built on its own branch and worktree, and reviewed before it's merged.

| Milestone | Scope | State |
|---|---|---|
| M1 Scaffold | backend and frontend skeletons, test toolchains | ✅ done |
| M2 Contracts & runtime | schema, ports, fakes, modules, CLI shell; Docker, compose and CI | ✅ done |
| M3 Features | seeding, Google News source, Ollama classifier, notifier, Run pipeline, dashboard API, export, dashboard and company pages | in progress |
| M4 Validate & deliver | classification evaluation, end-to-end smoke test, real run → `data/`, final README | planned |

Sections still to come with M3 and M4, tracked in issue #17: the Ollama prompt and output format, how classification quality was validated, the limits of the News Source, the `data/` output of a real run, the AWS deployment design, and the AI-assistant prompts used to build the project.
