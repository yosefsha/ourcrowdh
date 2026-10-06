import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MentionStatusDto } from '../types';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('shows the relative-day wording for a recent mention', () => {
    const status: MentionStatusDto = { lastMentionedAt: '2026-10-01T00:00:00.000Z', daysSinceLastMention: 5, band: 'fresh' };
    render(<StatusBadge status={status} />);

    expect(screen.getByText('5 days ago')).toBeInTheDocument();
  });

  it('shows "No coverage found" for a company with band "none"', () => {
    const status: MentionStatusDto = { lastMentionedAt: null, daysSinceLastMention: null, band: 'none' };
    render(<StatusBadge status={status} />);

    expect(screen.getByText('No coverage found')).toBeInTheDocument();
  });

  it('gives every band a distinct symbol, not just a colour', () => {
    const fresh: MentionStatusDto = { lastMentionedAt: '2026-10-05T00:00:00.000Z', daysSinceLastMention: 1, band: 'fresh' };
    const dormant: MentionStatusDto = { lastMentionedAt: '2026-01-01T00:00:00.000Z', daysSinceLastMention: 200, band: 'dormant' };

    const { rerender } = render(<StatusBadge status={fresh} />);
    const freshSymbol = screen.getByText('●', { exact: true });
    expect(freshSymbol).toBeInTheDocument();

    rerender(<StatusBadge status={dormant} />);
    expect(screen.getByText('○', { exact: true })).toBeInTheDocument();
  });
});
