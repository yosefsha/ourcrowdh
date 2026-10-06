import { readFileSync } from 'fs';
import { join } from 'path';
import { InvalidCompanyListError, parseCompanyList } from './parse-company-list.js';

describe('parseCompanyList', () => {
  it('ignores blank lines and trims whitespace around each name', () => {
    const entries = parseCompanyList('  Stripe  \n\n\n  Anthropic\n');

    expect(entries).toEqual([
      { slug: 'stripe', name: 'Stripe', formerNames: [], disambiguator: null },
      { slug: 'anthropic', name: 'Anthropic', formerNames: [], disambiguator: null },
    ]);
  });

  it('strips a leading UTF-8 BOM', () => {
    const entries = parseCompanyList('﻿Stripe');

    expect(entries).toEqual([
      { slug: 'stripe', name: 'Stripe', formerNames: [], disambiguator: null },
    ]);
  });

  it('handles CRLF line endings', () => {
    const entries = parseCompanyList('Stripe\r\nAnthropic\r\n');

    expect(entries.map((entry) => entry.name)).toEqual(['Stripe', 'Anthropic']);
  });

  it('parses "Name (formerly X)" into a former name', () => {
    const entries = parseCompanyList('Ludeo (formerly Edge)');

    expect(entries).toEqual([
      { slug: 'ludeo', name: 'Ludeo', formerNames: ['Edge'], disambiguator: null },
    ]);
  });

  it('parses "Name (formerly known as X)" into a former name', () => {
    const entries = parseCompanyList('Lifeward (formerly known as ReWalk)');

    expect(entries).toEqual([
      { slug: 'lifeward', name: 'Lifeward', formerNames: ['ReWalk'], disambiguator: null },
    ]);
  });

  it('parses any other trailing parenthetical as a disambiguator', () => {
    const entries = parseCompanyList('Lambda (lambda.ai)\nSSI (Safe Superintelligence)');

    expect(entries).toEqual([
      { slug: 'lambda', name: 'Lambda', formerNames: [], disambiguator: 'lambda.ai' },
      {
        slug: 'ssi',
        name: 'SSI',
        formerNames: [],
        disambiguator: 'Safe Superintelligence',
      },
    ]);
  });

  it('derives a stable kebab-case slug from the name', () => {
    const entries = parseCompanyList('The EVERY Company\nQuai.MD\n3d Signals');

    expect(entries.map((entry) => entry.slug)).toEqual([
      'the-every-company',
      'quai-md',
      '3d-signals',
    ]);
  });

  it('throws InvalidCompanyListError naming the line on a duplicate slug', () => {
    expect(() => parseCompanyList('Stripe\nAnthropic\nStripe')).toThrow(InvalidCompanyListError);
    expect(() => parseCompanyList('Stripe\nAnthropic\nStripe')).toThrow(/line 3/i);
  });

  it('throws InvalidCompanyListError naming the line on a duplicate name', () => {
    // Same name, different casing — still a duplicate.
    expect(() => parseCompanyList('Stripe\nSTRIPE')).toThrow(InvalidCompanyListError);
    expect(() => parseCompanyList('Stripe\nSTRIPE')).toThrow(/line 2/i);
  });

  it('throws InvalidCompanyListError when a line parses to an empty name', () => {
    // No text precedes the parenthetical, so nothing is left to slugify.
    expect(() => parseCompanyList('Stripe\n()')).toThrow(InvalidCompanyListError);
  });

  it('returns an empty list for an empty or whitespace-only file', () => {
    expect(parseCompanyList('')).toEqual([]);
    expect(parseCompanyList('\n\n  \n')).toEqual([]);
  });

  describe('against the real seed file (backend/seed/companies.txt)', () => {
    const text = readFileSync(join(import.meta.dirname, '..', '..', 'seed', 'companies.txt'), {
      encoding: 'utf-8',
    });
    const entries = parseCompanyList(text);

    it('parses every line into a unique entry', () => {
      // The issue's acceptance criteria say 257; the committed file
      // (unchanged by this PR) verifiably contains 258 non-blank, unique
      // company lines — flagged to the parent as a discrepancy rather than
      // silently dropped or fabricated to match the smaller number.
      expect(entries).toHaveLength(258);
      expect(new Set(entries.map((entry) => entry.slug)).size).toBe(entries.length);
    });

    it('extracts the expected number of former names and disambiguators', () => {
      const withFormerNames = entries.filter((entry) => entry.formerNames.length > 0);
      const withDisambiguator = entries.filter((entry) => entry.disambiguator !== null);

      expect(withFormerNames).toHaveLength(10);
      expect(withDisambiguator).toHaveLength(2);
    });

    it('parses Lambda and SSI as disambiguators, not former names', () => {
      const lambda = entries.find((entry) => entry.slug === 'lambda');
      const ssi = entries.find((entry) => entry.slug === 'ssi');

      expect(lambda).toMatchObject({ disambiguator: 'lambda.ai', formerNames: [] });
      expect(ssi).toMatchObject({ disambiguator: 'Safe Superintelligence', formerNames: [] });
    });

    it('parses Lifeward as a former name, not a disambiguator', () => {
      const lifeward = entries.find((entry) => entry.slug === 'lifeward');

      expect(lifeward).toMatchObject({ formerNames: ['ReWalk'], disambiguator: null });
    });
  });
});
