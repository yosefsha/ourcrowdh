import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Ollama } from 'ollama';
import { AppConfig } from '../../config/configuration.js';
import {
  Classification,
  ClassificationFailedError,
  ClassificationInput,
  ClassifierUnavailableError,
  MentionClassifier,
} from '../mention-classifier.js';
import { buildMessages, CLASSIFICATION_RESPONSE_SCHEMA } from '../prompt.js';
import { RawClassificationResponseDto } from './raw-classification-response.dto.js';

/**
 * Every Ollama HTTP call — `assertReady()`'s `/api/tags` and `classify()`'s
 * `/api/chat` — is bounded by this timeout. Without it, a stalled
 * connection (model still loading, a GPU hang) would leave `classify()`
 * unsettled forever: neither the retry nor `ClassificationFailedError`
 * could ever fire, and a caller iterating Mentions would hang.
 */
const REQUEST_TIMEOUT_MS = 120_000;

/** Longest excerpt of a raw model reply ever embedded in an error message, so an unbounded reply can't end up in logs. */
const MAX_REPLY_EXCERPT_LENGTH = 200;

/** Internal only: raised when the model's reply is not usable JSON for the schema. Never crosses `classify()`. */
class SchemaViolationError extends Error {}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function excerpt(text: string): string {
  return text.length > MAX_REPLY_EXCERPT_LENGTH
    ? `${text.slice(0, MAX_REPLY_EXCERPT_LENGTH)}…`
    : text;
}

/**
 * Wraps a `fetch` implementation so every request it makes aborts after
 * `timeoutMs` rather than hanging indefinitely. The `ollama` client's
 * non-streaming calls (`chat()`, `list()`) pass no `signal` of their own,
 * so this is the only place such a timeout can be enforced.
 */
function withTimeout(fetchImpl: typeof fetch, timeoutMs: number): typeof fetch {
  return (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): ReturnType<typeof fetch> =>
    fetchImpl(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Copies only the four fields the schema defines onto a fresh plain
 * object before handing it to `class-transformer`. The model's JSON is
 * untrusted text parsed off the wire — passing it to `plainToInstance`
 * unfiltered would let a `__proto__` key reach `Object.assign`-style
 * property assignment; picking fields by name here closes that off
 * regardless of what the reply happens to contain.
 */
function pickRawFields(parsed: unknown): Record<string, unknown> {
  if (!isRecord(parsed)) {
    return {};
  }
  return {
    relevant: parsed.relevant,
    sentiment: parsed.sentiment,
    confidence: parsed.confidence,
    rationale: parsed.rationale,
  };
}

/**
 * `MentionClassifier` (`docs/PLAN.md#ports`) over a local Ollama model,
 * using structured output: a JSON schema in `format` and `temperature: 0`,
 * so the reply is parsed, never scraped from free text. The system message,
 * few-shot examples and schema it sends on every call live in `../prompt.ts`.
 */
@Injectable()
export class OllamaMentionClassifier implements MentionClassifier {
  private readonly client: Ollama;
  private readonly url: string;
  private readonly model: string;

  constructor(configService: ConfigService<AppConfig, true>, @Optional() fetchImpl?: typeof fetch) {
    this.url = configService.get('ollamaUrl', { infer: true });
    this.model = configService.get('ollamaModel', { infer: true });
    this.client = new Ollama({
      host: this.url,
      fetch: withTimeout(fetchImpl ?? fetch, REQUEST_TIMEOUT_MS),
    });
  }

  async assertReady(): Promise<void> {
    const tags = await this.client.list().catch((error: unknown) => {
      throw new ClassifierUnavailableError(
        `Ollama not reachable at ${this.url} — start it with \`ollama serve\` or \`brew services start ollama\` (${describe(error)})`,
      );
    });

    const isPulled = tags.models.some(
      (model) => model.model === this.model || model.name === this.model,
    );
    if (!isPulled) {
      throw new ClassifierUnavailableError(
        `model ${this.model} not found — run \`ollama pull ${this.model}\``,
      );
    }
  }

  async classify(input: ClassificationInput): Promise<Classification> {
    try {
      return await this.requestClassification(input);
    } catch (firstAttemptError) {
      if (!(firstAttemptError instanceof SchemaViolationError)) {
        throw new ClassificationFailedError(
          `Ollama classification request failed for "${input.title}": ${describe(firstAttemptError)}`,
        );
      }
      try {
        return await this.requestClassification(input);
      } catch (retryError) {
        throw new ClassificationFailedError(
          `Ollama returned an unusable response for "${input.title}" after one retry: ${describe(retryError)}`,
        );
      }
    }
  }

  private async requestClassification(input: ClassificationInput): Promise<Classification> {
    const response = await this.client.chat({
      model: this.model,
      messages: buildMessages(input),
      format: CLASSIFICATION_RESPONSE_SCHEMA,
      options: { temperature: 0 },
      stream: false,
    });
    return this.toClassification(response.message.content);
  }

  private toClassification(content: string): Classification {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new SchemaViolationError(`model reply was not valid JSON: ${excerpt(content)}`);
    }

    const dto = plainToInstance(RawClassificationResponseDto, pickRawFields(parsed));
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });
    if (errors.length > 0) {
      throw new SchemaViolationError(errors.map((error) => error.toString()).join('; '));
    }

    if (!dto.relevant) {
      return { relevant: false, rationale: dto.rationale, model: this.model };
    }
    if (dto.sentiment === null) {
      throw new SchemaViolationError('relevant mention was returned without a sentiment');
    }
    return {
      relevant: true,
      sentiment: dto.sentiment,
      confidence: dto.confidence,
      rationale: dto.rationale,
      model: this.model,
    };
  }
}
