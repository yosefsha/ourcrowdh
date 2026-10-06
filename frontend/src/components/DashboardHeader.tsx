import type { ReactNode } from 'react';
import { aggregateDashboardTotals } from '../dashboard';
import type { CompanySummaryDto, QuarterDto } from '../types';

interface Props {
  quarter: QuarterDto;
  companies: readonly CompanySummaryDto[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Stat {
  readonly label: string;
  readonly value: ReactNode;
}

/** Quarter range plus the totals a reviewer needs before scanning the table: Mentions, sentiment split, no-coverage count. */
export function DashboardHeader({ quarter, companies }: Props) {
  const totals = aggregateDashboardTotals(companies);

  const stats: readonly Stat[] = [
    { label: 'Quarter', value: `${formatDate(quarter.from)} – ${formatDate(quarter.to)}` },
    { label: 'Mentions', value: totals.quarter.total },
    {
      label: 'Sentiment split',
      value: (
        <>
          <span style={{ color: '#2b8a3e' }}>▲ {totals.quarter.positive}</span>{' '}
          <span style={{ color: '#c92a2a' }}>▼ {totals.quarter.negative}</span>{' '}
          <span style={{ color: '#868e96' }}>● {totals.quarter.neutral}</span>
        </>
      ),
    },
    { label: 'No coverage found', value: `${totals.uncoveredCount} of ${companies.length} companies` },
  ];

  return (
    <section
      aria-label="Quarter summary"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.25rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '0.5rem',
      }}
    >
      {stats.map((stat) => (
        <div key={stat.label}>
          <div style={{ fontSize: '0.75rem', color: '#868e96', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            {stat.label}
          </div>
          <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{stat.value}</div>
        </div>
      ))}
    </section>
  );
}
