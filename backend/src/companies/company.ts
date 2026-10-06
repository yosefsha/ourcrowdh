/**
 * Domain shapes for a Tracked Company (`CONTEXT.md#companies`). `TrackedCompany`
 * is what every port returns; `SeedEntry` is what the company list seed file
 * provides before it has been assigned a database id.
 */
export interface TrackedCompany {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly formerNames: readonly string[];
  readonly disambiguator: string | null;
}

export interface SeedEntry {
  readonly slug: string;
  readonly name: string;
  readonly formerNames: readonly string[];
  readonly disambiguator: string | null;
}
