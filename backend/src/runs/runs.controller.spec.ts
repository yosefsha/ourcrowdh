import { ConflictException } from '@nestjs/common';
import { RunAlreadyInProgressError, RunRecord } from './run.repository.js';
import { RunService } from './run.service.js';
import { RunsController } from './runs.controller.js';

const sampleRun: RunRecord = {
  id: 'run-1',
  trigger: 'manual',
  status: 'running',
  startedAt: new Date('2026-01-01T00:00:00Z'),
  finishedAt: null,
  articlesFetched: 0,
  mentionsDiscovered: 0,
  mentionsClassified: 0,
  classificationFailures: 0,
  newMentions: 0,
  error: null,
};

/** A minimal RunService stand-in — the controller only calls `list` and
 * `startInBackground`, so there is no need to build a full RunService with
 * all six ports wired just to test the controller's thin mapping logic. */
class FakeRunService {
  constructor(
    private readonly listResult: readonly RunRecord[] = [],
    private readonly startResult: RunRecord | Error = sampleRun,
  ) {}

  async list(): Promise<readonly RunRecord[]> {
    return Promise.resolve(this.listResult);
  }

  async startInBackground(): Promise<RunRecord> {
    if (this.startResult instanceof Error) {
      throw this.startResult;
    }
    return Promise.resolve(this.startResult);
  }
}

describe('RunsController', () => {
  describe('list', () => {
    it('maps RunRecords to RunDto and wraps them in { runs }', async () => {
      const controller = new RunsController(
        new FakeRunService([sampleRun]) as unknown as RunService,
      );

      const response = await controller.list({ limit: 10 });

      expect(response.runs).toHaveLength(1);
      expect(response.runs[0]).toMatchObject({ id: 'run-1', status: 'running' });
      expect(response.runs[0]?.startedAt).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('trigger', () => {
    it('returns the started RunDto on success', async () => {
      const controller = new RunsController(
        new FakeRunService([], sampleRun) as unknown as RunService,
      );

      const response = await controller.trigger();

      expect(response).toMatchObject({ id: 'run-1', status: 'running', trigger: 'manual' });
    });

    it('maps RunAlreadyInProgressError to a 409 ConflictException', async () => {
      const controller = new RunsController(
        new FakeRunService([], new RunAlreadyInProgressError('locked')) as unknown as RunService,
      );

      await expect(controller.trigger()).rejects.toBeInstanceOf(ConflictException);
    });

    it('propagates an unrelated error unchanged', async () => {
      const controller = new RunsController(
        new FakeRunService([], new Error('boom')) as unknown as RunService,
      );

      await expect(controller.trigger()).rejects.toThrow('boom');
    });
  });
});
