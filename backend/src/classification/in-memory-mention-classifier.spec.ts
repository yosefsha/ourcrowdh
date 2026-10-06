import { TrackedCompany } from '../companies/company.js';
import { ClassificationFailedError, ClassifierUnavailableError } from './mention-classifier.js';
import { InMemoryMentionClassifier } from './in-memory-mention-classifier.js';

const company: TrackedCompany = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'acme',
  name: 'Acme Corp',
  formerNames: [],
  disambiguator: null,
};

describe('InMemoryMentionClassifier', () => {
  describe('assertReady', () => {
    it('resolves when no unavailability has been scripted', async () => {
      const classifier = new InMemoryMentionClassifier();

      await expect(classifier.assertReady()).resolves.toBeUndefined();
    });

    it('rejects with the scripted ClassifierUnavailableError', async () => {
      const error = new ClassifierUnavailableError('ollama unreachable');
      const classifier = new InMemoryMentionClassifier(new Map(), error);

      await expect(classifier.assertReady()).rejects.toBe(error);
    });
  });

  describe('classify', () => {
    it('returns the scripted classification for a known title', async () => {
      const classification = {
        relevant: true as const,
        sentiment: 'positive' as const,
        confidence: 0.92,
        rationale: 'Clearly about the company',
        model: 'fake-model',
      };
      const classifier = new InMemoryMentionClassifier(
        new Map([['Acme raises $10M Series A', classification]]),
      );

      const result = await classifier.classify({
        company,
        title: 'Acme raises $10M Series A',
        outlet: 'Example Times',
      });

      expect(result).toEqual(classification);
    });

    it('throws ClassificationFailedError for a title with no scripted response', async () => {
      const classifier = new InMemoryMentionClassifier();

      await expect(
        classifier.classify({ company, title: 'Unscripted headline', outlet: 'Example Times' }),
      ).rejects.toBeInstanceOf(ClassificationFailedError);
    });
  });
});
