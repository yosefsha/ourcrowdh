import { SeedEntry, TrackedCompany } from './company.js';

/**
 * Port for the persisted Tracked Company list (`docs/PLAN.md#ports`). Bound
 * to a concrete implementation in `companies.module.ts` by the Seed loader
 * issue — this file only defines the contract and its injection token.
 */
export const COMPANY_REPOSITORY = Symbol('COMPANY_REPOSITORY');

export interface CompanyRepository {
  /**
   * Upserts on `slug`: a new slug is inserted, an existing one is updated
   * in place (same id). Deliberately not a sync — a slug present in a
   * previous seed but absent from `entries` is left untouched. The Company
   * List has no concept of "removed", only renamed/re-disambiguated, and a
   * seed loader silently deleting a row on a transcription mistake in the
   * source file would be worse than leaving a stale row for a human to
   * notice.
   */
  upsertAll(entries: readonly SeedEntry[]): Promise<void>;
  /** Ordered by `name`, ascending — every implementation must agree, since
   * a caller (a future dashboard listing) will render this order as-is. */
  findAll(): Promise<readonly TrackedCompany[]>;
}
