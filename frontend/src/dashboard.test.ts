import { describe, expect, it } from 'vitest';
import {
  aggregateDashboardTotals,
  describeMentionStatus,
  filterCompanies,
  sortCompanies,
} from './dashboard';
import type { CompanySummaryDto } from './types';

function makeCompany(overrides: Partial<CompanySummaryDto>): CompanySummaryDto {
  return {
    slug: 'acme',
    name: 'Acme',
    formerNames: [],
    status: { lastMentionedAt: null, daysSinceLastMention: null, band: 'none' },
    quarter: { total: 0, positive: 0, negative: 0, neutral: 0 },
    ...overrides,
  };
}

describe('describeMentionStatus', () => {
  it('reads "No coverage found" when there is no last mention', () => {
    expect(describeMentionStatus(null)).toBe('No coverage found');
  });

  it('reads "Today" for a mention published today', () => {
    expect(describeMentionStatus(0)).toBe('Today');
  });

  it('reads "1 day ago" for exactly one day, singular', () => {
    expect(describeMentionStatus(1)).toBe('1 day ago');
  });

  it.each([3, 45, 120])('reads "%s days ago" for %s days, plural', (days) => {
    expect(describeMentionStatus(days)).toBe(`${days} days ago`);
  });
});

describe('aggregateDashboardTotals', () => {
  it('sums each Sentiment across companies and counts companies with no coverage', () => {
    const companies = [
      makeCompany({
        slug: 'a',
        status: { lastMentionedAt: '2026-10-01T00:00:00.000Z', daysSinceLastMention: 5, band: 'fresh' },
        quarter: { total: 12, positive: 7, negative: 2, neutral: 3 },
      }),
      makeCompany({
        slug: 'b',
        status: { lastMentionedAt: null, daysSinceLastMention: null, band: 'none' },
        quarter: { total: 0, positive: 0, negative: 0, neutral: 0 },
      }),
      makeCompany({
        slug: 'c',
        status: { lastMentionedAt: null, daysSinceLastMention: null, band: 'none' },
        quarter: { total: 3, positive: 0, negative: 3, neutral: 0 },
      }),
    ];

    expect(aggregateDashboardTotals(companies)).toEqual({
      quarter: { total: 15, positive: 7, negative: 5, neutral: 3 },
      uncoveredCount: 2,
    });
  });

  it('returns all-zero totals for an empty company list', () => {
    expect(aggregateDashboardTotals([])).toEqual({
      quarter: { total: 0, positive: 0, negative: 0, neutral: 0 },
      uncoveredCount: 0,
    });
  });
});

describe('sortCompanies', () => {
  const alpha = makeCompany({
    slug: 'alpha',
    name: 'Alpha',
    status: { lastMentionedAt: '2026-10-05T00:00:00.000Z', daysSinceLastMention: 1, band: 'fresh' },
    quarter: { total: 5, positive: 1, negative: 4, neutral: 0 },
  });
  const beta = makeCompany({
    slug: 'beta',
    name: 'Beta',
    status: { lastMentionedAt: '2026-09-01T00:00:00.000Z', daysSinceLastMention: 35, band: 'quiet' },
    quarter: { total: 10, positive: 10, negative: 0, neutral: 0 },
  });
  const gamma = makeCompany({
    slug: 'gamma',
    name: 'Gamma',
    status: { lastMentionedAt: null, daysSinceLastMention: null, band: 'none' },
    quarter: { total: 0, positive: 0, negative: 0, neutral: 0 },
  });

  it('sorts by name ascending and descending', () => {
    expect(sortCompanies([gamma, alpha, beta], 'name', 'asc').map((c) => c.slug)).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
    expect(sortCompanies([gamma, alpha, beta], 'name', 'desc').map((c) => c.slug)).toEqual([
      'gamma',
      'beta',
      'alpha',
    ]);
  });

  it('sorts by last mentioned, treating "no coverage" as the oldest', () => {
    expect(sortCompanies([beta, alpha, gamma], 'lastMentioned', 'asc').map((c) => c.slug)).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
  });

  it('sorts by Quarter total', () => {
    expect(sortCompanies([alpha, beta, gamma], 'total', 'desc').map((c) => c.slug)).toEqual([
      'beta',
      'alpha',
      'gamma',
    ]);
  });

  it('sorts by negative count', () => {
    expect(sortCompanies([alpha, beta, gamma], 'negative', 'desc').map((c) => c.slug)).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [beta, alpha];
    sortCompanies(input, 'name', 'asc');
    expect(input).toEqual([beta, alpha]);
  });
});

describe('filterCompanies', () => {
  const lifeward = makeCompany({
    slug: 'lifeward',
    name: 'Lifeward',
    formerNames: ['ReWalk'],
    status: { lastMentionedAt: '2026-10-01T00:00:00.000Z', daysSinceLastMention: 5, band: 'fresh' },
  });
  const quietCo = makeCompany({
    slug: 'quiet-co',
    name: 'Quiet Co',
    status: { lastMentionedAt: null, daysSinceLastMention: null, band: 'none' },
  });

  it('matches companies by name, case-insensitively', () => {
    expect(filterCompanies([lifeward, quietCo], { text: 'life', band: 'all' })).toEqual([lifeward]);
  });

  it('matches companies by a former name', () => {
    expect(filterCompanies([lifeward, quietCo], { text: 'rewalk', band: 'all' })).toEqual([lifeward]);
  });

  it('filters by status band', () => {
    expect(filterCompanies([lifeward, quietCo], { text: '', band: 'none' })).toEqual([quietCo]);
  });

  it('combines text and band filters', () => {
    expect(filterCompanies([lifeward, quietCo], { text: 'quiet', band: 'none' })).toEqual([quietCo]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterCompanies([lifeward, quietCo], { text: 'nonexistent', band: 'all' })).toEqual([]);
  });
});
