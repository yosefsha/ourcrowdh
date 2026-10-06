import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { NewsSourceError } from '../news-source.js';
import { parseGoogleNewsRss } from './rss-parser.js';

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '__fixtures__/zutacore-search.rss',
);

describe('parseGoogleNewsRss', () => {
  it('parses a recorded real Google News RSS response', () => {
    const xml = readFileSync(fixturePath, 'utf-8');

    const articles = parseGoogleNewsRss(xml);

    expect(articles).toHaveLength(5);
    const businessWire = articles.find((article) => article.outlet === 'Business Wire');
    expect(businessWire).toBeDefined();
    expect(businessWire?.title).toBe(
      'Options Technology Partners with ZutaCore to Bring Waterless, Two-Phase Liquid ' +
        'Cooling to Financial Services Infrastructure',
    );
    expect(businessWire?.title.endsWith('Business Wire')).toBe(false);
    expect(businessWire?.source).toBe('google-news-rss');
    expect(businessWire?.url).toMatch(/^https:\/\/news\.google\.com\/rss\/articles\//);
    expect(businessWire?.publishedAt).toBeInstanceOf(Date);
    expect(Number.isNaN(businessWire?.publishedAt.getTime())).toBe(false);
  });

  it('keeps every outlet distinct for the same syndicated press release', () => {
    const xml = readFileSync(fixturePath, 'utf-8');

    const outlets = parseGoogleNewsRss(xml).map((article) => article.outlet);

    expect(outlets).toEqual(
      expect.arrayContaining([
        'Business Wire',
        'New Castle News',
        'ServeTheHome',
        'The Joplin Globe',
      ]),
    );
  });

  it('parses a single-item feed without losing the item to array coercion', () => {
    const xml =
      '<rss><channel><item>' +
      '<title>Solo Headline - Solo Outlet</title>' +
      '<link>https://example.com/solo</link>' +
      '<pubDate>Wed, 23 Sep 2026 07:00:00 GMT</pubDate>' +
      '<source url="https://example.com">Solo Outlet</source>' +
      '</item></channel></rss>';

    const articles = parseGoogleNewsRss(xml);

    expect(articles).toHaveLength(1);
    expect(articles[0]?.title).toBe('Solo Headline');
    expect(articles[0]?.outlet).toBe('Solo Outlet');
  });

  it('keeps a numeric-looking title or outlet as a string rather than coercing it', () => {
    const xml =
      '<rss><channel><item>' +
      '<title>007 - 1.50</title>' +
      '<link>https://example.com/numeric</link>' +
      '<pubDate>Wed, 23 Sep 2026 07:00:00 GMT</pubDate>' +
      '<source url="https://example.com">1.50</source>' +
      '</item></channel></rss>';

    const articles = parseGoogleNewsRss(xml);

    expect(articles).toHaveLength(1);
    expect(articles[0]?.title).toBe('007');
    expect(articles[0]?.outlet).toBe('1.50');
  });

  it('returns an empty list for a feed with no items', () => {
    const xml = '<rss><channel></channel></rss>';

    expect(parseGoogleNewsRss(xml)).toEqual([]);
  });

  it('throws NewsSourceError on malformed XML', () => {
    const malformed = '<rss><channel><item><title>oops</title></rss>';

    expect(() => parseGoogleNewsRss(malformed)).toThrow(NewsSourceError);
  });

  it('throws NewsSourceError when an item is missing its source', () => {
    const xml =
      '<rss><channel><item>' +
      '<title>No Source Here</title>' +
      '<link>https://example.com</link>' +
      '<pubDate>Wed, 23 Sep 2026 07:00:00 GMT</pubDate>' +
      '</item></channel></rss>';

    expect(() => parseGoogleNewsRss(xml)).toThrow(NewsSourceError);
  });

  it('throws NewsSourceError when pubDate cannot be parsed into a Date', () => {
    const xml =
      '<rss><channel><item>' +
      '<title>Bad Date - Outlet</title>' +
      '<link>https://example.com</link>' +
      '<pubDate>not-a-date</pubDate>' +
      '<source url="https://example.com">Outlet</source>' +
      '</item></channel></rss>';

    expect(() => parseGoogleNewsRss(xml)).toThrow(NewsSourceError);
  });
});
