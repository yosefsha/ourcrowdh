import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { companiesFixture, companyDetailFixture, runsFixture, startedRunFixture } from '../mocks/fixtures';
import { runAlreadyInProgressHandler } from '../mocks/handlers';
import { server } from '../mocks/server';
import { ApiError } from './client';
import { useCompanies, useCompany, useRuns, useStartRun } from './hooks';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useCompanies', () => {
  it('resolves with the companies envelope, including a company with no coverage', async () => {
    const { result } = renderHook(() => useCompanies(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(companiesFixture);
    expect(result.current.data?.companies.some((company) => company.status.band === 'none')).toBe(
      true,
    );
  });
});

describe('useCompany', () => {
  it('resolves with the company detail envelope for a known slug', async () => {
    const { result } = renderHook(() => useCompany('lifeward'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(companyDetailFixture);
  });

  it('surfaces a 404 as an ApiError for an unknown slug', async () => {
    const { result } = renderHook(() => useCompany('does-not-exist'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.status).toBe(404);
  });
});

describe('useRuns', () => {
  it('resolves with the runs envelope', async () => {
    const { result } = renderHook(() => useRuns(10), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(runsFixture);
  });

  it.each([0, 51, 2.5, Number.NaN])('rejects limit %s outside the API range 1–50', (limit) => {
    expect(() => renderHook(() => useRuns(limit), { wrapper: createWrapper() })).toThrow(
      RangeError,
    );
  });

  it.each([1, 50])('accepts the boundary limit %s', async (limit) => {
    const { result } = renderHook(() => useRuns(limit), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useStartRun', () => {
  it('resolves with the started Run on success', async () => {
    const { result } = renderHook(() => useStartRun(), { wrapper: createWrapper() });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(startedRunFixture);
  });

  it('surfaces a 409 as a distinguishable ApiError when a Run is already in progress', async () => {
    server.use(runAlreadyInProgressHandler);

    const { result } = renderHook(() => useStartRun(), { wrapper: createWrapper() });

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.status).toBe(409);
  });
});
