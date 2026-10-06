import { Module } from '@nestjs/common';

/**
 * Intentionally empty. `NEWS_SOURCE` (`news-source.js`) has no provider
 * bound yet — the News source issue adds the one line choosing the
 * implementation (`docs/PLAN.md#news-source-isolation`):
 * `{ provide: NEWS_SOURCE, useClass: GoogleNewsRssSource }`.
 */
@Module({})
export class NewsModule {}
