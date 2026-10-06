import { Logger } from '@nestjs/common';
import { CronJob } from 'cron';
import { RunAlreadyInProgressError } from './run.repository.js';
import { CronJobRegistry, RunScheduler } from './run.scheduler.js';
import { RunService } from './run.service.js';

class FakeCronJobRegistry implements CronJobRegistry {
  readonly registered: { name: string; job: CronJob }[] = [];

  addCronJob(name: string, job: CronJob): void {
    this.registered.push({ name, job });
  }
}

describe('RunScheduler', () => {
  it('does not register a cron job when the scheduler is disabled', () => {
    const registry = new FakeCronJobRegistry();
    const scheduler = new RunScheduler({} as RunService, registry, false, '0 6 * * *');

    scheduler.onModuleInit();

    expect(registry.registered).toHaveLength(0);
  });

  it('registers a started cron job with the configured expression when enabled', () => {
    const registry = new FakeCronJobRegistry();
    const scheduler = new RunScheduler({} as RunService, registry, true, '0 6 * * *');

    scheduler.onModuleInit();

    expect(registry.registered).toHaveLength(1);
    expect(registry.registered[0]?.name).toBe('run');
    expect(registry.registered[0]?.job.isActive).toBe(true);
    void registry.registered[0]?.job.stop();
  });

  it('a scheduled tick that throws is caught and logged, not left unhandled', async () => {
    const registry = new FakeCronJobRegistry();
    const calls: string[] = [];
    const failingRunService = {
      execute: (trigger: string) => {
        calls.push(trigger);
        return Promise.reject(new Error('ollama unreachable'));
      },
    } as unknown as RunService;
    const scheduler = new RunScheduler(failingRunService, registry, true, '0 6 * * *');

    scheduler.onModuleInit();
    const [{ job }] = registry.registered;
    await job.fireOnTick();

    expect(calls).toEqual(['schedule']);
    void job.stop();
  });

  it(
    'a tick that overlaps a running Run logs a warning without a stack, not an error ' +
      '(review suggestion) — RunAlreadyInProgressError is the expected fail-fast path',
    async () => {
      const registry = new FakeCronJobRegistry();
      const lockedRunService = {
        execute: () =>
          Promise.reject(new RunAlreadyInProgressError('A Run already holds the lock')),
      } as unknown as RunService;
      const scheduler = new RunScheduler(lockedRunService, registry, true, '0 6 * * *');

      const warnCalls: unknown[][] = [];
      const errorCalls: unknown[][] = [];
      // eslint-disable-next-line @typescript-eslint/unbound-method -- stored only to be restored, never called unbound
      const originalWarn = Logger.prototype.warn;
      // eslint-disable-next-line @typescript-eslint/unbound-method -- stored only to be restored, never called unbound
      const originalError = Logger.prototype.error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Logger.prototype.warn = function (...args: unknown[]): any {
        warnCalls.push(args);
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Logger.prototype.error = function (...args: unknown[]): any {
        errorCalls.push(args);
      };

      try {
        scheduler.onModuleInit();
        const [{ job }] = registry.registered;
        await job.fireOnTick();
        void job.stop();
      } finally {
        Logger.prototype.warn = originalWarn;
        Logger.prototype.error = originalError;
      }

      expect(errorCalls).toHaveLength(0);
      expect(warnCalls.some((args) => String(args[0]).includes('Scheduled Run skipped'))).toBe(
        true,
      );
    },
  );
});
