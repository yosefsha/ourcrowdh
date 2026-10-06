import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CompaniesCliModule } from './companies/companies-cli.module.js';
import configuration from './config/configuration.js';
import { validationSchema } from './config/validation.js';
import { DatabaseModule } from './database/database.module.js';

/**
 * Root module for the CLI shell (`npm run cli`, `docs/PLAN.md#decisions`:
 * "One entry point, `cli run`"). A separate application context from
 * `AppModule` — `CommandFactory.run` never boots the HTTP app — so it wires
 * its own `ConfigModule` and `DatabaseModule` rather than importing
 * `AppModule`'s.
 *
 * `cli seed` (Seed loader) is registered via `CompaniesCliModule`; `cli run`
 * (Run orchestrator) adds its own CLI module import here once it exists.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    DatabaseModule,
    CompaniesCliModule,
  ],
})
export class CliModule {}
