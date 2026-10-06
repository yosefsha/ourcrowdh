import { TrackedCompany } from '../companies/company.js';

/**
 * Port for turning one Mention's headline into relevance + sentiment
 * (`docs/PLAN.md#ports`). One call returns both, as structured output from
 * the model — never two calls, never free text the caller has to parse.
 */
export type Sentiment = 'positive' | 'negative' | 'neutral';

export interface ClassificationInput {
  readonly company: TrackedCompany;
  readonly title: string;
  readonly outlet: string;
}

export type Classification =
  | { readonly relevant: false; readonly rationale: string; readonly model: string }
  | {
      readonly relevant: true;
      readonly sentiment: Sentiment;
      readonly confidence: number;
      readonly rationale: string;
      readonly model: string;
    };

export const MENTION_CLASSIFIER = Symbol('MENTION_CLASSIFIER');

export interface MentionClassifier {
  assertReady(): Promise<void>;
  classify(input: ClassificationInput): Promise<Classification>;
}

/** Thrown by `assertReady()`: the backend is unreachable or its model is not pulled. */
export class ClassifierUnavailableError extends Error {}

/** Thrown by `classify()`: the backend returned unusable output after its own retries. */
export class ClassificationFailedError extends Error {}
