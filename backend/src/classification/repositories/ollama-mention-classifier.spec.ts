import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration.js';
import { TrackedCompany } from '../../companies/company.js';
import { ClassificationFailedError, ClassifierUnavailableError } from '../mention-classifier.js';
import { OllamaMentionClassifier } from './ollama-mention-classifier.js';

const OLLAMA_URL = 'http://fake-ollama:11434';
const OLLAMA_MODEL = 'qwen2.5:7b';

const company: TrackedCompany = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'harvey',
  name: 'Harvey',
  formerNames: [],
  disambiguator: 'legal AI research company (harvey.ai)',
};

function configService(): ConfigService<AppConfig, true> {
  return new ConfigService<AppConfig, true>({ ollamaUrl: OLLAMA_URL, ollamaModel: OLLAMA_MODEL });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function chatResponseBody(content: string): unknown {
  return {
    model: OLLAMA_MODEL,
    created_at: new Date().toISOString(),
    message: { role: 'assistant', content },
    done: true,
    done_reason: 'stop',
  };
}

/**
 * Stubs the HTTP layer the `ollama` client calls, so no test needs a
 * running Ollama. `/api/tags` is scripted once; `/api/chat` replies are
 * consumed in order, one per call, so a test can script a schema violation
 * followed by a valid retry.
 */
function urlOf(input: string | URL | Request): string {
  if (typeof input === 'string') {
    return input;
  }
  return input instanceof URL ? input.toString() : input.url;
}

interface FetchCall {
  readonly url: string;
  readonly init?: RequestInit;
}

function stubbedFetch(options: {
  tags?: { models: ReadonlyArray<{ model: string; name?: string }> } | 'unreachable';
  chatContents?: readonly string[];
}): { fetch: typeof fetch; chatCallCount: () => number; calls: readonly FetchCall[] } {
  let chatCalls = 0;
  const calls: FetchCall[] = [];
  const fetchImpl = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = urlOf(input);
    calls.push({ url, init });
    if (url.endsWith('/api/tags')) {
      if (options.tags === 'unreachable' || options.tags === undefined) {
        throw new TypeError('fetch failed: connection refused');
      }
      return Promise.resolve(jsonResponse(options.tags));
    }
    if (url.endsWith('/api/chat')) {
      const contents = options.chatContents ?? [];
      const content = contents[Math.min(chatCalls, contents.length - 1)] ?? '';
      chatCalls += 1;
      return Promise.resolve(jsonResponse(chatResponseBody(content)));
    }
    throw new Error(`stubbedFetch: unexpected URL ${url}`);
  };
  return { fetch: fetchImpl, chatCallCount: () => chatCalls, calls };
}

