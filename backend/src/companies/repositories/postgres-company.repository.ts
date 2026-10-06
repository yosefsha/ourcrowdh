import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeedEntry, TrackedCompany } from '../company.js';
import { CompanyEntity } from '../company.entity.js';
import { CompanyRepository } from '../company.repository.js';

function toTrackedCompany(entity: CompanyEntity): TrackedCompany {
  return {
    id: entity.id,
    slug: entity.slug,
    name: entity.name,
    formerNames: entity.formerNames,
    disambiguator: entity.disambiguator,
  };
}

/**
 * Postgres implementation of `CompanyRepository` (`docs/PLAN.md#ports`),
 * bound to `COMPANY_REPOSITORY` in `companies.module.ts`.
 *
 * `upsertAll` issues one `INSERT ... ON CONFLICT (slug) DO UPDATE` statement
 * for the whole batch rather than one round trip per entry. `id` and
 * `created_at` are deliberately left out of the row values: a new slug gets
 * the database's own defaults (a generated id, `created_at = now()`), and
 * because they are absent from the `INSERT` column list, the `ON CONFLICT`
 * clause never touches them for a row that already exists — so re-seeding
 * an edited name updates the existing row in place and keeps its id.
 */
@Injectable()
export class PostgresCompanyRepository implements CompanyRepository {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly repository: Repository<CompanyEntity>,
  ) {}

  async upsertAll(entries: readonly SeedEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const rows = entries.map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      formerNames: [...entry.formerNames],
      disambiguator: entry.disambiguator,
      updatedAt: new Date(),
    }));

    await this.repository.upsert(rows, ['slug']);
  }

  async findAll(): Promise<readonly TrackedCompany[]> {
    // Plain `order: { name: 'ASC' }` sorts under the database's default
    // collation, which disagrees with `InMemoryCompanyRepository`'s plain
    // code-unit comparison for mixed case, punctuation and digits (e.g. a
    // locale-aware collation sorts case-insensitively; "C" does not).
    // `COLLATE "C"` pins Postgres to the same byte/code-point order the
    // fake uses, so every implementation of this port agrees — the ordering
    // the interface promises callers.
    const rows = await this.repository
      .createQueryBuilder('company')
      .orderBy('company.name COLLATE "C"', 'ASC')
      .getMany();
    return rows.map(toTrackedCompany);
  }
}
