import { Module } from '@nestjs/common';

/**
 * Intentionally empty. `MENTION_WRITER` (`mention-writer.js`) has no
 * provider bound yet — the Run orchestrator issue adds
 * `{ provide: MENTION_WRITER, useClass: PostgresMentionWriter }` and
 * re-exports the token.
 */
@Module({})
export class MentionsModule {}
