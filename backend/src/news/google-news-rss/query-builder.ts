import { TrackedCompany } from '../../companies/company.js';
import { DateWindow } from '../news-source.js';
import { searchOverrideFor } from './search-overrides.js';

/**
 * Builds the `q` parameter of a Google News RSS search
 * (`docs/PLAN.md#news-source-isolation`): the quoted name OR'd with any
 * quoted former names, a quoted context term to disambiguate a colliding
 * name, and `after:`/`before:` operators derived from the `DateWindow`.
 * Pure — no I/O, no knowledge of the RSS transport.
 */
export function buildGoogleNewsQuery(company: TrackedCompany, window: DateWindow): string {
  const terms = [nameClause(company), contextTerm(company), dateClause(window)].filter(
    (term): term is string => term !== null,
  );
  return terms.join(' ');
}

function nameClause(company: TrackedCompany): string {
  const quotedNames = [company.name, ...company.formerNames].map(quote);
  return quotedNames.length > 1 ? `(${quotedNames.join(' OR ')})` : quotedNames[0];
}

function contextTerm(company: TrackedCompany): string | null {
  if (company.disambiguator) {
    return quote(company.disambiguator);
  }
  return searchOverrideFor(company.name);
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Google's `before:` operator is exclusive and works at day granularity, so
 * `before:<window.to's day>` would never return an article published on
 * that day — even though `window.to` itself (and the adapter's own
 * post-fetch filter) treats it as inclusive. Querying the day *after*
 * `window.to` closes that gap; the post-filter in `google-news-rss.source.ts`
 * still trims anything that slips past the exact `window.to` instant.
 */
function dateClause(window: DateWindow): string {
  const before = new Date(window.to.getTime() + ONE_DAY_MS);
  return `after:${formatDate(window.from)} before:${formatDate(before)}`;
}

function quote(value: string): string {
  // Google's query syntax has no escape for an embedded `"`; stripping it
  // keeps the term a single well-formed phrase instead of breaking the
  // surrounding quoting.
  return `"${value.replace(/"/g, '')}"`;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
