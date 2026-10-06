import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import googleNewsRssConfig from './google-news-rss/google-news-rss.config.js';
import { GoogleNewsRssSource } from './google-news-rss/google-news-rss.source.js';
import { NEWS_SOURCE } from './news-source.js';

/**
 * `NEWS_SOURCE` (`news-source.js`) is bound to the Google News RSS adapter
 * (`docs/PLAN.md#news-source-isolation`). Replacing the source, or adding a
 * second one behind a `CompositeNewsSource`, is a change to this provider
 * list — never to a consumer of `NEWS_SOURCE`.
 */
@Module({
  imports: [ConfigModule.forFeature(googleNewsRssConfig)],
  providers: [{ provide: NEWS_SOURCE, useClass: GoogleNewsRssSource }],
  exports: [NEWS_SOURCE],
})
export class NewsModule {}
