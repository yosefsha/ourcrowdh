import { NewMention } from '../alerts/notifier.js';
import { Classification } from '../classification/mention-classifier.js';
import { TrackedCompany } from '../companies/company.js';
import { FetchedArticle } from '../news/news-source.js';

/**
 * Write-side port for Mentions (`docs/PLAN.md#ports`), used by the Run
 * orchestrator. The read side (dashboard, export) goes through its own read
 * ports instead, so it never waits on this one.
 */
export interface PendingMention {
  readonly id: string;
  readonly company: TrackedCompany;
  readonly title: string;
  readonly outlet: string;
}

export const MENTION_WRITER = Symbol('MENTION_WRITER');

export interface MentionWriter {
  /** Idempotent on article url + company. Returns the count of new Mentions created. */
  recordDiscovered(
    runId: string,
    companyId: string,
    articles: readonly FetchedArticle[],
  ): Promise<number>;
  /** Pending Mentions plus ones a previous Run failed to classify. */
  findPending(): Promise<readonly PendingMention[]>;
  saveClassification(mentionId: string, result: Classification): Promise<void>;
  markFailed(mentionId: string, reason: string): Promise<void>;
  /**
   * Relevant Mentions never alerted (`alerted_run_id IS NULL`), published
   * since the cutoff — a New Mention is "never alerted", not "first seen in
   * this Run" (`CONTEXT.md#monitoring`, `docs/PLAN.md#run-pipeline`).
   */
  findUnalerted(publishedSince: Date): Promise<readonly NewMention[]>;
  /**
   * Marks the given Mentions alerted by this Run. Called only after
   * `Notifier.notify` resolves, so a Run that fails after `notify` succeeds
   * leaves these Mentions unalerted and the next Run re-alerts them —
   * at-least-once delivery, never zero (`docs/PLAN.md#run-pipeline`).
   */
  markAlerted(runId: string, mentionIds: readonly string[]): Promise<void>;
}
