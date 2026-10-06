// Pure helpers backing the Dashboard page — presentation rules, sorting,
// filtering and aggregation over CompanySummaryDto[]. Kept free of React so
// they can be unit-tested directly and reused by any component that needs
// them (docs/coding-instructions.md: parsing/transformation stays in pure
// functions outside components).

import type { CompanySummaryDto, SentimentCountsDto, StatusBand } from './types';

// ---------------------------------------------------------------------------
// Mention Status wording (CONTEXT.md#mention-status)
// ---------------------------------------------------------------------------

/**
 * Renders a MentionStatusDto as the wording a reviewer reads on the
 * dashboard: "Today" / "1 day ago" / "45 days ago" / "No coverage found".
 */
export function describeMentionStatus(daysSinceLastMention: number | null): string {
  if (daysSinceLastMention === null) {
    return 'No coverage found';
  }
  if (daysSinceLastMention === 0) {
    return 'Today';
  }
  if (daysSinceLastMention === 1) {
    return '1 day ago';
  }
  return `${daysSinceLastMention} days ago`;
}

// ---------------------------------------------------------------------------
// Status band presentation — colour is never the only signal: every band
// also carries a distinct symbol and label so the badge reads correctly
// without colour.
// ---------------------------------------------------------------------------

export interface StatusBandPresentation {
  readonly label: string;
  readonly symbol: string;
  readonly background: string;
  readonly foreground: string;
}

export const STATUS_BAND_PRESENTATION: Readonly<Record<StatusBand, StatusBandPresentation>> = {
  fresh: { label: 'Fresh', symbol: '●', background: '#d3f9d8', foreground: '#2b8a3e' },
  recent: { label: 'Recent', symbol: '◐', background: '#d0ebff', foreground: '#1864ab' },
  quiet: { label: 'Quiet', symbol: '◔', background: '#fff3bf', foreground: '#996a13' },
  dormant: { label: 'Dormant', symbol: '○', background: '#e9ecef', foreground: '#495057' },
  none: { label: 'No coverage found', symbol: '✕', background: '#ffe3e3', foreground: '#c92a2a' },
};

export const STATUS_BAND_ORDER: readonly StatusBand[] = ['fresh', 'recent', 'quiet', 'dormant', 'none'];

// ---------------------------------------------------------------------------
// Header totals
// ---------------------------------------------------------------------------

export interface DashboardTotals {
  readonly quarter: SentimentCountsDto;
  readonly uncoveredCount: number;
}

/** Aggregates per-company Quarter counts and the no-coverage count for the dashboard header. */
export function aggregateDashboardTotals(companies: readonly CompanySummaryDto[]): DashboardTotals {
  const quarter = companies.reduce<SentimentCountsDto>(
    (totals, company) => ({
      total: totals.total + company.quarter.total,
      positive: totals.positive + company.quarter.positive,
      negative: totals.negative + company.quarter.negative,
      neutral: totals.neutral + company.quarter.neutral,
    }),
    { total: 0, positive: 0, negative: 0, neutral: 0 },
  );
  const uncoveredCount = companies.filter((company) => company.status.band === 'none').length;

  return { quarter, uncoveredCount };
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export type CompanySortKey = 'name' | 'lastMentioned' | 'total' | 'negative';
export type SortDirection = 'asc' | 'desc';

function assertNever(value: never): never {
  throw new Error(`Unreachable sort key: ${String(value)}`);
}

/** Null `daysSinceLastMention` ("No coverage found") sorts as the oldest possible status. */
function compareLastMentioned(a: CompanySummaryDto, b: CompanySummaryDto): number {
  const aDays = a.status.daysSinceLastMention ?? Number.POSITIVE_INFINITY;
  const bDays = b.status.daysSinceLastMention ?? Number.POSITIVE_INFINITY;
  return aDays - bDays;
}

function compareCompanies(a: CompanySummaryDto, b: CompanySummaryDto, key: CompanySortKey): number {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name);
    case 'lastMentioned':
      return compareLastMentioned(a, b);
    case 'total':
      return a.quarter.total - b.quarter.total;
    case 'negative':
      return a.quarter.negative - b.quarter.negative;
    default:
      return assertNever(key);
  }
}

/**
 * Sorts a copy of `companies` — never mutates its argument. Negates the
 * comparator for `desc` rather than reversing the ascending result, so tied
 * companies (e.g. the same negative count) keep their original relative
 * order in both directions — `Array.prototype.sort` is a stable sort.
 */
export function sortCompanies(
  companies: readonly CompanySummaryDto[],
  key: CompanySortKey,
  direction: SortDirection,
): CompanySummaryDto[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...companies].sort((a, b) => multiplier * compareCompanies(a, b, key));
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export type CompanyBandFilter = StatusBand | 'all';

export interface CompanyFilter {
  readonly text: string;
  readonly band: CompanyBandFilter;
}

function matchesText(company: CompanySummaryDto, text: string): boolean {
  const needle = text.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  return [company.name, ...company.formerNames].some((value) => value.toLowerCase().includes(needle));
}

function matchesBand(company: CompanySummaryDto, band: CompanyBandFilter): boolean {
  return band === 'all' || company.status.band === band;
}

/** Filters by name/former-name substring (case-insensitive) and by status band. */
export function filterCompanies(
  companies: readonly CompanySummaryDto[],
  filter: CompanyFilter,
): CompanySummaryDto[] {
  return companies.filter((company) => matchesText(company, filter.text) && matchesBand(company, filter.band));
}
