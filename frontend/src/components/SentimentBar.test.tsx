import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SentimentCountsDto } from '../types';
import { SentimentBar } from './SentimentBar';

describe('SentimentBar', () => {
  it('renders the total and each Sentiment count with its own symbol', () => {
    const quarter: SentimentCountsDto = { total: 12, positive: 7, negative: 2, neutral: 3 };
    render(<SentimentBar quarter={quarter} />);

    expect(screen.getByText('12 total')).toBeInTheDocument();
    expect(screen.getByText('▲ 7')).toBeInTheDocument();
    expect(screen.getByText('▼ 2')).toBeInTheDocument();
    expect(screen.getByText('● 3')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '7 positive, 2 negative, 3 neutral mentions this quarter' })).toBeInTheDocument();
  });

  it('shows a no-mentions message instead of an empty bar when the total is zero', () => {
    const quarter: SentimentCountsDto = { total: 0, positive: 0, negative: 0, neutral: 0 };
    render(<SentimentBar quarter={quarter} />);

    expect(screen.getByText('No mentions this quarter')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
