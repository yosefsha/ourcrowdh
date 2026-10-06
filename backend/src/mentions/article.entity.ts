import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Persistence mapping for the `articles` table
 * (`docs/PLAN.md#data-model-initial-migration`). Lives in `mentions/`, not
 * `news/`, because `news/` is a read-only Gateway to an external service —
 * it never persists anything (`docs/PLAN.md#news-source-isolation`). The Run
 * orchestrator writes rows here through `MentionWriter.recordDiscovered`.
 */
@Entity({ name: 'articles' })
export class ArticleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  url!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  outlet!: string;

  /** Provenance, e.g. `'google-news-rss'` — mirrors `FetchedArticle.source`. */
  @Column({ type: 'text' })
  source!: string;

  // Indexed for the (`company_id`, `published_at` via `article`) lookup
  // `docs/PLAN.md#data-model-initial-migration` calls out for status/quarter
  // queries — `published_at` lives on this table, `company_id` on `mentions`
  // (see `MentionEntity`); Postgres combines the two single-column indexes
  // when the query joins them.
  @Column({ name: 'published_at', type: 'timestamptz' })
  @Index()
  publishedAt!: Date;

  @Column({ name: 'first_seen_at', type: 'timestamptz' })
  firstSeenAt!: Date;
}
