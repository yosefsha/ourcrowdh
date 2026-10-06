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

function dateClause(window: DateWindow): string {
  return `after:${formatDate(window.from)} before:${formatDate(window.to)}`;
}

function quote(value: string): string {
  return `"${value}"`;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
