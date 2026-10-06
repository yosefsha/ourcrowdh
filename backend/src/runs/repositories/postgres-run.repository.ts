import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RunEntity } from '../run.entity.js';
import {
  RunAlreadyInProgressError,
  RunCounts,
  RunRecord,
  RunRepository,
  RunTrigger,
} from '../run.repository.js';

/**
 * Arbitrary, fixed key identifying "the one Run" for this application's
 * Postgres advisory lock (`docs/PLAN.md#decisions`: "A Run holds a Postgres
 * advisory lock; a second concurrent Run fails fast"). Advisory lock keys
 * are namespaced per-database, not per-table, so any application-wide
 * constant works — nothing else in this app takes an advisory lock.
 */
const RUN_LOCK_KEY = 72_726_001;

interface AdvisoryLockRow {
  readonly locked: boolean;
}

/**
 * Postgres implementation of `RunRepository` (`docs/PLAN.md#ports`).
 *
 * `withLock` uses a dedicated `QueryRunner` — a single checked-out
 * connection — for the whole duration of `work`, rather than
 * `DataSource.query()` (which borrows a random pooled connection per call).
 * Postgres advisory locks are session-scoped: acquiring on one connection
 * and later releasing on a different one (which is what a pooled
 * `.query()` per call would risk) leaves the lock held until that first
 * connection closes, deadlocking every future Run.
 */
@Injectable()
export class PostgresRunRepository implements RunRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(RunEntity) private readonly runs: Repository<RunEntity>,
  ) {}

  async withLock<T>(work: () => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const [row] = (await queryRunner.query('SELECT pg_try_advisory_lock($1) AS locked', [
        RUN_LOCK_KEY,
      ])) as AdvisoryLockRow[];
      if (!row?.locked) {
        throw new RunAlreadyInProgressError('A Run already holds the Postgres advisory lock');
      }
      try {
        return await work();
      } finally {
        await queryRunner.query('SELECT pg_advisory_unlock($1)', [RUN_LOCK_KEY]);
      }
    } finally {
      await queryRunner.release();
    }
  }

  async start(trigger: RunTrigger): Promise<RunRecord> {
    const entity = this.runs.create({
      trigger,
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
      articlesFetched: 0,
      mentionsDiscovered: 0,
      mentionsClassified: 0,
      classificationFailures: 0,
      newMentions: 0,
      error: null,
    });
    const saved = await this.runs.save(entity);
    return toRunRecord(saved);
  }

  async lastSuccessfulStart(): Promise<Date | null> {
    const latest = await this.runs.findOne({
      where: { status: 'succeeded' },
      order: { startedAt: 'DESC' },
    });
    return latest ? latest.startedAt : null;
  }

  async finish(id: string, counts: RunCounts): Promise<void> {
    const result = await this.runs.update(id, {
      ...counts,
      status: 'succeeded',
      finishedAt: new Date(),
      error: null,
    });
    this.assertAffected(result.affected, id);
  }

  async fail(id: string, error: string, counts: RunCounts): Promise<void> {
    const result = await this.runs.update(id, {
      ...counts,
      status: 'failed',
      finishedAt: new Date(),
      error,
    });
    this.assertAffected(result.affected, id);
  }

  async list(limit: number): Promise<readonly RunRecord[]> {
    const rows = await this.runs.find({ order: { startedAt: 'DESC' }, take: limit });
    return rows.map(toRunRecord);
  }

  private assertAffected(affected: number | null | undefined, id: string): void {
    if (!affected) {
      throw new Error(`PostgresRunRepository has no run with id "${id}"`);
    }
  }
}

function toRunRecord(entity: RunEntity): RunRecord {
  return {
    id: entity.id,
    trigger: entity.trigger,
    status: entity.status,
    startedAt: entity.startedAt,
    finishedAt: entity.finishedAt,
    articlesFetched: entity.articlesFetched,
    mentionsDiscovered: entity.mentionsDiscovered,
    mentionsClassified: entity.mentionsClassified,
    classificationFailures: entity.classificationFailures,
    newMentions: entity.newMentions,
    error: entity.error,
  };
}
