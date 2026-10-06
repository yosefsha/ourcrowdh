import { TrackedCompany } from '../companies/company.js';

/**
 * Port for collecting Articles about a Tracked Company (`docs/PLAN.md#ports`,
 * `docs/PLAN.md#news-source-isolation`). A `NewsSource` is a Gateway to a
 * read-only external service, not a Repository — nothing here is written to
 * by the domain. The port speaks only these domain types: no query syntax,
 * item caps, XML or HTTP status may cross it.
 */
export interface DateWindow {
  readonly from: Date;
  readonly to: Date;
}

export interface FetchedArticle {
  readonly url: string;
  readonly title: string;
  readonly outlet: string;
  readonly publishedAt: Date;
  /** Provenance of this Article, e.g. `'google-news-rss'`. */
  readonly source: string;
}

export const NEWS_SOURCE = Symbol('NEWS_SOURCE');

export interface NewsSource {
  fetchArticles(company: TrackedCompany, window: DateWindow): Promise<readonly FetchedArticle[]>;
}

/** Transport or parse failure after the adapter's own retries are exhausted. */
export class NewsSourceError extends Error {}
