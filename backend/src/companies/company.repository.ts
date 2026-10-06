import { SeedEntry, TrackedCompany } from './company.js';

/**
 * Port for the persisted Tracked Company list (`docs/PLAN.md#ports`). Bound
 * to a concrete implementation in `companies.module.ts` by the Seed loader
 * issue — this file only defines the contract and its injection token.
 */
export const COMPANY_REPOSITORY = Symbol('COMPANY_REPOSITORY');

export interface CompanyRepository {
  upsertAll(entries: readonly SeedEntry[]): Promise<void>;
  findAll(): Promise<readonly TrackedCompany[]>;
}
