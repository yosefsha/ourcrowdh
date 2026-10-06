import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CompanySummaryDto, QuarterDto } from '../types';
import { DashboardHeader } from './DashboardHeader';

const quarter: QuarterDto = { from: '2026-07-08T00:00:00.000Z', to: '2026-10-06T00:00:00.000Z' };

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

describe('DashboardHeader', () => {
  it('shows the Quarter range, the Mentions total and the no-coverage count', () => {
    const companies: CompanySummaryDto[] = [
      makeCompany({
        slug: 'covered',
        status: { lastMentionedAt: '2026-10-01T00:00:00.000Z', daysSinceLastMention: 5, band: 'fresh' },
        quarter: { total: 12, positive: 7, negative: 2, neutral: 3 },
      }),
      makeCompany({ slug: 'uncovered' }),
    ];

    render(<DashboardHeader quarter={quarter} companies={companies} />);

    expect(screen.getByText('Jul 8, 2026 – Oct 6, 2026')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 companies')).toBeInTheDocument();
  });

  it('renders all-zero totals for an empty company list without throwing', () => {
    render(<DashboardHeader quarter={quarter} companies={[]} />);

    expect(screen.getByText('0 of 0 companies')).toBeInTheDocument();
  });
});
