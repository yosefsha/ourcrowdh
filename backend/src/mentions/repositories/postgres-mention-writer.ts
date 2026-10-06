import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { NewMention } from '../../alerts/notifier.js';
import { Classification, Sentiment } from '../../classification/mention-classifier.js';
import { FetchedArticle } from '../../news/news-source.js';
import { MentionEntity } from '../mention.entity.js';
import { MentionWriter, PendingMention } from '../mention-writer.js';

interface PendingRow {
  readonly id: string;
  readonly title: string;
  readonly outlet: string;
  readonly company_id: string;
  readonly company_slug: string;
  readonly company_name: string;
  readonly company_former_names: string[] | null;
  readonly company_disambiguator: string | null;
}

interface UnalertedRow {
  readonly mention_id: string;
  readonly title: string;
  readonly url: string;
  readonly outlet: string;
  readonly published_at: Date;
  readonly sentiment: Sentiment;
  readonly company_name: string;
}

/**
 * Postgres implementation of `MentionWriter` (`docs/PLAN.md#ports`).
 * `recordDiscovered` upserts `articles` on `url` and `mentions` on
 * `(article_id, company_id)` with raw `INSERT ... ON CONFLICT ... RETURNING`
 * so the count of newly-created rows is exact and race-free — a plain
 * `Repository.upsert()` cannot tell a fresh insert from a no-op update.
 * `markFailed` reuses the `rationale` column for the failure reason: the
 * schema (`docs/PLAN.md#data-model-initial-migration`) has no separate
 * "why is this Mention in its current state" column for the failed branch,
 * and a failure reason is exactly that, just for a different outcome than a
 * successful classification's rationale.
 */
@Injectable()
export class PostgresMentionWriter implements MentionWriter {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(MentionEntity) private readonly mentions: Repository<MentionEntity>,
  ) {}

  async recordDiscovered(
    runId: string,
    companyId: string,
    articles: readonly FetchedArticle[],
  ): Promise<number> {
    let created = 0;
    for (const article of articles) {
      const articleId = await this.upsertArticle(article);
      const inserted = await this.insertMentionIfAbsent(articleId, companyId, runId);
      if (inserted) {
        created += 1;
      }
    }
    return created;
  }

  async findPending(): Promise<readonly PendingMention[]> {
    const rows = await this.dataSource.query<PendingRow[]>(
      `SELECT m.id AS id, a.title AS title, a.outlet AS outlet,
              c.id AS company_id, c.slug AS company_slug, c.name AS company_name,
              c.former_names AS company_former_names, c.disambiguator AS company_disambiguator
       FROM mentions m
       JOIN articles a ON a.id = m.article_id
       JOIN companies c ON c.id = m.company_id
       WHERE m.classification_status IN ('pending', 'failed')`,
    );

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      outlet: row.outlet,
      company: {
        id: row.company_id,
        slug: row.company_slug,
        name: row.company_name,
        formerNames: row.company_former_names ?? [],
        disambiguator: row.company_disambiguator,
      },
    }));
  }

  async saveClassification(mentionId: string, result: Classification): Promise<void> {
    const affected = await this.mentions.update(mentionId, {
      classificationStatus: 'classified',
      relevant: result.relevant,
      sentiment: result.relevant ? result.sentiment : null,
      confidence: result.relevant ? result.confidence : null,
      rationale: result.rationale,
      model: result.model,
      classifiedAt: new Date(),
    });
    this.assertAffected(affected.affected, mentionId);
  }

  async markFailed(mentionId: string, reason: string): Promise<void> {
    const affected = await this.mentions.update(mentionId, {
      classificationStatus: 'failed',
      rationale: reason,
    });
    this.assertAffected(affected.affected, mentionId);
  }

  async findUnalerted(publishedSince: Date): Promise<readonly NewMention[]> {
    const rows = await this.dataSource.query<UnalertedRow[]>(
      `SELECT m.id AS mention_id, a.title AS title, a.url AS url, a.outlet AS outlet,
              a.published_at AS published_at, m.sentiment AS sentiment, c.name AS company_name
       FROM mentions m
       JOIN articles a ON a.id = m.article_id
       JOIN companies c ON c.id = m.company_id
       WHERE m.relevant = true AND m.alerted_run_id IS NULL AND a.published_at >= $1`,
      [publishedSince],
    );

    return rows.map((row) => ({
      mentionId: row.mention_id,
      companyName: row.company_name,
      title: row.title,
      url: row.url,
      outlet: row.outlet,
      publishedAt: row.published_at,
      sentiment: row.sentiment,
    }));
  }

  async markAlerted(runId: string, mentionIds: readonly string[]): Promise<void> {
    if (mentionIds.length === 0) {
      return;
    }
    await this.mentions.update({ id: In([...mentionIds]) }, { alertedRunId: runId });
  }

  private async upsertArticle(article: FetchedArticle): Promise<string> {
    const rows = await this.dataSource.query<{ id: string }[]>(
      `INSERT INTO articles (url, title, outlet, source, published_at, first_seen_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (url) DO UPDATE SET title = EXCLUDED.title, outlet = EXCLUDED.outlet
       RETURNING id`,
      [article.url, article.title, article.outlet, article.source, article.publishedAt],
    );
    return rows[0]?.id ?? this.fail('upsertArticle returned no row');
  }

  private async insertMentionIfAbsent(
    articleId: string,
    companyId: string,
    runId: string,
  ): Promise<boolean> {
    const rows = await this.dataSource.query<{ id: string }[]>(
      `INSERT INTO mentions (article_id, company_id, first_seen_run_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (article_id, company_id) DO NOTHING
       RETURNING id`,
      [articleId, companyId, runId],
    );
    return rows.length > 0;
  }

  private assertAffected(affected: number | null | undefined, mentionId: string): void {
    if (!affected) {
      throw new Error(`PostgresMentionWriter has no mention with id "${mentionId}"`);
    }
  }

  private fail(message: string): never {
    throw new Error(message);
  }
}
