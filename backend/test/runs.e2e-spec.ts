import { randomUUID } from 'crypto';
import {
  HttpStatus,
  INestApplication,
  Module,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { AlertsModule } from '../src/alerts/alerts.module.js';
import { InMemoryNotifier } from '../src/alerts/in-memory-notifier.js';
import { NOTIFIER } from '../src/alerts/notifier.js';
import { ClassificationModule } from '../src/classification/classification.module.js';
import { InMemoryMentionClassifier } from '../src/classification/in-memory-mention-classifier.js';
import { MENTION_CLASSIFIER } from '../src/classification/mention-classifier.js';
import { TrackedCompany } from '../src/companies/company.js';
import { CompaniesModule } from '../src/companies/companies.module.js';
import { COMPANY_REPOSITORY, CompanyRepository } from '../src/companies/company.repository.js';
import { InMemoryNewsSource } from '../src/news/in-memory-news-source.js';
import { NEWS_SOURCE } from '../src/news/news-source.js';
import { NewsModule } from '../src/news/news.module.js';
import { AppModule } from '../src/app.module.js';

/**
 * A `CompanyRepository` fake that answers with a single, fixed company —
 * one that `seedCompany` has already inserted directly into the real
 * Postgres `companies` table. The in-memory `InMemoryCompanyRepository`
 * fake cannot be used here: it mints its own random id on `upsertAll`,
 * which would not satisfy `mentions.company_id`'s foreign key against the
 * real `companies` table the Postgres `MentionWriter` writes into.
 */
class FixedCompanyRepository implements CompanyRepository {
  constructor(private readonly company: TrackedCompany) {}

  async upsertAll(): Promise<void> {
    return Promise.resolve();
  }

  async findAll(): Promise<readonly TrackedCompany[]> {
    return Promise.resolve([this.company]);
  }
}

/** Inserts a Tracked Company directly into Postgres so the real Postgres
 * `MentionWriter`'s foreign key to `companies` is satisfied. */
async function seedCompany(client: Client): Promise<TrackedCompany> {
  const id = randomUUID();
  const slug = `acme-e2e-${id}`;
  await client.query(
    `INSERT INTO companies (id, slug, name, former_names, disambiguator) VALUES ($1, $2, $3, '{}', NULL)`,
    [id, slug, 'Acme E2E Corp'],
  );
  return { id, slug, name: 'Acme E2E Corp', formerNames: [], disambiguator: null };
}

// `@types/superagent` (pulled in transitively by `@types/supertest`) does not
// currently publish a type for the thenable `Test` returns — see
// `health.e2e-spec.ts` for the same note.
interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/**
 * Boots the real `AppModule` (`docs/backend-nestjs-instructions.md#esm`),
 * but with `CompaniesModule`, `NewsModule`, `ClassificationModule` and
 * `AlertsModule` swapped out wholesale via `overrideModule` for tiny
 * in-memory stand-ins. Those four modules bind no provider at all yet on
 * `main` (their owning issues — seed loader, news source, Ollama
 * classifier, console notifier — haven't landed), so there is nothing for
 * `overrideProvider` to override; `overrideModule` replaces the module
 * itself instead. `RUN_REPOSITORY` and `MENTION_WRITER` are untouched —
 * this issue owns them, and they run for real against Postgres.
 */
async function buildApp(client: Client): Promise<{
  app: INestApplication;
  notifier: InMemoryNotifier;
  company: TrackedCompany;
}> {
  const company = await seedCompany(client);
  const companyRepository = new FixedCompanyRepository(company);

  const articleTitle = `Acme E2E raises funding ${randomUUID()}`;
  const article = {
    url: `https://example.com/acme-e2e-${randomUUID()}`,
    title: articleTitle,
    outlet: 'Example Times',
    publishedAt: new Date(),
    source: 'google-news-rss',
  };
  const newsSource = new InMemoryNewsSource([article]);
  const classifier = new InMemoryMentionClassifier(
    new Map([
      [
        articleTitle,
        {
          relevant: true as const,
          sentiment: 'positive' as const,
          confidence: 0.9,
          rationale: 'Clearly about Acme',
          model: 'fake-model',
        },
      ],
    ]),
  );
  const notifier = new InMemoryNotifier();

  @Module({
    providers: [{ provide: COMPANY_REPOSITORY, useValue: companyRepository }],
    exports: [COMPANY_REPOSITORY],
  })
  class TestCompaniesModule {}

  @Module({
    providers: [{ provide: NEWS_SOURCE, useValue: newsSource }],
    exports: [NEWS_SOURCE],
  })
  class TestNewsModule {}

  @Module({
    providers: [{ provide: MENTION_CLASSIFIER, useValue: classifier }],
    exports: [MENTION_CLASSIFIER],
  })
  class TestClassificationModule {}

  @Module({
    providers: [{ provide: NOTIFIER, useValue: notifier }],
    exports: [NOTIFIER],
  })
  class TestAlertsModule {}

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideModule(CompaniesModule)
    .useModule(TestCompaniesModule)
    .overrideModule(NewsModule)
    .useModule(TestNewsModule)
    .overrideModule(ClassificationModule)
    .useModule(TestClassificationModule)
    .overrideModule(AlertsModule)
    .useModule(TestAlertsModule)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  await app.init();
  return { app, notifier, company };
}

async function httpPost(app: INestApplication, path: string): Promise<HttpResponse> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return await request(app.getHttpServer()).post(path);
}

