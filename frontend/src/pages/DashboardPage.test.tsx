import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { companiesFixture } from '../mocks/fixtures';
import { server } from '../mocks/server';
import { DashboardPage } from './DashboardPage';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(<DashboardPage />, { wrapper: Wrapper });
}

describe('DashboardPage', () => {
  it('renders every fixture company, including one with no coverage', async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('link', { name: companiesFixture.companies[0].name })).toBeInTheDocument(),
    );

    for (const company of companiesFixture.companies) {
      expect(screen.getByRole('link', { name: company.name })).toHaveAttribute(
        'href',
        `/companies/${company.slug}`,
      );
    }

    // "No coverage found" appears both in the header's count and in the
    // uncovered company's own StatusBadge — assert at least one is present.
    expect(screen.getAllByText('No coverage found').length).toBeGreaterThan(0);
  });

  it('shows an error state when the companies request fails', async () => {
    server.use(http.get('/api/companies', () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Could not load companies: boom')).toBeInTheDocument(),
    );
  });

  it('shows an empty state when there are no tracked companies', async () => {
    server.use(
      http.get('/api/companies', () =>
        HttpResponse.json({ quarter: companiesFixture.quarter, companies: [] }),
      ),
    );
    renderPage();

    await waitFor(() => expect(screen.getByText('No tracked companies found.')).toBeInTheDocument());
  });
});
