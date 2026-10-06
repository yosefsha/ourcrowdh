import { Sentiment } from '../classification/mention-classifier.js';

/**
 * Port for sending the Alert a Run produces (`docs/PLAN.md#ports`). Called
 * every Run, even when `mentions` is empty — an empty Alert still notifies
 * that nothing new was found.
 */
export interface NewMention {
  readonly mentionId: string;
  readonly companyName: string;
  readonly title: string;
  readonly url: string;
  readonly outlet: string;
  readonly publishedAt: Date;
  readonly sentiment: Sentiment;
}

export interface Alert {
  readonly runId: string;
  readonly generatedAt: Date;
  readonly mentions: readonly NewMention[];
}

export const NOTIFIER = Symbol('NOTIFIER');

export interface Notifier {
  notify(alert: Alert): Promise<void>;
}