async function httpGet(app: INestApplication, path: string): Promise<HttpResponse> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return await request(app.getHttpServer()).get(path);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls until the background Run has sent its Alert, instead of a fixed sleep guess. */
async function waitForNotification(
  notifier: InMemoryNotifier,
  minAlerts: number,
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (notifier.alerts.length < minAlerts) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${minAlerts} alert(s); got ${notifier.alerts.length}`);
    }
    await sleep(25);
  }
}

describe('/api/runs (e2e)', () => {
  let app: INestApplication;
  let notifier: InMemoryNotifier;
  let client: Client;
  let company: TrackedCompany;

  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5432/app',
    });
    await client.connect();

    const built = await buildApp(client);
    app = built.app;
    notifier = built.notifier;
    company = built.company;
  });

  afterAll(async () => {
    await app.close();
    // Clean up everything this suite's Runs wrote, in FK order.
    await client.query('DELETE FROM mentions WHERE company_id = $1', [company.id]);
    await client.query("DELETE FROM articles WHERE url LIKE 'https://example.com/acme-e2e-%'");
    await client.query('DELETE FROM companies WHERE id = $1', [company.id]);
    await client.end();
  });

  it('POST twice concurrently: one 202 (started in the background), one 409 (lock already held)', async () => {
    const [first, second] = await Promise.all([
      httpPost(app, '/api/runs'),
      httpPost(app, '/api/runs'),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([HttpStatus.ACCEPTED, HttpStatus.CONFLICT]);

    const acceptedStatus: number = HttpStatus.ACCEPTED;
    const accepted = first.status === acceptedStatus ? first : second;
    expect(accepted.body).toMatchObject({ trigger: 'manual', status: 'running' });

    // Let the background pipeline (in-memory news/classifier, real Postgres
    // run/mention writers) finish before the next test inspects GET /api/runs.
    await waitForNotification(notifier, 1);
  });

  it('GET /api/runs returns the RunDto shape, most recent first', async () => {
    const response = await httpGet(app, '/api/runs?limit=5');

    expect(response.status).toBe(HttpStatus.OK);
    const body = response.body as { runs: unknown[] };
    expect(Array.isArray(body.runs)).toBe(true);
    expect(body.runs.length).toBeGreaterThanOrEqual(1);
    expect(body.runs[0]).toMatchObject({ trigger: 'manual' });
    const run = body.runs[0] as Record<string, unknown>;
    expect(['succeeded', 'failed']).toContain(run.status);
    expect(typeof run.id).toBe('string');
    expect(typeof run.startedAt).toBe('string');
    expect(run).toHaveProperty('articlesFetched');
    expect(run).toHaveProperty('mentionsDiscovered');
    expect(run).toHaveProperty('mentionsClassified');
    expect(run).toHaveProperty('classificationFailures');
    expect(run).toHaveProperty('newMentions');
    expect(run).toHaveProperty('error');
  });

  it('GET /api/runs?limit=0 returns 400', async () => {
    const response = await httpGet(app, '/api/runs?limit=0');

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it('GET /api/runs?limit=51 returns 400', async () => {
    const response = await httpGet(app, '/api/runs?limit=51');

    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
  });
});
