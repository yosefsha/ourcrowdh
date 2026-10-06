import { InMemoryNotifier } from '../alerts/in-memory-notifier.js';
import { Notifier } from '../alerts/notifier.js';
import { InMemoryMentionClassifier } from '../classification/in-memory-mention-classifier.js';
import {
  Classification,
  ClassifierUnavailableError,
} from '../classification/mention-classifier.js';
import { SeedEntry, TrackedCompany } from '../companies/company.js';
import { InMemoryCompanyRepository } from '../companies/in-memory-company.repository.js';
import { InMemoryMentionWriter } from '../mentions/in-memory-mention-writer.js';
import { DateWindow, FetchedArticle, NewsSource, NewsSourceError } from '../news/news-source.js';
import { InMemoryRunRepository } from './in-memory-run.repository.js';
import { RunService } from './run.service.js';

const BACKFILL_DAYS = 10;
const ALERT_WINDOW_HOURS = 48;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function companySpec(overrides: Partial<SeedEntry> = {}): SeedEntry {
  return {
    slug: overrides.slug ?? 'acme',
    name: overrides.name ?? 'Acme Corp',
    formerNames: overrides.formerNames ?? [],
    disambiguator: overrides.disambiguator ?? null,
  };
}

/** Seeds the given companies and reads them back with their real (repository-assigned) ids. */
async function seedCompanies(
  companyRepository: InMemoryCompanyRepository,
  specs: readonly SeedEntry[],
): Promise<readonly TrackedCompany[]> {
  await companyRepository.upsertAll(specs);
  const all = await companyRepository.findAll();
  return specs.map((spec) => {
    const seeded = all.find((company) => company.slug === spec.slug);
    if (!seeded) {
      throw new Error(`seedCompanies: "${spec.slug}" was not seeded`);
    }
    return seeded;
  });
}

function article(overrides: Partial<FetchedArticle> = {}): FetchedArticle {
  return {
    url: overrides.url ?? 'https://example.com/acme-raises',
    title: overrides.title ?? 'Acme raises $10M',
    outlet: overrides.outlet ?? 'Example Times',
    publishedAt: overrides.publishedAt ?? new Date(),
    source: overrides.source ?? 'google-news-rss',
  };
}

const relevant = (sentiment: 'positive' | 'negative' | 'neutral' = 'positive'): Classification => ({
  relevant: true,
  sentiment,
  confidence: 0.9,
  rationale: 'Clearly about the company',
  model: 'fake-model',
});

const notRelevant: Classification = {
  relevant: false,
  rationale: 'Name collision',
  model: 'fake-model',
};

const noArticles: NewsSource = {
  async fetchArticles(): Promise<readonly FetchedArticle[]> {
    return Promise.resolve([]);
  },
};

/**
 * A `NewsSource` that scripts a different result per company slug — the
 * shared `InMemoryNewsSource` fake answers every company the same way,
 * which cannot model "one company's fetch fails, another's succeeds".
 */
class PerCompanyNewsSource implements NewsSource {
  constructor(
    private readonly byCompanySlug: ReadonlyMap<
      string,
      readonly FetchedArticle[] | NewsSourceError
    >,
  ) {}

  async fetchArticles(
    company: TrackedCompany,
    window: DateWindow,
  ): Promise<readonly FetchedArticle[]> {
    const result = this.byCompanySlug.get(company.slug) ?? [];
    if (result instanceof NewsSourceError) {
      throw result;
    }
    return Promise.resolve(
      result.filter((a) => a.publishedAt >= window.from && a.publishedAt <= window.to),
    );
  }
}

/** Throws from `markAlerted` — the coordinator's at-least-once-delivery scenario. */
class ThrowingMarkAlertedMentionWriter extends InMemoryMentionWriter {
  override markAlerted(): Promise<void> {
    return Promise.reject(new Error('mark-alerted storage failure'));
  }
}

/** Throws from `notify` — models an unreachable Notifier. */
class ThrowingNotifier implements Notifier {
  notify(): Promise<void> {
    return Promise.reject(new Error('smtp unreachable'));
  }
}

interface Harness {
  readonly companies: readonly TrackedCompany[];
  readonly companyRepository: InMemoryCompanyRepository;
  readonly classifier: InMemoryMentionClassifier;
  readonly mentionWriter: InMemoryMentionWriter;
  readonly runRepository: InMemoryRunRepository;
  readonly notifier: InMemoryNotifier;
  readonly service: RunService;
}

