/**
 * Port for a Run's lifecycle (`docs/PLAN.md#ports`, `docs/PLAN.md#run-pipeline`).
 *
 * `RunRecord` and `RunCounts` are not spelled out verbatim in
 * `docs/PLAN.md#ports`, but every field is: `RunRecord` mirrors the `runs`
 * table in `docs/PLAN.md#data-model-initial-migration` one-for-one (camelCase
 * instead of snake_case, `Date` instead of `timestamptz`), and `RunCounts` is
 * the subset of that record's count columns `finish`/`fail` are given
 * explicitly rather than reading back from storage.
 */
export type RunTrigger = 'schedule' | 'manual' | 'cli';
export type RunStatus = 'running' | 'succeeded' | 'failed';

export interface RunRecord {
  readonly id: string;
  readonly trigger: RunTrigger;
  readonly status: RunStatus;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly articlesFetched: number;
  readonly mentionsDiscovered: number;
  readonly mentionsClassified: number;
  readonly classificationFailures: number;
  readonly newMentions: number;
  readonly error: string | null;
}

export interface RunCounts {
  readonly articlesFetched: number;
  readonly mentionsDiscovered: number;
  readonly mentionsClassified: number;
  readonly classificationFailures: number;
  readonly newMentions: number;
}

export const RUN_REPOSITORY = Symbol('RUN_REPOSITORY');

export interface RunRepository {
  /** Holds the Postgres advisory lock for the duration of `work`. */
  withLock<T>(work: () => Promise<T>): Promise<T>;
  start(trigger: RunTrigger): Promise<RunRecord>;
  lastSuccessfulStart(): Promise<Date | null>;
  finish(id: string, counts: RunCounts): Promise<void>;
  fail(id: string, error: string, counts: RunCounts): Promise<void>;
  list(limit: number): Promise<readonly RunRecord[]>;
}

/** Thrown by `withLock()` when a second Run is already holding the lock. */
export class RunAlreadyInProgressError extends Error {}
