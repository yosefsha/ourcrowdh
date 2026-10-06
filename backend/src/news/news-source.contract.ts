import { TrackedCompany } from '../companies/company.js';
import { DateWindow, FetchedArticle, NewsSource, NewsSourceError } from './news-source.js';

/**
 * Lets `describeNewsSourceContract` drive any `NewsSource` implementation
 * through the scenarios `docs/PLAN.md#news-source-isolation` requires every
 * implementation to satisfy, without the suite needing to know how that
 * implementation collects its raw results (an in-memory list, a mocked RSS
 * client, …).
 */
export interface NewsSourceContractFixture {
  /**
   * Build a `NewsSource` whose underlying collection yields exactly these
   * articles — including any outside the scenario's window, or sharing a
   * url with another. The suite asserts the *implementation* filters and
   * de-duplicates; the fixture only needs to make it discover them.
   */
  withArticles(articles: readonly FetchedArticle[]): NewsSource;
  /** Build a `NewsSource` whose underlying collection step fails outright. */
  withFailure(): NewsSource;
}

const company: TrackedCompany = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'acme',
  name: 'Acme Corp',
  formerNames: [],
  disambiguator: null,
};

function recentWindow(): DateWindow {
  const to = new Date();
  const from = new Date(to.getTime() - 10 * 24 * 60 * 60 * 1000);
  return { from, to };
}

/**
 * Shared Jest suite every `NewsSource` implementation must pass
 * (`docs/PLAN.md#news-source-isolation`). Call it from that implementation's
 * own spec file: `describeNewsSourceContract('google-news-rss', () => new GoogleNewsRssFixture())`.
 */
export function describeNewsSourceContract(
  name: string,
  buildFixture: () => NewsSourceContractFixture,
): void {
  describe(`NewsSource contract: ${name}`, () => {
    it('returns only articles published inside the requested window', async () => {
      const window = recentWindow();
      const inside: FetchedArticle = {
        url: 'https://example.com/inside',
        title: 'Inside the window',
        outlet: 'Example Times',
        publishedAt: new Date(window.from.getTime() + 1000),
        source: name,
      };
      const outside: FetchedArticle = {
        url: 'https://example.com/outside',
        title: 'Outside the window',
        outlet: 'Example Times',
        publishedAt: new Date(window.from.getTime() - 1000),
        source: name,
      };
      const source = buildFixture().withArticles([inside, outside]);

      const result = await source.fetchArticles(company, window);

      expect(result.map((article) => article.url)).toEqual([inside.url]);
    });

    it('de-duplicates results by url', async () => {
      const window = recentWindow();
      const url = 'https://example.com/story';
      const original: FetchedArticle = {
        url,
        title: 'Story',
        outlet: 'Example Times',
        publishedAt: new Date(window.from.getTime() + 1000),
        source: name,
      };
      const syndicated: FetchedArticle = { ...original, title: 'Story (syndicated)' };
      const source = buildFixture().withArticles([original, syndicated]);

      const result = await source.fetchArticles(company, window);

      expect(result).toHaveLength(1);
      expect(result[0]?.url).toBe(url);
    });

    it('sets `source` (provenance) on every returned article', async () => {
      const window = recentWindow();
      const article: FetchedArticle = {
        url: 'https://example.com/story',
        title: 'Story',
        outlet: 'Example Times',
        publishedAt: new Date(window.from.getTime() + 1000),
        source: name,
      };
      const source = buildFixture().withArticles([article]);

      const result = await source.fetchArticles(company, window);

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((returned) => returned.source.length > 0)).toBe(true);
    });

    it('surfaces a collection failure only as NewsSourceError', async () => {
      const source = buildFixture().withFailure();

      await expect(source.fetchArticles(company, recentWindow())).rejects.toBeInstanceOf(
        NewsSourceError,
      );
    });
  });
}
