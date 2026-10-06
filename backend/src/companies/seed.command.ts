import { Injectable, Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { CompanySeeder } from './company-seeder.service.js';

/**
 * `cli seed` (`node dist/cli.js seed`) — upserts the Tracked Company list
 * from `COMPANIES_FILE` (`docs/PLAN.md#decisions`). Run by compose's
 * `migrate` service on every `up`, and safe to run again by hand: seeding
 * twice never duplicates a row.
 */
@Injectable()
@Command({ name: 'seed', description: 'Seed the Tracked Company list from COMPANIES_FILE' })
export class SeedCommand extends CommandRunner {
  private readonly logger = new Logger(SeedCommand.name);

  constructor(private readonly companySeeder: CompanySeeder) {
    super();
  }

  async run(): Promise<void> {
    const count = await this.companySeeder.seed();
    this.logger.log(`Seeded ${count} companies`);
  }
}
