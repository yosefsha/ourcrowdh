import { TrackedCompany } from '../companies/company.js';
import { DateWindow, FetchedArticle, NewsSource, NewsSourceError } from './news-source.js';

/**
 * In-memory fake for `NewsSource`. Immutable by construction — each test
 * builds a fresh instance with the articles (or failure) it wants that
 * fetch to produce, rather than mutating a shared instance mid-test.
 *
 * Filters to the requested window and de-duplicates by url itself, exactly
 * like `news-source.contract.ts` requires of every implementation — see
 * `in-memory-news-source.spec.ts`, which runs that shared suite against it.
 */
export class InMemoryNewsSource implements NewsSource {
  constructor(
    private readonly articles: readonly FetchedArticle[] = [],
    private readonly failure: NewsSourceError | null = null,
  ) {}

  async fetchArticles(
    _company: TrackedCompany,
    window: DateWindow,
  ): Promise<readonly FetchedArticle[]> {
    if (this.failure) {
      throw this.failure;
    }

    const seenUrls = new Set<string>();
    const result: FetchedArticle[] = [];
    for (const article of this.articles) {
      if (article.publishedAt < window.from || article.publishedAt > window.to) {
        continue;
      }
      if (seenUrls.has(article.url)) {
        continue;
      }
      seenUrls.add(article.url);
      result.push(article);
    }
    return Promise.resolve(result);
  }
}