async function harness(overrides: {
  companies?: readonly SeedEntry[];
  newsSource?: NewsSource;
  classifications?: ReadonlyMap<string, Classification>;
  unavailable?: ClassifierUnavailableError | null;
  mentionWriter?: InMemoryMentionWriter;
  notifier?: Notifier;
  backfillDays?: number;
  alertWindowHours?: number;
}): Promise<Harness> {
  const companyRepository = new InMemoryCompanyRepository();
  const companies = await seedCompanies(companyRepository, overrides.companies ?? [companySpec()]);
  const companiesById = new Map(companies.map((c) => [c.id, c]));

  const classifier = new InMemoryMentionClassifier(
    overrides.classifications ?? new Map(),
    overrides.unavailable ?? null,
  );
  const mentionWriter = overrides.mentionWriter ?? new InMemoryMentionWriter(companiesById);
  const runRepository = new InMemoryRunRepository();
  // `h.notifier` is always this inspectable fake, regardless of which
  // Notifier is actually wired into the service — a test overriding
  // `notifier` (to exercise a failure) inspects what it passed in directly.
  const inMemoryNotifier = new InMemoryNotifier();
  const notifier: Notifier = overrides.notifier ?? inMemoryNotifier;
  const newsSource = overrides.newsSource ?? noArticles;

  const service = new RunService(
    companyRepository,
    newsSource,
    classifier,
    mentionWriter,
    runRepository,
    notifier,
    overrides.backfillDays ?? BACKFILL_DAYS,
    overrides.alertWindowHours ?? ALERT_WINDOW_HOURS,
  );

  return {
    companies,
    companyRepository,
    classifier,
    mentionWriter,
    runRepository,
    notifier: inMemoryNotifier,
    service,
  };
}

