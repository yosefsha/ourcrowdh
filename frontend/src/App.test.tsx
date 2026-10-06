import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from './App';

// The Dashboard page fetches through React Query, so AppRoutes needs a
// QueryClientProvider ancestor here just as it gets one from App itself.
function renderRoutes(initialEntries: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppRoutes', () => {
  it('renders the dashboard page at /', () => {
    renderRoutes(['/']);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('renders the company page stub at /companies/:slug', () => {
    renderRoutes(['/companies/lifeward']);

    expect(screen.getByRole('heading', { name: 'Company' })).toBeInTheDocument();
  });

  it('renders the not-found page for an unknown path', () => {
    renderRoutes(['/nope']);

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
