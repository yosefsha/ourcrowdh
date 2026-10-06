import { jest } from '@jest/globals';
import { FetchedArticle, NewsSource } from '../news-source.js';
import { describeNewsSourceContract, NewsSourceContractFixture } from '../news-source.contract.js';
import { GoogleNewsRssSource } from './google-news-rss.source.js';

/** A config with no politeness delay and no network-matching backoff wait, so the shared contract suite runs fast. */
function testConfig(): { requestDelayMs: number; locale: string } {
  return { requestDelayMs: 0, locale: 'hl=en-US&gl=US&ceid=US:en' };
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildRssResponse(articles: readonly FetchedArticle[]): string {
  const items = articles
    .map(
      (article) =>
        `<item>` +
        `<title>${escapeXml(article.title)} - ${escapeXml(article.outlet)}</title>` +
        `<link>${escapeXml(article.url)}</link>` +
        `<pubDate>${article.publishedAt.toUTCString()}</pubDate>` +
        `<source url="https://example.com">${escapeXml(article.outlet)}</source>` +
        `</item>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss><channel>${items}</channel></rss>`;
}

class GoogleNewsRssFixture implements NewsSourceContractFixture {
  withArticles(articles: readonly FetchedArticle[]): NewsSource {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(buildRssResponse(articles), { status: 200 }));
    return new GoogleNewsRssSource(testConfig());
  }

  withFailure(): NewsSource {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    return new GoogleNewsRssSource(testConfig());
  }
}

afterEach(() => {
  jest.restoreAllMocks();
});

describeNewsSourceContract('google-news-rss', () => new GoogleNewsRssFixture());
