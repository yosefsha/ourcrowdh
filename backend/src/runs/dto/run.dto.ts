import { RunRecord, RunStatus, RunTrigger } from '../run.repository.js';

/**
 * Response shape of a Run (`docs/PLAN.md#http-api`). Not request input, so
 * no class-validator decorators — but still a class, consistent with every
 * other response shape in this codebase.
 */
export class RunDto {
  readonly id: string;
  readonly trigger: RunTrigger;
  readonly status: RunStatus;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly articlesFetched: number;
  readonly mentionsDiscovered: number;
  readonly mentionsClassified: number;
  readonly classificationFailures: number;
  readonly newMentions: number;
  readonly error: string | null;

  constructor(record: RunRecord) {
    this.id = record.id;
    this.trigger = record.trigger;
    this.status = record.status;
    this.startedAt = record.startedAt.toISOString();
    this.finishedAt = record.finishedAt ? record.finishedAt.toISOString() : null;
    this.articlesFetched = record.articlesFetched;
    this.mentionsDiscovered = record.mentionsDiscovered;
    this.mentionsClassified = record.mentionsClassified;
    this.classificationFailures = record.classificationFailures;
    this.newMentions = record.newMentions;
    this.error = record.error;
  }
}
