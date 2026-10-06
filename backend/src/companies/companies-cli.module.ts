import { Module } from '@nestjs/common';
import { CompaniesModule } from './companies.module.js';
import { SeedCommand } from './seed.command.js';

/**
 * CLI-only composition for the Companies domain — imported by `CliModule`,
 * never by `AppModule`. `SeedCommand`'s `nest-commander` `@Command` lives
 * here rather than in `CompaniesModule` so the HTTP app's module graph
 * never pulls in `nest-commander` (see the note on `CompaniesModule`).
 */
@Module({
  imports: [CompaniesModule],
  providers: [SeedCommand],
})
export class CompaniesCliModule {}
