import { Module } from '@nestjs/common';

/**
 * Intentionally empty. `MENTION_CLASSIFIER` (`mention-classifier.js`) has no
 * provider bound yet — the Ollama classifier issue adds
 * `{ provide: MENTION_CLASSIFIER, useClass: OllamaMentionClassifier }` and
 * re-exports the token.
 */
@Module({})
export class ClassificationModule {}
