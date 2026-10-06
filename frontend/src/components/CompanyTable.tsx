import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  filterCompanies,
  sortCompanies,
  STATUS_BAND_ORDER,
  STATUS_BAND_PRESENTATION,
  type CompanyBandFilter,
  type CompanySortKey,
  type SortDirection,
} from '../dashboard';
import type { CompanySummaryDto } from '../types';
import { SentimentBar } from './SentimentBar';
import { StatusBadge } from './StatusBadge';

interface Props {
  companies: readonly CompanySummaryDto[];
}

interface ColumnDef {
  readonly key: CompanySortKey;
  readonly label: string;
}

const COLUMNS: readonly ColumnDef[] = [
  { key: 'name', label: 'Company' },
  { key: 'lastMentioned', label: 'Mention Status' },
  { key: 'total', label: 'Quarter' },
  { key: 'negative', label: 'Negative' },
];

const BAND_FILTER_OPTIONS: readonly { value: CompanyBandFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  ...STATUS_BAND_ORDER.map((band) => ({ value: band, label: STATUS_BAND_PRESENTATION[band].label })),
];

/** Sortable, filterable table of every Tracked Company's Mention Status and Quarter Sentiment. */
export function CompanyTable({ companies }: Props) {
  const [text, setText] = useState('');
  const [band, setBand] = useState<CompanyBandFilter>('all');
  const [sortKey, setSortKey] = useState<CompanySortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const visibleCompanies = useMemo(
    () => sortCompanies(filterCompanies(companies, { text, band }), sortKey, sortDirection),
    [companies, text, band, sortKey, sortDirection],
  );

  function toggleSort(key: CompanySortKey): void {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', gap: '0.25rem' }}>
          Search
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Company or former name"
            style={{
              padding: '0.4rem 0.6rem',
              borderRadius: '0.35rem',
              border: '1px solid #ced4da',
              width: '100%',
              maxWidth: '16rem',
            }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', gap: '0.25rem' }}>
          Status
          <select
            value={band}
            onChange={(event) => setBand(event.target.value as CompanyBandFilter)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '0.35rem', border: '1px solid #ced4da' }}
          >
            {BAND_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span style={{ fontSize: '0.85rem', color: '#495057' }}>
          Showing {visibleCompanies.length} of {companies.length} companies
        </span>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e9ecef', borderRadius: '0.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={{
                    textAlign: 'left',
                    padding: '0.6rem 0.75rem',
                    borderBottom: '2px solid #dee2e6',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    aria-label={`Sort by ${column.label}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: 'inherit',
                    }}
                  >
                    {column.label}
                    {sortKey === column.key && (
                      <span aria-hidden="true">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleCompanies.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding: '1.25rem', textAlign: 'center', color: '#868e96' }}>
                  No companies match this search.
                </td>
              </tr>
            ) : (
              visibleCompanies.map((company) => (
                <tr key={company.slug} style={{ borderBottom: '1px solid #f1f3f5' }}>
                  <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'top' }}>
                    <Link to={`/companies/${company.slug}`} style={{ fontWeight: 600, color: '#1864ab', textDecoration: 'none' }}>
                      {company.name}
                    </Link>
                    {company.formerNames.length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#868e96' }}>
                        formerly {company.formerNames.join(', ')}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'top' }}>
                    <StatusBadge status={company.status} />
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'top' }}>
                    <SentimentBar quarter={company.quarter} />
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'top' }}>{company.quarter.negative}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
