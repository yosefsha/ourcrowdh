import { FetchedArticle, NewsSource, NewsSourceError } from './news-source.js';
import { describeNewsSourceContract, NewsSourceContractFixture } from './news-source.contract.js';
import { InMemoryNewsSource } from './in-memory-news-source.js';

class InMemoryNewsSourceFixture implements NewsSourceContractFixture {
  withArticles(articles: readonly FetchedArticle[]): NewsSource {
    return new InMemoryNewsSource(articles);
  }

  withFailure(): NewsSource {
    return new InMemoryNewsSource([], new NewsSourceError('collection failed'));
  }
}

describeNewsSourceContract('InMemoryNewsSource', () => new InMemoryNewsSourceFixture());
