import { useCompanies } from '../api/hooks';
import { CompanyTable } from '../components/CompanyTable';
import { DashboardHeader } from '../components/DashboardHeader';
import { RunPanel } from '../components/RunPanel';

/** The main dashboard: every Tracked Company's Mention Status and Quarter coverage, plus Run controls. */
export function DashboardPage() {
  const companiesQuery = useCompanies();

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        padding: '1rem',
        maxWidth: '75rem',
        marginInline: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <h1 style={{ margin: 0 }}>Dashboard</h1>

      <RunPanel />

      {companiesQuery.isLoading && <p>Loading companies…</p>}

      {companiesQuery.isError && (
        <p role="alert" style={{ color: '#c92a2a' }}>
          Could not load companies: {companiesQuery.error.message}
        </p>
      )}

      {companiesQuery.isSuccess && companiesQuery.data.companies.length === 0 && (
        <p>No tracked companies found.</p>
      )}

      {companiesQuery.isSuccess && companiesQuery.data.companies.length > 0 && (
        <>
          <DashboardHeader quarter={companiesQuery.data.quarter} companies={companiesQuery.data.companies} />
          <CompanyTable companies={companiesQuery.data.companies} />
        </>
      )}
    </main>
  );
}
