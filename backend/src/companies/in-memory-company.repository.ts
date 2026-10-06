import { randomUUID } from 'crypto';
import { SeedEntry, TrackedCompany } from './company.js';
import { CompanyRepository } from './company.repository.js';

/**
 * In-memory fake for `CompanyRepository` — the reference other issues' unit
 * tests run against via `overrideProvider(COMPANY_REPOSITORY)`.
 *
 * `upsertAll` is keyed on `slug`: seeding the same slug twice updates the
 * existing record in place and keeps its id, matching what the real
 * (Postgres) `ON CONFLICT (slug) DO UPDATE` upsert will do.
 */
export class InMemoryCompanyRepository implements CompanyRepository {
  private readonly bySlug = new Map<string, TrackedCompany>();

  async upsertAll(entries: readonly SeedEntry[]): Promise<void> {
    for (const entry of entries) {
      const existing = this.bySlug.get(entry.slug);
      this.bySlug.set(entry.slug, {
        id: existing?.id ?? randomUUID(),
        slug: entry.slug,
        name: entry.name,
        formerNames: entry.formerNames,
        disambiguator: entry.disambiguator,
      });
    }
    return Promise.resolve();
  }

  async findAll(): Promise<readonly TrackedCompany[]> {
    return Promise.resolve(Array.from(this.bySlug.values()));
  }
}
