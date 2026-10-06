import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { TrackedCompany } from '../../companies/company.js';
import { DateWindow, FetchedArticle, NewsSource } from '../news-source.js';
import googleNewsRssConfig from './google-news-rss.config.js';
import { buildGoogleNewsQuery } from './query-builder.js';
import { RssHttpClient } from './rss-http-client.js';
import { parseGoogleNewsRss } from './rss-parser.js';
import { fetchWithBisection } from './window-bisector.js';

const GOOGLE_NEWS_RSS_SEARCH_URL = 'https://news.google.com/rss/search';

/**
 * The only export this folder makes to the rest of `news/`
 * (`docs/PLAN.md#news-source-isolation`): a `NewsSource` implementation that
 * composes the query builder, the HTTP client, the RSS parser and the
 * window bisector. Nothing outside `google-news-rss/` sees any of those —
 * only this class and the domain types the port defines.
 */
@Injectable()
export class GoogleNewsRssSource implements NewsSource {
  private readonly httpClient: RssHttpClient;

  constructor(
    @Inject(googleNewsRssConfig.KEY)
    private readonly config: ConfigType<typeof googleNewsRssConfig>,
  ) {
    this.httpClient = new RssHttpClient(config.requestDelayMs);
  }

  async fetchArticles(
    company: TrackedCompany,
    window: DateWindow,
  ): Promise<readonly FetchedArticle[]> {
    const articles = await fetchWithBisection(window, (currentWindow) =>
      this.fetchWindow(company, currentWindow),
    );
    // Defensive: Google's `after:`/`before:` operators work at day
    // granularity, and a syndicated copy can carry a slightly different
    // `pubDate`, so the contract's window guarantee is enforced here too.
    return articles.filter(
      (article) => article.publishedAt >= window.from && article.publishedAt <= window.to,
    );
  }

  private async fetchWindow(
    company: TrackedCompany,
    window: DateWindow,
  ): Promise<readonly FetchedArticle[]> {
    const query = buildGoogleNewsQuery(company, window);
    const url = `${GOOGLE_NEWS_RSS_SEARCH_URL}?q=${encodeURIComponent(query)}&${this.config.locale}`;
    const xml = await this.httpClient.fetchRssFeed(url, query);
    return parseGoogleNewsRss(xml);
  }
}
