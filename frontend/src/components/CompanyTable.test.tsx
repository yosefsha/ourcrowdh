import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { CompanySummaryDto } from '../types';
import { CompanyTable } from './CompanyTable';

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

const lifeward = makeCompany({
  slug: 'lifeward',
  name: 'Lifeward',
  formerNames: ['ReWalk'],
  status: { lastMentionedAt: '2026-10-01T00:00:00.000Z', daysSinceLastMention: 5, band: 'fresh' },
  quarter: { total: 12, positive: 7, negative: 2, neutral: 3 },
});

const quietCo = makeCompany({
  slug: 'quiet-co',
  name: 'Quiet Co',
  status: { lastMentionedAt: null, daysSinceLastMention: null, band: 'none' },
  quarter: { total: 0, positive: 0, negative: 0, neutral: 0 },
});

const brightLabs = makeCompany({
  slug: 'bright-labs',
  name: 'Bright Labs',
  status: { lastMentionedAt: '2026-08-01T00:00:00.000Z', daysSinceLastMention: 45, band: 'quiet' },
  quarter: { total: 5, positive: 0, negative: 5, neutral: 0 },
});

function renderTable(companies: CompanySummaryDto[]) {
  return render(
    <MemoryRouter>
      <CompanyTable companies={companies} />
    </MemoryRouter>,
  );
}

describe('CompanyTable', () => {
  it('renders every company, linking its name to /companies/:slug', () => {
    renderTable([lifeward, quietCo, brightLabs]);

    expect(screen.getByRole('link', { name: 'Lifeward' })).toHaveAttribute('href', '/companies/lifeward');
    expect(screen.getByText('formerly ReWalk')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quiet Co' })).toHaveAttribute('href', '/companies/quiet-co');
  });

  it('shows "No coverage found" for a company with status band "none"', () => {
    renderTable([lifeward, quietCo]);

    const row = screen.getByRole('link', { name: 'Quiet Co' }).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('No coverage found')).toBeInTheDocument();
  });

  it('filters by name and former name as the user types', async () => {
    const user = userEvent.setup();
    renderTable([lifeward, quietCo, brightLabs]);

    await user.type(screen.getByLabelText('Search'), 'rewalk');

    expect(screen.getByRole('link', { name: 'Lifeward' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Quiet Co' })).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 3 companies')).toBeInTheDocument();
  });

  it('filters by status band', async () => {
    const user = userEvent.setup();
    renderTable([lifeward, quietCo, brightLabs]);

    await user.selectOptions(screen.getByLabelText('Status'), 'No coverage found');

    expect(screen.getByRole('link', { name: 'Quiet Co' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Lifeward' })).not.toBeInTheDocument();
  });

  it('shows an empty-results message when no company matches the filter', async () => {
    const user = userEvent.setup();
    renderTable([lifeward, quietCo, brightLabs]);

    await user.type(screen.getByLabelText('Search'), 'nonexistent company');

    expect(screen.getByText('No companies match this search.')).toBeInTheDocument();
  });

  it('sorts by a column when its header is clicked, toggling direction on a second click', async () => {
    const user = userEvent.setup();
    renderTable([lifeward, quietCo, brightLabs]);

    // quarter.total: quietCo 0, brightLabs 5, lifeward 12
    const quarterHeader = screen.getByRole('button', { name: 'Sort by Quarter' });
    await user.click(quarterHeader);

    let links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Quiet Co', 'Bright Labs', 'Lifeward']);

    await user.click(quarterHeader);

    links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Lifeward', 'Bright Labs', 'Quiet Co']);
  });

  it('sorts by negative mention count', async () => {
    const user = userEvent.setup();
    renderTable([lifeward, quietCo, brightLabs]);

    await user.click(screen.getByRole('button', { name: 'Sort by Negative' }));
    await user.click(screen.getByRole('button', { name: 'Sort by Negative' }));

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Bright Labs', 'Lifeward', 'Quiet Co']);
  });
});
