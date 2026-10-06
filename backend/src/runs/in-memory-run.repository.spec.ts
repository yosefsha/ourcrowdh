import { RunAlreadyInProgressError, RunCounts } from './run.repository.js';
import { InMemoryRunRepository } from './in-memory-run.repository.js';

const zeroCounts: RunCounts = {
  articlesFetched: 0,
  mentionsDiscovered: 0,
  mentionsClassified: 0,
  classificationFailures: 0,
  newMentions: 0,
};

describe('InMemoryRunRepository', () => {
  describe('withLock', () => {
    it('runs the work and releases the lock afterwards', async () => {
      const repository = new InMemoryRunRepository();

      const result = await repository.withLock(() => Promise.resolve('done'));

      expect(result).toBe('done');
      // The lock was released — a second, non-nested call succeeds too.
      await expect(repository.withLock(() => Promise.resolve('done again'))).resolves.toBe(
        'done again',
      );
    });

    it('rejects a nested call with RunAlreadyInProgressError', async () => {
      const repository = new InMemoryRunRepository();

      await expect(
        repository.withLock(() => repository.withLock(() => Promise.resolve('inner'))),
      ).rejects.toBeInstanceOf(RunAlreadyInProgressError);
    });

    it('releases the lock even when the work throws', async () => {
      const repository = new InMemoryRunRepository();

      await expect(repository.withLock(() => Promise.reject(new Error('boom')))).rejects.toThrow(
        'boom',
      );

      await expect(repository.withLock(() => Promise.resolve('ok'))).resolves.toBe('ok');
    });
  });

  describe('start / finish / fail / list', () => {
    it('starts a run with status "running" and zeroed counts', async () => {
      const repository = new InMemoryRunRepository();

      const run = await repository.start('cli');

      expect(run.status).toBe('running');
      expect(run.trigger).toBe('cli');
      expect(run.finishedAt).toBeNull();
      expect(run.articlesFetched).toBe(0);
    });

    it('finish marks a run succeeded with the given counts', async () => {
      const repository = new InMemoryRunRepository();
      const run = await repository.start('manual');

      await repository.finish(run.id, { ...zeroCounts, articlesFetched: 5, newMentions: 2 });

      const [listed] = await repository.list(10);
      expect(listed).toMatchObject({
        id: run.id,
        status: 'succeeded',
        articlesFetched: 5,
        newMentions: 2,
        error: null,
      });
      expect(listed.finishedAt).not.toBeNull();
    });

    it('fail marks a run failed with the error message and counts', async () => {
      const repository = new InMemoryRunRepository();
      const run = await repository.start('schedule');

      await repository.fail(run.id, 'ollama unreachable', zeroCounts);

      const [listed] = await repository.list(10);
      expect(listed).toMatchObject({ id: run.id, status: 'failed', error: 'ollama unreachable' });
    });

    it('finish on an unknown run id throws', async () => {
      const repository = new InMemoryRunRepository();

      await expect(repository.finish('does-not-exist', zeroCounts)).rejects.toThrow();
    });

    it('list returns runs most-recently-started first, limited', async () => {
      const repository = new InMemoryRunRepository();
      const first = await repository.start('cli');
      await new Promise((resolve) => setTimeout(resolve, 2));
      const second = await repository.start('cli');

      const listed = await repository.list(1);

      expect(listed).toHaveLength(1);
      expect(listed[0]?.id).toBe(second.id);
      expect(listed[0]?.id).not.toBe(first.id);
    });
  });

  describe('lastSuccessfulStart', () => {
    it('returns null when no run has succeeded', async () => {
      const repository = new InMemoryRunRepository();
      const run = await repository.start('cli');
      await repository.fail(run.id, 'boom', zeroCounts);

      await expect(repository.lastSuccessfulStart()).resolves.toBeNull();
    });

    it('returns the startedAt of the most recent succeeded run', async () => {
      const repository = new InMemoryRunRepository();
      const first = await repository.start('cli');
      await repository.finish(first.id, zeroCounts);
      await new Promise((resolve) => setTimeout(resolve, 2));
      const second = await repository.start('cli');
      await repository.finish(second.id, zeroCounts);

      await expect(repository.lastSuccessfulStart()).resolves.toEqual(second.startedAt);
    });
  });
});