describe('RunService', () => {
  it('happy path: counts articles fetched, mentions discovered/classified, and new mentions alerted', async () => {
    const fetched = article({ publishedAt: new Date() });
    const h = await harness({
      newsSource: new PerCompanyNewsSource(new Map([['acme', [fetched]]])),
      classifications: new Map([[fetched.title, relevant('positive')]]),
    });

    const run = await h.service.execute('cli');

    expect(run.status).toBe('succeeded');
    expect(run.articlesFetched).toBe(1);
    expect(run.mentionsDiscovered).toBe(1);
    expect(run.mentionsClassified).toBe(1);
    expect(run.classificationFailures).toBe(0);
    expect(run.newMentions).toBe(1);
    expect(h.notifier.alerts).toHaveLength(1);
    expect(h.notifier.alerts[0]?.mentions).toHaveLength(1);
  });

  it('first Run: the window is now − BACKFILL_DAYS → now (no prior successful Run)', async () => {
    const now = new Date();
    const inside = article({
      url: 'https://example.com/inside',
      publishedAt: new Date(now.getTime() - (BACKFILL_DAYS - 1) * DAY_MS),
    });
    const outside = article({
      url: 'https://example.com/outside',
      publishedAt: new Date(now.getTime() - (BACKFILL_DAYS + 1) * DAY_MS),
    });
    const h = await harness({
      newsSource: new PerCompanyNewsSource(new Map([['acme', [inside, outside]]])),
    });

    const run = await h.service.execute('cli');

    expect(run.mentionsDiscovered).toBe(1);
  });

  it('incremental Run: the window is the last successful start − 2 days → now', async () => {
    const h = await harness({ newsSource: noArticles });

    const first = await h.service.execute('cli');
    expect(first.status).toBe('succeeded');

    const now = new Date();
    const inside = article({
      url: 'https://example.com/inside-incremental',
      publishedAt: new Date(now.getTime() - HOUR_MS),
    });
    const outside = article({
      url: 'https://example.com/outside-incremental',
      publishedAt: new Date(now.getTime() - 3 * DAY_MS),
    });
    // The window only depends on `runRepository.lastSuccessfulStart()`,
    // which carries over because this second service shares the same
    // stateful fakes — modelling "the next Run" without re-seeding.
    const second = new RunService(
      h.companyRepository,
      new PerCompanyNewsSource(new Map([['acme', [inside, outside]]])),
      h.classifier,
      h.mentionWriter,
      h.runRepository,
      h.notifier,
      BACKFILL_DAYS,
      ALERT_WINDOW_HOURS,
    );

    const run = await second.execute('cli');

    expect(run.mentionsDiscovered).toBe(1);
  });

  it('classifier unavailable fails fast and collects nothing', async () => {
    const h = await harness({
      newsSource: new PerCompanyNewsSource(new Map([['acme', [article()]]])),
      unavailable: new ClassifierUnavailableError('Ollama unreachable at http://localhost:11434'),
    });

    const run = await h.service.execute('cli');

    expect(run.status).toBe('failed');
    expect(run.error).toContain('Ollama unreachable');
    expect(run.articlesFetched).toBe(0);
    expect(run.mentionsDiscovered).toBe(0);
    expect(await h.mentionWriter.findPending()).toHaveLength(0);
  });

  it("one company's NewsSourceError is logged and counted, the Run continues", async () => {
    const fetched = article({ publishedAt: new Date() });
    const h = await harness({
      companies: [companySpec({ slug: 'failing-co' }), companySpec({ slug: 'ok-co' })],
      newsSource: new PerCompanyNewsSource(
        new Map<string, readonly FetchedArticle[] | NewsSourceError>([
          ['failing-co', new NewsSourceError('upstream 503')],
          ['ok-co', [fetched]],
        ]),
      ),
      classifications: new Map([[fetched.title, relevant()]]),
    });

    const run = await h.service.execute('cli');

    expect(run.status).toBe('succeeded');
    expect(run.articlesFetched).toBe(1);
    expect(run.mentionsDiscovered).toBe(1);
  });

  it('an unexpected (non-NewsSourceError) collection error fails the whole Run', async () => {
    const h = await harness({
      newsSource: {
        fetchArticles(): Promise<readonly FetchedArticle[]> {
          return Promise.reject(new Error('bug: unexpected shape'));
        },
      },
    });

    const run = await h.service.execute('cli');

    expect(run.status).toBe('failed');
    expect(run.error).toContain('unexpected shape');
  });

  it('item classification failure is counted and left retryable (unscripted title throws ClassificationFailedError)', async () => {
    const fetched = article();
    const h = await harness({
      newsSource: new PerCompanyNewsSource(new Map([['acme', [fetched]]])),
      // No classification scripted for this title → InMemoryMentionClassifier throws.
      classifications: new Map(),
    });

    const run = await h.service.execute('cli');

    expect(run.status).toBe('succeeded');
    expect(run.mentionsClassified).toBe(0);
    expect(run.classificationFailures).toBe(1);
    expect(await h.mentionWriter.findPending()).toHaveLength(1);
  });

  it('only relevant, never-alerted Mentions inside ALERT_WINDOW_HOURS reach the Alert', async () => {
    const now = new Date();
    const recentRelevant = article({
      url: 'https://example.com/recent-relevant',
      title: 'Recent relevant',
      publishedAt: new Date(now.getTime() - HOUR_MS),
    });
    const oldRelevant = article({
      url: 'https://example.com/old-relevant',
      title: 'Old relevant',
      publishedAt: new Date(now.getTime() - (ALERT_WINDOW_HOURS + 1) * HOUR_MS),
    });
    const recentNotRelevant = article({
      url: 'https://example.com/recent-not-relevant',
      title: 'Recent not relevant',
      publishedAt: new Date(now.getTime() - HOUR_MS),
    });
    const h = await harness({
      newsSource: new PerCompanyNewsSource(
        new Map([['acme', [recentRelevant, oldRelevant, recentNotRelevant]]]),
      ),
      classifications: new Map([
        [recentRelevant.title, relevant('positive')],
        [oldRelevant.title, relevant('negative')],
        [recentNotRelevant.title, notRelevant],
      ]),
    });

    const run = await h.service.execute('cli');

    expect(run.newMentions).toBe(1);
    expect(h.notifier.alerts[0]?.mentions).toHaveLength(1);
    expect(h.notifier.alerts[0]?.mentions[0]?.title).toBe('Recent relevant');
  });

  it('a Mention whose classification failed in Run N and succeeds in Run N+1 is alerted by N+1', async () => {
    const fetched = article({ publishedAt: new Date() });
    const h = await harness({
      newsSource: new PerCompanyNewsSource(new Map([['acme', [fetched]]])),
      classifications: new Map(), // unscripted → fails in Run N
    });

    const runN = await h.service.execute('cli');
    expect(runN.classificationFailures).toBe(1);
    expect(runN.newMentions).toBe(0);

    // Run N+1: same stateful fakes, a classifier that now scripts the title.
    const runNPlus1Service = new RunService(
      h.companyRepository,
      noArticles, // nothing new to collect
      new InMemoryMentionClassifier(new Map([[fetched.title, relevant('neutral')]])),
      h.mentionWriter,
      h.runRepository,
      h.notifier,
      BACKFILL_DAYS,
      ALERT_WINDOW_HOURS,
    );

    const runNPlus1 = await runNPlus1Service.execute('cli');

    expect(runNPlus1.status).toBe('succeeded');
    expect(runNPlus1.mentionsClassified).toBe(1);
    expect(runNPlus1.newMentions).toBe(1);
  });

  it('a Mention is never alerted twice', async () => {
    const fetched = article({ publishedAt: new Date() });
    const h = await harness({
      newsSource: new PerCompanyNewsSource(new Map([['acme', [fetched]]])),
      classifications: new Map([[fetched.title, relevant()]]),
    });

    const first = await h.service.execute('cli');
    expect(first.newMentions).toBe(1);

    const secondService = new RunService(
      h.companyRepository,
      noArticles,
      h.classifier,
      h.mentionWriter,
      h.runRepository,
      h.notifier,
      BACKFILL_DAYS,
      ALERT_WINDOW_HOURS,
    );
    const second = await secondService.execute('cli');

    expect(second.newMentions).toBe(0);
    expect(h.notifier.alerts[1]?.mentions).toHaveLength(0);
  });

  it('when notify throws, nothing is marked alerted and the next Run re-alerts the same Mention', async () => {
    const fetched = article({ publishedAt: new Date() });
    const h = await harness({
      newsSource: new PerCompanyNewsSource(new Map([['acme', [fetched]]])),
      classifications: new Map([[fetched.title, relevant()]]),
      notifier: new ThrowingNotifier(),
    });

    const first = await h.service.execute('cli');
    expect(first.status).toBe('failed');
    expect(first.error).toContain('smtp unreachable');

    const notifier = new InMemoryNotifier();
    const secondService = new RunService(
      h.companyRepository,
      noArticles,
      h.classifier,
      h.mentionWriter,
      h.runRepository,
      notifier,
      BACKFILL_DAYS,
      ALERT_WINDOW_HOURS,
    );
    const second = await secondService.execute('cli');

    expect(second.status).toBe('succeeded');
    expect(second.newMentions).toBe(1);
    expect(notifier.alerts[0]?.mentions).toHaveLength(1);
  });

  it(
    'when notify succeeds but markAlerted throws, the Run fails with the sent count recorded, ' +
      'and the next Run re-alerts the same Mention (at-least-once delivery)',
    async () => {
      const fetched = article({ publishedAt: new Date() });
      const companyRepository = new InMemoryCompanyRepository();
      const [acme] = await seedCompanies(companyRepository, [companySpec()]);
      const mentionWriter = new ThrowingMarkAlertedMentionWriter(new Map([[acme.id, acme]]));
      const runRepository = new InMemoryRunRepository();
      const classifier = new InMemoryMentionClassifier(new Map([[fetched.title, relevant()]]));
      const notifier = new InMemoryNotifier();

      const service = new RunService(
        companyRepository,
        new PerCompanyNewsSource(new Map([['acme', [fetched]]])),
        classifier,
        mentionWriter,
        runRepository,
        notifier,
        BACKFILL_DAYS,
        ALERT_WINDOW_HOURS,
      );

      const run = await service.execute('cli');

      expect(run.status).toBe('failed');
      expect(run.error).toContain('mark-alerted storage failure');
      // notify DID succeed and send this Mention — the count reflects that
      // even though the Run as a whole failed afterwards.
      expect(run.newMentions).toBe(1);
      expect(notifier.alerts).toHaveLength(1);
      expect(notifier.alerts[0]?.mentions).toHaveLength(1);

      // The Mention was never actually marked alerted (markAlerted threw),
      // so the next Run's findUnalerted still offers it.
      expect(await mentionWriter.findUnalerted(new Date(0))).toHaveLength(1);
    },
  );

  it('an empty Alert is still sent', async () => {
    const h = await harness({ newsSource: noArticles });

    const run = await h.service.execute('cli');

    expect(run.status).toBe('succeeded');
    expect(run.newMentions).toBe(0);
    expect(h.notifier.alerts).toHaveLength(1);
    expect(h.notifier.alerts[0]?.mentions).toEqual([]);
  });

  describe('startInBackground', () => {
    it('resolves with the started RunRecord without waiting for the pipeline to finish', async () => {
      const fetched = article({ publishedAt: new Date() });
      const h = await harness({
        newsSource: new PerCompanyNewsSource(new Map([['acme', [fetched]]])),
        classifications: new Map([[fetched.title, relevant()]]),
      });

      const started = await h.service.startInBackground('manual');

      expect(started.status).toBe('running');
      expect(started.trigger).toBe('manual');

      // Give the background pipeline a tick to finish, then check it did.
      await new Promise((resolve) => setTimeout(resolve, 10));
      const [listed] = await h.runRepository.list(1);
      expect(listed?.status).toBe('succeeded');
    });

    it('rejects with RunAlreadyInProgressError when the lock is already held', async () => {
      const h = await harness({});
      const neverResolves = new Promise<void>(() => {
        /* holds the lock forever for this test */
      });
      void h.runRepository.withLock(() => neverResolves).catch(() => undefined);

      await expect(h.service.startInBackground('manual')).rejects.toThrow(
        'A Run already holds the lock',
      );
    });
  });

  describe('list', () => {
    it('delegates to the RunRepository', async () => {
      const h = await harness({});
      await h.service.execute('cli');
      await h.service.execute('cli');

      const runs = await h.service.list(1);

      expect(runs).toHaveLength(1);
    });
  });
});
