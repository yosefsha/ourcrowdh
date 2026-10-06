import { randomUUID } from 'crypto';
import {
  RunAlreadyInProgressError,
  RunCounts,
  RunRecord,
  RunRepository,
  RunTrigger,
} from './run.repository.js';

/**
 * In-memory fake for `RunRepository` — the reference other issues' unit
 * tests run against. `withLock` models the Postgres advisory lock with a
 * single boolean: a call made while another is still in flight (including
 * one nested inside the first's `work`) rejects with
 * `RunAlreadyInProgressError`, exactly like a second concurrent Run does
 * against the real lock (`docs/PLAN.md#decisions`).
 */
export class InMemoryRunRepository implements RunRepository {
  private readonly runs: RunRecord[] = [];
  private locked = false;

  async withLock<T>(work: () => Promise<T>): Promise<T> {
    if (this.locked) {
      throw new RunAlreadyInProgressError('A Run already holds the lock');
    }
    this.locked = true;
    try {
      return await work();
    } finally {
      this.locked = false;
    }
  }

  async start(trigger: RunTrigger): Promise<RunRecord> {
    const record: RunRecord = {
      id: randomUUID(),
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
    };
    this.runs.push(record);
    return Promise.resolve(record);
  }

  async lastSuccessfulStart(): Promise<Date | null> {
    const succeeded = this.runs.filter((run) => run.status === 'succeeded');
    if (succeeded.length === 0) {
      return Promise.resolve(null);
    }
    const latest = succeeded.reduce((latest, run) =>
      run.startedAt > latest.startedAt ? run : latest,
    );
    return Promise.resolve(latest.startedAt);
  }

  async finish(id: string, counts: RunCounts): Promise<void> {
    this.replace(id, (run) => ({
      ...run,
      ...counts,
      status: 'succeeded',
      finishedAt: new Date(),
      error: null,
    }));
    return Promise.resolve();
  }

  async fail(id: string, error: string, counts: RunCounts): Promise<void> {
    this.replace(id, (run) => ({
      ...run,
      ...counts,
      status: 'failed',
      finishedAt: new Date(),
      error,
    }));
    return Promise.resolve();
  }

  async list(limit: number): Promise<readonly RunRecord[]> {
    const sorted = [...this.runs].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    return Promise.resolve(sorted.slice(0, limit));
  }

  private replace(id: string, update: (run: RunRecord) => RunRecord): void {
    const index = this.runs.findIndex((run) => run.id === id);
    if (index === -1) {
      throw new Error(`InMemoryRunRepository has no run with id "${id}"`);
    }
    this.runs[index] = update(this.runs[index]);
  }
}
