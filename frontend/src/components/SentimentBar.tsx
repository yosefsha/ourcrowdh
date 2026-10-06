import type { SentimentCountsDto } from '../types';

interface Props {
  quarter: SentimentCountsDto;
}

interface Segment {
  readonly key: 'positive' | 'negative' | 'neutral';
  readonly symbol: string;
  readonly color: string;
}

// Each segment carries its own symbol so the sentiment split reads correctly
// without relying on colour alone (a reviewer with colour-blindness still
// sees "▲ 7 ▼ 2 ● 3").
const SEGMENTS: readonly Segment[] = [
  { key: 'positive', symbol: '▲', color: '#2b8a3e' },
  { key: 'neutral', symbol: '●', color: '#868e96' },
  { key: 'negative', symbol: '▼', color: '#c92a2a' },
];

/** Stacked bar of a company's Quarter Sentiment split, with the counts spelled out below it. */
export function SentimentBar({ quarter }: Props) {
  if (quarter.total === 0) {
    return <span style={{ fontSize: '0.85rem', color: '#868e96' }}>No mentions this quarter</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '8rem' }}>
      <div
        role="img"
        aria-label={`${quarter.positive} positive, ${quarter.negative} negative, ${quarter.neutral} neutral mentions this quarter`}
        style={{
          display: 'flex',
          height: '0.5rem',
          borderRadius: '0.25rem',
          overflow: 'hidden',
          backgroundColor: '#e9ecef',
        }}
      >
        {SEGMENTS.map((segment) => {
          const value = quarter[segment.key];
          if (value === 0) {
            return null;
          }
          return (
            <div
              key={segment.key}
              style={{ backgroundColor: segment.color, width: `${(value / quarter.total) * 100}%` }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.78rem', color: '#495057' }}>
        <span style={{ fontWeight: 600 }}>{quarter.total} total</span>
        {SEGMENTS.map((segment) => (
          <span key={segment.key} style={{ color: segment.color }}>
            {segment.symbol} {quarter[segment.key]}
          </span>
        ))}
      </div>
    </div>
  );
}
