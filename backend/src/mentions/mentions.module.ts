import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticleEntity } from './article.entity.js';
import { MentionEntity } from './mention.entity.js';
import { MENTION_WRITER } from './mention-writer.js';
import { PostgresMentionWriter } from './repositories/postgres-mention-writer.js';

/**
 * Binds `MENTION_WRITER` (`mention-writer.js`) to the Postgres
 * implementation and re-exports the token for the Run orchestrator
 * (`runs/run.service.ts`) to inject.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ArticleEntity, MentionEntity])],
  providers: [{ provide: MENTION_WRITER, useClass: PostgresMentionWriter }],
  exports: [MENTION_WRITER],
})
export class MentionsModule {}
