import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../config/configuration.js';
import { runPortImports, runRepositoryProvider, runServiceProvider } from './run.providers.js';
import { RunScheduler } from './run.scheduler.js';
import { RunEntity } from './run.entity.js';
import { RunService } from './run.service.js';
import { RunsController } from './runs.controller.js';
import { RUN_REPOSITORY } from './run.repository.js';

/**
 * The HTTP-facing Run feature module — `AppModule` imports this one.
 * `cli run` goes through `RunCliModule` instead (same `RunService`
 * provider, no scheduler): see `run.providers.ts` and `run.scheduler.ts`
 * for why the scheduler only belongs here.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RunEntity]), ScheduleModule.forRoot(), ...runPortImports],
  controllers: [RunsController],
  providers: [
    runRepositoryProvider,
    runServiceProvider,
    {
      provide: RunScheduler,
      useFactory: (
        runService: RunService,
        schedulerRegistry: SchedulerRegistry,
        config: ConfigService<AppConfig, true>,
      ): RunScheduler =>
        new RunScheduler(
          runService,
          schedulerRegistry,
          config.get('schedulerEnabled', { infer: true }),
          config.get('runCron', { infer: true }),
        ),
      inject: [RunService, SchedulerRegistry, ConfigService],
    },
  ],
  exports: [RUN_REPOSITORY],
})
export class RunsModule {}
