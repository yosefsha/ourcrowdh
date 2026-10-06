import { randomUUID } from 'crypto';
import { Client } from 'pg';

/**
 * Asserts the two `CHECK` constraints `mentions.entity.ts` declares
 * (`docs/PLAN.md#data-model-initial-migration`) are enforced by Postgres
 * itself, not just by application code — a row violating either must be
 * rejected by the database even if some future caller skips the domain
 * layer entirely. Talks to Postgres directly with raw SQL rather than
 * through TypeORM, since the point is to prove *the database* rejects an
 * illegal state, independent of any validation an ORM layer might add later.
 *
 * Requires `npm run migration:run` to have applied the initial schema first
 * (`DATABASE_URL`, same as the rest of the app) — true in CI (which runs the
 * migration before `test:e2e`) and true locally once the schema has been
 * migrated.
 */
describe('mentions CHECK constraints (e2e)', () => {
  let client: Client;
  let companyId: string;
  let runId: string;
  // `mentions` is unique on (article_id, company_id) — every inserted
  // article in this suite, successful or not.
  const insertedArticleIds: string[] = [];

  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5432/app',
    });
    await client.connect();

    companyId = randomUUID();
    await client.query(
      `INSERT INTO companies (id, slug, name, former_names, disambiguator)
       VALUES ($1, $2, $3, '{}', NULL)`,
      [companyId, `acme-${companyId}`, 'Acme Corp'],
    );

    runId = randomUUID();
    await client.query(
      `INSERT INTO runs (id, trigger, status, started_at) VALUES ($1, 'cli', 'running', now())`,
      [runId],
    );
  });

  afterAll(async () => {
    await client.query('DELETE FROM mentions WHERE company_id = $1', [companyId]);
    await client.query('DELETE FROM runs WHERE id = $1', [runId]);
    if (insertedArticleIds.length > 0) {
      await client.query('DELETE FROM articles WHERE id = ANY($1)', [insertedArticleIds]);
    }
    await client.query('DELETE FROM companies WHERE id = $1', [companyId]);
    await client.end();
  });

  async function insertMention(overrides: {
    classificationStatus: string;
    relevant: boolean | null;
    sentiment: 'positive' | 'negative' | 'neutral' | null;
  }): Promise<void> {
    // Each call gets its own Article — one row per test case, so the
    // `unique(article_id, company_id)` constraint never collides with a
    // previous test case's mention for the same company.
    const articleId = randomUUID();
    insertedArticleIds.push(articleId);
    await client.query(
      `INSERT INTO articles (id, url, title, outlet, source, published_at, first_seen_at)
       VALUES ($1, $2, 'Acme raises $10M', 'Example Times', 'google-news-rss', now(), now())`,
      [articleId, `https://example.com/${articleId}`],
    );

    await client.query(
      `INSERT INTO mentions
         (id, article_id, company_id, first_seen_run_id, classification_status, relevant, sentiment)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        articleId,
        companyId,
        runId,
        overrides.classificationStatus,
        overrides.relevant,
        overrides.sentiment,
      ],
    );
  }

  it('rejects classification_status=classified with relevant=null', async () => {
    await expect(
      insertMention({ classificationStatus: 'classified', relevant: null, sentiment: null }),
    ).rejects.toMatchObject({ code: '23514' }); // Postgres: check_violation
  });

  it('rejects relevant=true with sentiment=null', async () => {
    await expect(
      insertMention({ classificationStatus: 'classified', relevant: true, sentiment: null }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects relevant=null with sentiment set — `relevant = true` in SQL is NULL, not false, when relevant IS NULL', async () => {
    // Regression case: a bare `(relevant = true) = (sentiment IS NOT NULL)`
    // check would pass here, since `NULL = true` is `NULL` and Postgres
    // treats a NULL CHECK result as satisfied. The constraint must use
    // `COALESCE(relevant, false)` so a null `relevant` is treated the same
    // as `false`, not as "unknown, so allow it".
    await expect(
      insertMention({ classificationStatus: 'failed', relevant: null, sentiment: 'positive' }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('accepts a pending Mention with relevant and sentiment both null', async () => {
    await expect(
      insertMention({ classificationStatus: 'pending', relevant: null, sentiment: null }),
    ).resolves.toBeUndefined();
  });

  it('accepts a classified, relevant Mention with sentiment set', async () => {
    await expect(
      insertMention({ classificationStatus: 'classified', relevant: true, sentiment: 'positive' }),
    ).resolves.toBeUndefined();
  });

  it('accepts a classified, not-relevant Mention with sentiment null', async () => {
    await expect(
      insertMention({ classificationStatus: 'classified', relevant: false, sentiment: null }),
    ).resolves.toBeUndefined();
  });
});
