import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { runAlreadyInProgressHandler } from '../mocks/handlers';
import { server } from '../mocks/server';
import type { RunDto } from '../types';
import { RunPanel } from './RunPanel';

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return render(<RunPanel />, { wrapper: Wrapper });
}

const succeededRun: RunDto = {
  id: 'run-0',
  trigger: 'schedule',
  status: 'succeeded',
  startedAt: '2026-10-05T06:00:00.000Z',
  finishedAt: '2026-10-05T06:04:00.000Z',
  articlesFetched: 42,
  mentionsDiscovered: 9,
  mentionsClassified: 9,
  classificationFailures: 0,
  newMentions: 2,
  error: null,
};

const runningRun: RunDto = {
  ...succeededRun,
  id: 'run-1',
  status: 'running',
  finishedAt: null,
};

describe('RunPanel', () => {
  it('shows the latest Run status and counts', async () => {
    server.use(http.get('/api/runs', () => HttpResponse.json({ runs: [succeededRun] })));
    renderPanel();

    await waitFor(() => expect(screen.getByText('Succeeded')).toBeInTheDocument());
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows "No runs yet" when the Run history is empty', async () => {
    server.use(http.get('/api/runs', () => HttpResponse.json({ runs: [] })));
    renderPanel();

    await waitFor(() => expect(screen.getByText('No runs yet.')).toBeInTheDocument());
  });

  it('shows an error state when the Run list fails to load', async () => {
    server.use(http.get('/api/runs', () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    renderPanel();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not load run status'));
  });

  it('disables "Run now" and polls while a Run is running', async () => {
    server.use(http.get('/api/runs', () => HttpResponse.json({ runs: [runningRun] })));
    renderPanel();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Run in progress…' })).toBeDisabled());
  });

  it('starts a Run on the 202 success path', async () => {
    server.use(http.get('/api/runs', () => HttpResponse.json({ runs: [succeededRun] })));
    const user = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Run now' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Run now' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('shows "A run is already in progress" on the 409 path', async () => {
    server.use(
      http.get('/api/runs', () => HttpResponse.json({ runs: [succeededRun] })),
      runAlreadyInProgressHandler,
    );
    const user = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Run now' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Run now' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('A run is already in progress'),
    );
  });

  it('polls /api/runs on an interval while a Run is running', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let requestCount = 0;
    server.use(
      http.get('/api/runs', () => {
        requestCount += 1;
        return HttpResponse.json({ runs: [runningRun] });
      }),
    );

    renderPanel();

    await vi.waitFor(() => expect(requestCount).toBeGreaterThan(0));
    const countAfterInitialLoad = requestCount;

    await vi.advanceTimersByTimeAsync(4000);
    await vi.waitFor(() => expect(requestCount).toBeGreaterThan(countAfterInitialLoad));

    vi.useRealTimers();
  });
});
