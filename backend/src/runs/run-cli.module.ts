import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RunCommand } from './run.command.js';
import { runPortImports, runRepositoryProvider, runServiceProvider } from './run.providers.js';
import { RunEntity } from './run.entity.js';

/**
 * The CLI-facing Run feature module — `CliModule` imports this for
 * `cli run` instead of `RunsModule`. Same `RunService`/`RUN_REPOSITORY`
 * wiring (`run.providers.ts`), deliberately without `RunScheduler`: a cron
 * job registered inside a one-shot `cli run` invocation would keep the
 * process alive after the command finishes, since `@nestjs/schedule`'s
 * timer is never cleared.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RunEntity]), ...runPortImports],
  providers: [runRepositoryProvider, runServiceProvider, RunCommand],
})
export class RunCliModule {}
