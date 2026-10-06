import { TrackedCompany } from '../companies/company.js';
import { FetchedArticle } from '../news/news-source.js';
import { InMemoryMentionWriter } from './in-memory-mention-writer.js';

const company: TrackedCompany = {
  id: 'company-1',
  slug: 'acme',
  name: 'Acme Corp',
  formerNames: [],
  disambiguator: null,
};

const article: FetchedArticle = {
  url: 'https://example.com/acme-raises',
  title: 'Acme raises $10M',
  outlet: 'Example Times',
  publishedAt: new Date('2026-01-01T00:00:00Z'),
  source: 'google-news-rss',
};

function writer(): InMemoryMentionWriter {
  return new InMemoryMentionWriter(new Map([[company.id, company]]));
}

describe('InMemoryMentionWriter', () => {
  describe('recordDiscovered', () => {
    it('creates a pending Mention per new article and returns the count created', async () => {
      const mentionWriter = writer();

      const created = await mentionWriter.recordDiscovered('run-1', company.id, [article]);

      expect(created).toBe(1);
      const pending = await mentionWriter.findPending();
      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({ company, title: article.title, outlet: article.outlet });
    });

    it('is idempotent on article url + company: re-recording creates nothing new', async () => {
      const mentionWriter = writer();
      await mentionWriter.recordDiscovered('run-1', company.id, [article]);

      const createdAgain = await mentionWriter.recordDiscovered('run-2', company.id, [article]);

      expect(createdAgain).toBe(0);
      expect(await mentionWriter.findPending()).toHaveLength(1);
    });

    it('the same article for a different company is a distinct Mention', async () => {
      const otherCompany: TrackedCompany = { ...company, id: 'company-2', slug: 'other' };
      const mentionWriter = new InMemoryMentionWriter(
        new Map([
          [company.id, company],
          [otherCompany.id, otherCompany],
        ]),
      );
      await mentionWriter.recordDiscovered('run-1', company.id, [article]);

      const created = await mentionWriter.recordDiscovered('run-1', otherCompany.id, [article]);

      expect(created).toBe(1);
      expect(await mentionWriter.findPending()).toHaveLength(2);
    });
  });

  describe('saveClassification / markFailed', () => {
    it('saveClassification removes the Mention from findPending', async () => {
      const mentionWriter = writer();
      await mentionWriter.recordDiscovered('run-1', company.id, [article]);
      const [pending] = await mentionWriter.findPending();

      await mentionWriter.saveClassification(pending.id, {
        relevant: true,
        sentiment: 'positive',
        confidence: 0.9,
        rationale: 'Clearly about Acme',
        model: 'fake-model',
      });

      expect(await mentionWriter.findPending()).toHaveLength(0);
    });

    it('markFailed keeps the Mention in findPending and records the reason', async () => {
      const mentionWriter = writer();
      await mentionWriter.recordDiscovered('run-1', company.id, [article]);
      const [pending] = await mentionWriter.findPending();

      await mentionWriter.markFailed(pending.id, 'invalid JSON after retries');

      expect(await mentionWriter.findPending()).toHaveLength(1);
      expect(mentionWriter.failureReasonFor(pending.id)).toBe('invalid JSON after retries');
    });

    it('saveClassification on an unknown id throws', async () => {
      const mentionWriter = writer();

      await expect(
        mentionWriter.saveClassification('does-not-exist', {
          relevant: false,
          rationale: 'n/a',
          model: 'fake-model',
        }),
      ).rejects.toThrow();
    });
  });

  describe('findNewMentions', () => {
    it('returns only relevant, classified Mentions first seen in the given run, published since the cutoff', async () => {
      const mentionWriter = writer();
      await mentionWriter.recordDiscovered('run-1', company.id, [article]);
      const [pending] = await mentionWriter.findPending();
      await mentionWriter.saveClassification(pending.id, {
        relevant: true,
        sentiment: 'negative',
        confidence: 0.8,
        rationale: 'About Acme, negative framing',
        model: 'fake-model',
      });

      const result = await mentionWriter.findNewMentions('run-1', new Date('2025-12-31T00:00:00Z'));

      expect(result).toEqual([
        {
          companyName: company.name,
          title: article.title,
          url: article.url,
          outlet: article.outlet,
          publishedAt: article.publishedAt,
          sentiment: 'negative',
        },
      ]);
    });

    it('excludes a Mention classified as not relevant', async () => {
      const mentionWriter = writer();
      await mentionWriter.recordDiscovered('run-1', company.id, [article]);
      const [pending] = await mentionWriter.findPending();
      await mentionWriter.saveClassification(pending.id, {
        relevant: false,
        rationale: 'Name collision',
        model: 'fake-model',
      });

      const result = await mentionWriter.findNewMentions('run-1', new Date('2025-12-31T00:00:00Z'));

      expect(result).toEqual([]);
    });

    it('excludes a Mention first seen in a different run', async () => {
      const mentionWriter = writer();
      await mentionWriter.recordDiscovered('run-1', company.id, [article]);
      const [pending] = await mentionWriter.findPending();
      await mentionWriter.saveClassification(pending.id, {
        relevant: true,
        sentiment: 'neutral',
        confidence: 0.7,
        rationale: 'About Acme',
        model: 'fake-model',
      });

      const result = await mentionWriter.findNewMentions('run-2', new Date('2025-12-31T00:00:00Z'));

      expect(result).toEqual([]);
    });

    it('excludes a Mention published before the cutoff', async () => {
      const mentionWriter = writer();
      await mentionWriter.recordDiscovered('run-1', company.id, [article]);
      const [pending] = await mentionWriter.findPending();
      await mentionWriter.saveClassification(pending.id, {
        relevant: true,
        sentiment: 'neutral',
        confidence: 0.7,
        rationale: 'About Acme',
        model: 'fake-model',
      });

      const result = await mentionWriter.findNewMentions('run-1', new Date('2026-01-02T00:00:00Z'));

      expect(result).toEqual([]);
    });
  });
});
