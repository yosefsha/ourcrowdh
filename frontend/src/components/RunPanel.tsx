import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ApiError } from '../api/client';
import { useRuns, useStartRun } from '../api/hooks';
import { queryKeys } from '../api/queryKeys';

/** How often to re-fetch `/api/runs` while the latest Run is still running. */
const POLL_INTERVAL_MS = 4000;

function formatStartedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Latest Run status and counts, with the "Run now" control that starts a new one. */
export function RunPanel() {
  const runsQuery = useRuns(1);
  const startRun = useStartRun();
  const queryClient = useQueryClient();

  const latestRun = runsQuery.data?.runs[0] ?? null;
  const isRunning = latestRun?.status === 'running';

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const intervalId = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [isRunning, queryClient]);

  const startRunDisabled = startRun.isPending || isRunning;
  const startRunErrorMessage =
    startRun.error instanceof ApiError && startRun.error.status === 409
      ? 'A run is already in progress'
      : startRun.isError
        ? 'Could not start the run. Try again.'
        : null;

  const stats: readonly { label: string; value: string }[] =
    latestRun === null
      ? []
      : [
          { label: 'Status', value: capitalize(latestRun.status) },
          { label: 'Started', value: formatStartedAt(latestRun.startedAt) },
          { label: 'Articles fetched', value: String(latestRun.articlesFetched) },
          { label: 'Mentions classified', value: String(latestRun.mentionsClassified) },
          { label: 'New mentions', value: String(latestRun.newMentions) },
        ];

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '1rem', border: '1px solid #e9ecef', borderRadius: '0.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Run status</h2>
        <button
          type="button"
          onClick={() => startRun.mutate()}
          disabled={startRunDisabled}
          style={{
            padding: '0.45rem 0.9rem',
            borderRadius: '0.35rem',
            border: 'none',
            backgroundColor: '#1864ab',
            color: '#fff',
            fontWeight: 600,
            cursor: startRunDisabled ? 'not-allowed' : 'pointer',
            opacity: startRunDisabled ? 0.6 : 1,
          }}
        >
          {isRunning ? 'Run in progress…' : 'Run now'}
        </button>
      </div>

      {runsQuery.isLoading && <p style={{ margin: 0 }}>Loading run status…</p>}

      {runsQuery.isError && (
        <p role="alert" style={{ margin: 0, color: '#c92a2a' }}>
          Could not load run status: {runsQuery.error.message}
        </p>
      )}

      {runsQuery.isSuccess && latestRun === null && <p style={{ margin: 0 }}>No runs yet.</p>}

      {runsQuery.isSuccess && latestRun !== null && (
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(7rem, 1fr))',
            gap: '0.5rem',
            margin: 0,
          }}
        >
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt style={{ fontSize: '0.72rem', color: '#868e96', textTransform: 'uppercase' }}>{stat.label}</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{stat.value}</dd>
            </div>
          ))}
          {latestRun.status === 'failed' && latestRun.error !== null && (
            <div style={{ gridColumn: '1 / -1', color: '#c92a2a' }}>{latestRun.error}</div>
          )}
        </dl>
      )}

      {startRunErrorMessage !== null && (
        <p role="alert" style={{ margin: 0, color: '#c92a2a' }}>
          {startRunErrorMessage}
        </p>
      )}
    </section>
  );
}
