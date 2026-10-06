import { CronJob } from 'cron';
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
});
