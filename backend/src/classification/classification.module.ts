import { Module } from '@nestjs/common';
import { MENTION_CLASSIFIER } from './mention-classifier.js';
import { OllamaMentionClassifier } from './repositories/ollama-mention-classifier.js';

/**
 * Binds `MENTION_CLASSIFIER` (`mention-classifier.js`) to the Ollama
 * adapter. Replacing or adding a source — a hosted model, a second local
 * model — is a change to this provider list, not to anything that consumes
 * the port.
 */
@Module({
  providers: [{ provide: MENTION_CLASSIFIER, useClass: OllamaMentionClassifier }],
  exports: [MENTION_CLASSIFIER],
})
export class ClassificationModule {}
