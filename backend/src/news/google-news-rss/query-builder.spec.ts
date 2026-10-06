import { TrackedCompany } from '../../companies/company.js';
import { DateWindow } from '../news-source.js';
import { buildGoogleNewsQuery } from './query-builder.js';

function company(overrides: Partial<TrackedCompany> = {}): TrackedCompany {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'acme',
    name: 'Acme Corp',
    formerNames: [],
    disambiguator: null,
    ...overrides,
  };
}

const window: DateWindow = {
  from: new Date('2026-01-01T00:00:00Z'),
  to: new Date('2026-01-10T00:00:00Z'),
};

describe('buildGoogleNewsQuery', () => {
  it('quotes a plain company name and appends the date window operators', () => {
    const query = buildGoogleNewsQuery(company(), window);

    // `before:` is exclusive and day-granular, so the day after `window.to`
    // is queried to include articles published on `window.to`'s own day.
    expect(query).toBe('"Acme Corp" after:2026-01-01 before:2026-01-11');
  });

  it('ORs the quoted name with quoted former names', () => {
    const query = buildGoogleNewsQuery(
      company({ name: 'Lifeward', formerNames: ['ReWalk'] }),
      window,
    );

    expect(query).toContain('("Lifeward" OR "ReWalk")');
  });

  it('ORs the quoted name with every quoted former name when there are several', () => {
    const query = buildGoogleNewsQuery(
      company({ name: 'Current', formerNames: ['Former One', 'Former Two'] }),
      window,
    );

    expect(query).toContain('("Current" OR "Former One" OR "Former Two")');
  });

  it('adds the disambiguator as quoted context', () => {
    const query = buildGoogleNewsQuery(
      company({ name: 'Lambda', disambiguator: 'lambda.ai' }),
      window,
    );

    expect(query).toContain('"Lambda" "lambda.ai"');
  });

  it('falls back to a search override when there is no disambiguator', () => {
    const query = buildGoogleNewsQuery(company({ name: 'Harvey' }), window);

    expect(query).toContain('"Harvey" startup');
  });

  it('prefers an explicit disambiguator over a search override', () => {
    const query = buildGoogleNewsQuery(
      company({ name: 'Harvey', disambiguator: 'harvey.health' }),
      window,
    );

    expect(query).toContain('"harvey.health"');
    expect(query).not.toContain('startup');
  });

  it('omits the context term entirely when there is no disambiguator or override', () => {
    const query = buildGoogleNewsQuery(company({ name: 'Acme Corp' }), window);

    expect(query).toBe('"Acme Corp" after:2026-01-01 before:2026-01-11');
  });

  it('derives after: from the date window and before: from the day after window.to', () => {
    const query = buildGoogleNewsQuery(company(), {
      from: new Date('2025-03-05T12:00:00Z'),
      to: new Date('2025-06-05T23:59:59Z'),
    });

    expect(query).toContain('after:2025-03-05');
    expect(query).toContain('before:2025-06-06');
  });

  it('strips an embedded double quote from a name so it cannot break the query syntax', () => {
    const query = buildGoogleNewsQuery(company({ name: 'Acme "The Best" Corp' }), window);

    expect(query).toContain('"Acme The Best Corp"');
    expect(query).not.toMatch(/"Acme "The Best" Corp"/);
  });

  it('strips an embedded double quote from a disambiguator', () => {
    const query = buildGoogleNewsQuery(
      company({ name: 'Lambda', disambiguator: 'lambda.ai "formerly Lambda Labs"' }),
      window,
    );

    expect(query).toContain('"lambda.ai formerly Lambda Labs"');
  });
});