describe('OllamaMentionClassifier', () => {
  describe('assertReady', () => {
    it('resolves when Ollama is reachable and the model is pulled', async () => {
      const { fetch: fetchImpl } = stubbedFetch({ tags: { models: [{ model: OLLAMA_MODEL }] } });
      const classifier = new OllamaMentionClassifier(configService(), fetchImpl);

      await expect(classifier.assertReady()).resolves.toBeUndefined();
    });

    it('sends the /api/tags request with an abort signal too', async () => {
      const { fetch: fetchImpl, calls } = stubbedFetch({
        tags: { models: [{ model: OLLAMA_MODEL }] },
      });
      const classifier = new OllamaMentionClassifier(configService(), fetchImpl);

      await classifier.assertReady();

      const tagsCall = calls.find((call) => call.url.endsWith('/api/tags'));
      expect(tagsCall?.init?.signal).toBeInstanceOf(AbortSignal);
    });

    it('throws ClassifierUnavailableError with the ollama serve remedy when unreachable', async () => {
      const { fetch: fetchImpl } = stubbedFetch({ tags: 'unreachable' });
      const classifier = new OllamaMentionClassifier(configService(), fetchImpl);

      await expect(classifier.assertReady()).rejects.toThrow(ClassifierUnavailableError);
      await expect(classifier.assertReady()).rejects.toThrow(
        `Ollama not reachable at ${OLLAMA_URL} — start it with \`ollama serve\` or \`brew services start ollama\``,
      );
    });

    it('throws ClassifierUnavailableError with the ollama pull remedy when the model is absent', async () => {
      const { fetch: fetchImpl } = stubbedFetch({ tags: { models: [{ model: 'llama3.1:8b' }] } });
      const classifier = new OllamaMentionClassifier(configService(), fetchImpl);

      await expect(classifier.assertReady()).rejects.toThrow(ClassifierUnavailableError);
      await expect(classifier.assertReady()).rejects.toThrow(
        `model ${OLLAMA_MODEL} not found — run \`ollama pull ${OLLAMA_MODEL}\``,
      );
    });
  });

  describe('classify', () => {
    it('returns a relevant classification from a valid structured response', async () => {
      const { fetch: fetchImpl } = stubbedFetch({
        chatContents: [
          JSON.stringify({
            relevant: true,
            sentiment: 'positive',
            confidence: 0.91,
            rationale: 'Funding news is positive for the company.',
          }),
        ],
      });
      const classifier = new OllamaMentionClassifier(configService(), fetchImpl);

      const result = await classifier.classify({
        company,
        title: 'Harvey raises $100M Series D',
        outlet: 'TechCrunch',
      });

      expect(result).toEqual({
        relevant: true,
        sentiment: 'positive',
        confidence: 0.91,
        rationale: 'Funding news is positive for the company.',
        model: OLLAMA_MODEL,
      });
    });

    it('sends every request with an abort signal, so a stalled Ollama connection cannot hang classify() forever', async () => {
      const { fetch: fetchImpl, calls } = stubbedFetch({
        chatContents: [
          JSON.stringify({
            relevant: true,
            sentiment: 'neutral',
            confidence: 0.6,
            rationale: 'Plain mention.',
          }),
        ],
      });
      const classifier = new OllamaMentionClassifier(configService(), fetchImpl);

      await classifier.classify({ company, title: 'Harvey named in a roundup', outlet: 'Reuters' });

      const chatCall = calls.find((call) => call.url.endsWith('/api/chat'));
      expect(chatCall?.init?.signal).toBeInstanceOf(AbortSignal);
      expect(chatCall?.init?.signal?.aborted).toBe(false);
    });

    it('returns an irrelevant classification without a sentiment', async () => {
      const { fetch: fetchImpl } = stubbedFetch({
        chatContents: [
          JSON.stringify({
            relevant: false,
            sentiment: null,
            confidence: 0.97,
            rationale: 'This is the hurricane, not the company.',
          }),
        ],
      });
      const classifier = new OllamaMentionClassifier(configService(), fetchImpl);

      const result = await classifier.classify({
        company,
        title: 'Hurricane Harvey weakens to a tropical storm',
        outlet: 'Reuters',
      });

      expect(result).toEqual({
        relevant: false,
        rationale: 'This is the hurricane, not the company.',
        model: OLLAMA_MODEL,
      });
    });

    it('retries once after a schema violation and returns the valid retry result', async () => {
      const { fetch: fetchImpl, chatCallCount } = stubbedFetch({
        chatContents: [
          'not json at all',
          JSON.stringify({
            relevant: true,
            sentiment: 'neutral',
            confidence: 0.7,
            rationale: 'A plain mention.',
          }),
        ],
      });
      const classifier = new OllamaMentionClassifier(configService(), fetchImpl);

      const result = await classifier.classify({
        company,
        title: 'Harvey named in a roundup',
        outlet: 'Reuters',
      });

      expect(result).toEqual({
        relevant: true,
        sentiment: 'neutral',
        confidence: 0.7,
        rationale: 'A plain mention.',
        model: OLLAMA_MODEL,
      });
      expect(chatCallCount()).toBe(2);
    });

    it('throws ClassificationFailedError when invalid JSON persists through the retry', async () => {
      const { fetch: fetchImpl, chatCallCount } = stubbedFetch({
        chatContents: ['not json at all', 'still not json'],
      });
      const classifier = new OllamaMentionClassifier(configService(), fetchImpl);

      await expect(
        classifier.classify({ company, title: 'Harvey named in a roundup', outlet: 'Reuters' }),
      ).rejects.toBeInstanceOf(ClassificationFailedError);
      expect(chatCallCount()).toBe(2);
    });

    it('caps how much of an oversized, unparseable reply reaches the error message', async () => {
      const oversizedReply = 'x'.repeat(5_000);
      const { fetch: fetchImpl } = stubbedFetch({ chatContents: [oversizedReply, oversizedReply] });
      const classifier = new OllamaMentionClassifier(configService(), fetchImpl);

      await expect(
        classifier.classify({ company, title: 'Harvey named in a roundup', outlet: 'Reuters' }),
      ).rejects.toThrow(/^.{0,400}$/);
    });

    it('throws ClassificationFailedError when a relevant mention is returned without a sentiment', async () => {
      const { fetch: fetchImpl } = stubbedFetch({
        chatContents: [
          JSON.stringify({
            relevant: true,
            sentiment: null,
            confidence: 0.6,
            rationale: 'Missing sentiment.',
          }),
          JSON.stringify({
            relevant: true,
            sentiment: null,
            confidence: 0.6,
            rationale: 'Still missing.',
          }),
        ],
      });
      const classifier = new OllamaMentionClassifier(configService(), fetchImpl);

      await expect(
        classifier.classify({ company, title: 'Harvey raises funding', outlet: 'TechCrunch' }),
      ).rejects.toBeInstanceOf(ClassificationFailedError);
    });

    it('throws ClassificationFailedError when the schema fields are the wrong type', async () => {
      const { fetch: fetchImpl } = stubbedFetch({
        chatContents: [
          JSON.stringify({ relevant: 'yes', sentiment: 'positive', confidence: 2, rationale: 123 }),
          JSON.stringify({ relevant: 'yes', sentiment: 'positive', confidence: 2, rationale: 123 }),
        ],
      });
      const classifier = new OllamaMentionClassifier(configService(), fetchImpl);

      await expect(
        classifier.classify({ company, title: 'Harvey raises funding', outlet: 'TechCrunch' }),
      ).rejects.toBeInstanceOf(ClassificationFailedError);
    });

    it('throws ClassificationFailedError without retrying on a transport failure', async () => {
      const fetchImpl: typeof fetch = () =>
        Promise.reject(new TypeError('fetch failed: connection refused'));
      const classifier = new OllamaMentionClassifier(configService(), fetchImpl);

      await expect(
        classifier.classify({ company, title: 'Harvey raises funding', outlet: 'TechCrunch' }),
      ).rejects.toBeInstanceOf(ClassificationFailedError);
    });
  });
});
