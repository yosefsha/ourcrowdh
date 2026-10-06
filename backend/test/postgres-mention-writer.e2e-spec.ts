import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { ArticleEntity } from '../src/mentions/article.entity.js';
import { MentionEntity } from '../src/mentions/mention.entity.js';
import { PostgresMentionWriter } from '../src/mentions/repositories/postgres-mention-writer.js';
import { CompanyEntity } from '../src/companies/company.entity.js';
import { RunEntity } from '../src/runs/run.entity.js';
import { FetchedArticle } from '../src/news/news-source.js';

/**
 * E2E coverage of `PostgresMentionWriter` against real Postgres, built
 * directly from a `DataSource` rather than through Nest DI — the same
 * pattern `mention-check-constraints.e2e-spec.ts` uses, since the point is
 * to prove the real driver/schema combination, not Nest's wiring.
 *
 * Requires `npm run migration:run` to have applied the schema (true in CI
 * and after a local `npm run migration:run`), same precondition as the
 * other Postgres-backed e2e specs in this directory.
 */
describe('PostgresMentionWriter idempotency (e2e)', () => {
  let dataSource: DataSource;
  let writer: PostgresMentionWriter;
  let companyId: string;
  let runId: string;
  let otherCompanyId: string;

  const article: FetchedArticle = {
    url: `https://example.com/pg-writer-${randomUUID()}`,
    title: 'Acme raises $10M',
    outlet: 'Example Times',
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    source: 'google-news-rss',
  };

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5432/app',
      entities: [RunEntity, CompanyEntity, ArticleEntity, MentionEntity],
      synchronize: false,
    });
    await dataSource.initialize();
    writer = new PostgresMentionWriter(dataSource, dataSource.getRepository(MentionEntity));

    companyId = randomUUID();
    await dataSource.query(
      `INSERT INTO companies (id, slug, name, former_names, disambiguator) VALUES ($1, $2, $3, '{}', NULL)`,
      [companyId, `pg-writer-${companyId}`, 'Acme Corp'],
    );
    otherCompanyId = randomUUID();
    await dataSource.query(
      `INSERT INTO companies (id, slug, name, former_names, disambiguator) VALUES ($1, $2, $3, '{}', NULL)`,
      [otherCompanyId, `pg-writer-other-${otherCompanyId}`, 'Other Corp'],
    );

    runId = randomUUID();
    await dataSource.query(
      `INSERT INTO runs (id, trigger, status, started_at) VALUES ($1, 'cli', 'running', now())`,
      [runId],
    );
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM mentions WHERE company_id = ANY($1)', [
      [companyId, otherCompanyId],
    ]);
    await dataSource.query('DELETE FROM runs WHERE id = $1', [runId]);
    await dataSource.query('DELETE FROM articles WHERE url = $1', [article.url]);
    await dataSource.query('DELETE FROM companies WHERE id = ANY($1)', [
      [companyId, otherCompanyId],
    ]);
    await dataSource.destroy();
  });

  it('recordDiscovered upserts the Article on url and the Mention on (article, company); re-recording creates nothing new', async () => {
    const firstCount = await writer.recordDiscovered(runId, companyId, [article]);
    expect(firstCount).toBe(1);

    const [articleRow] = await dataSource.query<{ id: string }[]>(
      'SELECT id FROM articles WHERE url = $1',
      [article.url],
    );
    expect(articleRow).toBeDefined();

    const secondCount = await writer.recordDiscovered(runId, companyId, [article]);
    expect(secondCount).toBe(0);

    const articleRows = await dataSource.query<{ id: string }[]>(
      'SELECT id FROM articles WHERE url = $1',
      [article.url],
    );
    expect(articleRows).toHaveLength(1);

    const mentionRows = await dataSource.query<{ id: string }[]>(
      'SELECT id FROM mentions WHERE article_id = $1 AND company_id = $2',
      [articleRow.id, companyId],
    );
    expect(mentionRows).toHaveLength(1);
  });

  it('the same Article for a different Company is a distinct Mention', async () => {
    const created = await writer.recordDiscovered(runId, otherCompanyId, [article]);

    expect(created).toBe(1);
  });

  it('findPending / saveClassification / markFailed drive the classification status transitions', async () => {
    const pending = await writer.findPending();
    const mine = pending.find((mention) => mention.company.id === companyId);
    expect(mine).toBeDefined();
    expect(mine).toMatchObject({ title: article.title, outlet: article.outlet });

    await writer.saveClassification(mine!.id, {
      relevant: true,
      sentiment: 'positive',
      confidence: 0.9,
      rationale: 'Clearly about Acme',
      model: 'fake-model',
    });

    const stillPending = await writer.findPending();
    expect(stillPending.some((mention) => mention.id === mine!.id)).toBe(false);

    await expect(
      writer.saveClassification('00000000-0000-0000-0000-000000000000', {
        relevant: false,
        rationale: 'n/a',
        model: 'fake-model',
      }),
    ).rejects.toThrow();
  });

  it('findUnalerted / markAlerted: a relevant, never-alerted Mention is offered once and then never again', async () => {
    const unalerted = await writer.findUnalerted(new Date('2025-12-31T00:00:00Z'));
    const mine = unalerted.find((mention) => mention.url === article.url);
    expect(mine).toBeDefined();
    expect(mine).toMatchObject({ companyName: 'Acme Corp', sentiment: 'positive' });

    await writer.markAlerted(runId, [mine!.mentionId]);

    const afterMarking = await writer.findUnalerted(new Date('2025-12-31T00:00:00Z'));
    expect(afterMarking.some((mention) => mention.mentionId === mine!.mentionId)).toBe(false);
  });

  it('markFailed on an unknown id throws', async () => {
    await expect(
      writer.markFailed('00000000-0000-0000-0000-000000000000', 'invalid JSON after retries'),
    ).rejects.toThrow();
  });
});
