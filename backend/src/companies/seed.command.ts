import { Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { CompanySeeder } from './company-seeder.service.js';

/**
 * `cli seed` (`node dist/cli.js seed`) — upserts the Tracked Company list
 * from `COMPANIES_FILE` (`docs/PLAN.md#decisions`). Run by compose's
 * `migrate` service on every `up`, and safe to run again by hand: seeding
 * twice never duplicates a row.
 *
 * Thin by design: `CompanySeeder.seed()` already logs its own result, so
 * this command does not log a second, identical confirmation line.
 */
@Injectable()
@Command({ name: 'seed', description: 'Seed the Tracked Company list from COMPANIES_FILE' })
export class SeedCommand extends CommandRunner {
  constructor(private readonly companySeeder: CompanySeeder) {
    super();
  }

  async run(): Promise<void> {
    await this.companySeeder.seed();
  }
}
