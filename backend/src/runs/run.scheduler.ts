import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronJob } from 'cron';
import { RunAlreadyInProgressError } from './run.repository.js';
import { RunService } from './run.service.js';

/**
 * The slice of `@nestjs/schedule`'s `SchedulerRegistry` this class needs —
 * naming it locally (interface segregation) means a test can hand in a bare
 * object with one method instead of a real `SchedulerRegistry`.
 */
export interface CronJobRegistry {
  addCronJob(name: string, job: CronJob): void;
}

const RUN_CRON_JOB_NAME = 'run';

/**
 * Registers the scheduled Run cron job only when `SCHEDULER_ENABLED=true`
 * (`docs/PLAN.md#decisions`: "Locally triggered by `@nestjs/schedule` when
 * `SCHEDULER_ENABLED=true`"). Registered programmatically through
 * `SchedulerRegistry`, rather than a static `@Cron()` decorator: the cron
 * expression comes from `ConfigService` at runtime, and the decorator form
 * always registers — there is no way to make it conditional.
 */
@Injectable()
export class RunScheduler implements OnModuleInit {
  private readonly logger = new Logger(RunScheduler.name);

  constructor(
    private readonly runService: RunService,
    private readonly schedulerRegistry: CronJobRegistry,
    private readonly schedulerEnabled: boolean,
    private readonly runCron: string,
  ) {}

  onModuleInit(): void {
    if (!this.schedulerEnabled) {
      return;
    }
    const job = CronJob.from({
      cronTime: this.runCron,
      onTick: () => {
        this.runService.execute('schedule').catch((error: unknown) => {
          if (error instanceof RunAlreadyInProgressError) {
            // Expected fail-fast path — a manual or CLI Run (or a previous
            // tick that overran) already holds the lock. A warning without
            // a stack trace says so without looking like an application bug.
            this.logger.warn(`Scheduled Run skipped: ${error.message}`);
            return;
          }
          this.logger.error(
            'Scheduled Run failed',
            error instanceof Error ? error.stack : String(error),
          );
        });
      },
      start: true,
    });
    this.schedulerRegistry.addCronJob(RUN_CRON_JOB_NAME, job);
    this.logger.log(`Scheduled Run registered: "${this.runCron}"`);
  }
}
