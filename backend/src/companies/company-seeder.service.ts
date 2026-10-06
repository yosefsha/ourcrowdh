import { readFile } from 'fs/promises';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration.js';
import { COMPANY_REPOSITORY } from './company.repository.js';
import type { CompanyRepository } from './company.repository.js';
import { parseCompanyList } from './parse-company-list.js';

/**
 * Loads `COMPANIES_FILE` and upserts it into the Tracked Company list
 * (`docs/PLAN.md#decisions`: "`cli seed` upserts the company list"). Driven
 * by `SeedCommand` (`cli seed`) and by nothing else — a Run reads Tracked
 * Companies, it never seeds.
 *
 * A missing or unreadable file fails loudly: the error is rethrown with the
 * resolved path attached rather than left as a bare `ENOENT`, but the seed
 * is never silently skipped.
 */
@Injectable()
export class CompanySeeder {
  private readonly logger = new Logger(CompanySeeder.name);

  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async seed(): Promise<number> {
    const path = this.configService.get('companiesFile', { infer: true });

    let text: string;
    try {
      text = await readFile(path, { encoding: 'utf-8' });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Cannot read the company list at "${path}": ${reason}`, { cause: error });
    }

    const entries = parseCompanyList(text);
    await this.companies.upsertAll(entries);

    this.logger.log(`Seeded ${entries.length} companies from "${path}"`);
    return entries.length;
  }
}
