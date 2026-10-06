import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration.js';
import { validationSchema } from './config/validation.js';
import { DatabaseModule } from './database/database.module.js';
import { RunCliModule } from './runs/run-cli.module.js';

/**
 * Root module for the CLI shell (`npm run cli`, `docs/PLAN.md#decisions`:
 * "One entry point, `cli run`"). `ConfigModule` and `DatabaseModule` are
 * repeated here (not inherited from `AppModule`) because the CLI boots its
 * own, separate Nest application context via `CommandFactory.run(CliModule,
 * ...)` in `cli.ts` — it never goes through `AppModule`/`main.ts`.
 * `cli run` (Run orchestrator) is the first command; `cli seed` (Seed
 * loader) adds its own import alongside it.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validationSchema }),
    DatabaseModule,
    RunCliModule,
  ],
})
export class CliModule {}
