import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { CompanyEntity } from '../companies/company.entity.js';
import { Sentiment } from '../classification/mention-classifier.js';
import { RunEntity } from '../runs/run.entity.js';
import { ArticleEntity } from './article.entity.js';

export type MentionClassificationStatus = 'pending' | 'classified' | 'failed';

/**
 * Persistence mapping for the `mentions` table
 * (`docs/PLAN.md#data-model-initial-migration`) — the pairing of one Article
 * with one Tracked Company (`CONTEXT.md#coverage`). The two `@Check`
 * constraints are the ones the migration must carry and the acceptance
 * criteria's e2e spec asserts against:
 *   - classified ⇔ relevant IS NOT NULL
 *   - relevant = true ⇔ sentiment IS NOT NULL
 *
 * The second constraint is written with `COALESCE(relevant, false)`, not a
 * bare `relevant = true`: in SQL, `NULL = true` evaluates to `NULL`, and
 * Postgres treats a `NULL` `CHECK` result as passing (only `false` fails
 * it) — so a bare `(relevant = true) = (sentiment IS NOT NULL)` would let a
 * row with `relevant IS NULL` and a non-null `sentiment` through.
 * `COALESCE` forces the left side to a real boolean so `relevant IS NULL`
 * is treated the same as `relevant = false`.
 */
@Entity({ name: 'mentions' })
@Unique(['articleId', 'companyId'])
@Check(`(classification_status = 'classified') = (relevant IS NOT NULL)`)
@Check(`(COALESCE(relevant, false) = (sentiment IS NOT NULL))`)
export class MentionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'article_id', type: 'uuid' })
  @Index()
  articleId!: string;

  @ManyToOne(() => ArticleEntity)
  @JoinColumn({ name: 'article_id' })
  article!: ArticleEntity;

  @Column({ name: 'company_id', type: 'uuid' })
  @Index()
  companyId!: string;

  @ManyToOne(() => CompanyEntity)
  @JoinColumn({ name: 'company_id' })
  company!: CompanyEntity;

  @Column({ name: 'first_seen_run_id', type: 'uuid' })
  firstSeenRunId!: string;

  @ManyToOne(() => RunEntity)
  @JoinColumn({ name: 'first_seen_run_id' })
  firstSeenRun!: RunEntity;

  @Column({
    name: 'classification_status',
    type: 'enum',
    enum: ['pending', 'classified', 'failed'],
    enumName: 'mention_classification_status',
    default: 'pending',
  })
  classificationStatus!: MentionClassificationStatus;

  @Column({ type: 'boolean', nullable: true })
  relevant!: boolean | null;

  @Column({
    type: 'enum',
    enum: ['positive', 'negative', 'neutral'],
    enumName: 'mention_sentiment',
    nullable: true,
  })
  sentiment!: Sentiment | null;

  @Column({ type: 'real', nullable: true })
  confidence!: number | null;

  @Column({ type: 'text', nullable: true })
  rationale!: string | null;

  @Column({ type: 'text', nullable: true })
  model!: string | null;

  @Column({ name: 'classified_at', type: 'timestamptz', nullable: true })
  classifiedAt!: Date | null;
}
