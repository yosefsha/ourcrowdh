import { describeMentionStatus, STATUS_BAND_PRESENTATION } from '../dashboard';
import type { MentionStatusDto } from '../types';

interface Props {
  status: MentionStatusDto;
}

/**
 * Mention Status badge. Every band carries a distinct symbol and label in
 * addition to its colour, so the band is never conveyed by colour alone.
 */
export function StatusBadge({ status }: Props) {
  const presentation = STATUS_BAND_PRESENTATION[status.band];

  return (
    <span
      title={presentation.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.25rem 0.6rem',
        borderRadius: '999px',
        fontSize: '0.85rem',
        fontWeight: 600,
        backgroundColor: presentation.background,
        color: presentation.foreground,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">{presentation.symbol}</span>
      <span>{describeMentionStatus(status.daysSinceLastMention)}</span>
    </span>
  );
}
