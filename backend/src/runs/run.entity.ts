import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { RunStatus, RunTrigger } from './run.repository.js';

/**
 * Persistence mapping for the `runs` table
 * (`docs/PLAN.md#data-model-initial-migration`).
 */
@Entity({ name: 'runs' })
export class RunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ['schedule', 'manual', 'cli'], enumName: 'run_trigger' })
  trigger!: RunTrigger;

  @Column({
    type: 'enum',
    enum: ['running', 'succeeded', 'failed'],
    enumName: 'run_status',
    default: 'running',
  })
  status!: RunStatus;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ name: 'articles_fetched', type: 'int', default: 0 })
  articlesFetched!: number;

  @Column({ name: 'mentions_discovered', type: 'int', default: 0 })
  mentionsDiscovered!: number;

  @Column({ name: 'mentions_classified', type: 'int', default: 0 })
  mentionsClassified!: number;

  @Column({ name: 'classification_failures', type: 'int', default: 0 })
  classificationFailures!: number;

  @Column({ name: 'new_mentions', type: 'int', default: 0 })
  newMentions!: number;

  @Column({ type: 'text', nullable: true })
  error!: string | null;
}
