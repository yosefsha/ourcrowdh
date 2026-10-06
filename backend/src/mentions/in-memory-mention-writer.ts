import { randomUUID } from 'crypto';
import { NewMention } from '../alerts/notifier.js';
import { Classification, Sentiment } from '../classification/mention-classifier.js';
import { TrackedCompany } from '../companies/company.js';
import { FetchedArticle } from '../news/news-source.js';
import { MentionWriter, PendingMention } from './mention-writer.js';

interface StoredMention {
  readonly id: string;
  readonly articleUrl: string;
  readonly articleTitle: string;
  readonly articleOutlet: string;
  readonly articlePublishedAt: Date;
  readonly companyId: string;
  readonly firstSeenRunId: string;
  classificationStatus: 'pending' | 'classified' | 'failed';
  relevant: boolean | null;
  sentiment: Sentiment | null;
  failureReason: string | null;
}

/**
 * In-memory fake for `MentionWriter`. `recordDiscovered` is idempotent on
 * article url + company, exactly like the real (Postgres, unique on
 * `(article_id, company_id)`) implementation. Resolving a Mention's
 * `TrackedCompany` for `findPending`/`findNewMentions` needs a company
 * lookup the port itself does not carry (`recordDiscovered` only takes a
 * `companyId`) — a test supplies one via the constructor, keyed by id.
 */
export class InMemoryMentionWriter implements MentionWriter {
  private readonly mentions: StoredMention[] = [];

  constructor(private readonly companiesById: ReadonlyMap<string, TrackedCompany> = new Map()) {}

  async recordDiscovered(
    runId: string,
    companyId: string,
    articles: readonly FetchedArticle[],
  ): Promise<number> {
    let created = 0;
    for (const article of articles) {
      const alreadyRecorded = this.mentions.some(
        (mention) => mention.articleUrl === article.url && mention.companyId === companyId,
      );
      if (alreadyRecorded) {
        continue;
      }
      this.mentions.push({
        id: randomUUID(),
        articleUrl: article.url,
        articleTitle: article.title,
        articleOutlet: article.outlet,
        articlePublishedAt: article.publishedAt,
        companyId,
        firstSeenRunId: runId,
        classificationStatus: 'pending',
        relevant: null,
        sentiment: null,
        failureReason: null,
      });
      created += 1;
    }
    return Promise.resolve(created);
  }

  async findPending(): Promise<readonly PendingMention[]> {
    const pending = this.mentions.filter(
      (mention) =>
        mention.classificationStatus === 'pending' || mention.classificationStatus === 'failed',
    );
    return Promise.resolve(
      pending.map((mention) => ({
        id: mention.id,
        company: this.resolveCompany(mention.companyId),
        title: mention.articleTitle,
        outlet: mention.articleOutlet,
      })),
    );
  }

  async saveClassification(mentionId: string, result: Classification): Promise<void> {
    const mention = this.findById(mentionId);
    mention.classificationStatus = 'classified';
    mention.relevant = result.relevant;
    mention.sentiment = result.relevant ? result.sentiment : null;
    mention.failureReason = null;
    return Promise.resolve();
  }

  async markFailed(mentionId: string, reason: string): Promise<void> {
    const mention = this.findById(mentionId);
    mention.classificationStatus = 'failed';
    mention.failureReason = reason;
    return Promise.resolve();
  }

  /** Test-only inspection hook — the port itself has no "read back a failure reason" method. */
  failureReasonFor(mentionId: string): string | null {
    return this.findById(mentionId).failureReason;
  }

  async findNewMentions(runId: string, publishedSince: Date): Promise<readonly NewMention[]> {
    const newMentions = this.mentions.filter(
      (mention) =>
        mention.firstSeenRunId === runId &&
        mention.classificationStatus === 'classified' &&
        mention.relevant === true &&
        mention.articlePublishedAt >= publishedSince,
    );
    return Promise.resolve(
      newMentions.map((mention) => ({
        companyName: this.resolveCompany(mention.companyId).name,
        title: mention.articleTitle,
        url: mention.articleUrl,
        outlet: mention.articleOutlet,
        publishedAt: mention.articlePublishedAt,
        // Non-null: `classificationStatus === 'classified' && relevant === true`
        // is only ever reached through `saveClassification`, which always sets
        // `sentiment` alongside a `relevant: true` result.
        sentiment: mention.sentiment!,
      })),
    );
  }

  private findById(mentionId: string): StoredMention {
    const mention = this.mentions.find((candidate) => candidate.id === mentionId);
    if (!mention) {
      throw new Error(`InMemoryMentionWriter has no mention with id "${mentionId}"`);
    }
    return mention;
  }

  private resolveCompany(companyId: string): TrackedCompany {
    const company = this.companiesById.get(companyId);
    if (!company) {
      throw new Error(`InMemoryMentionWriter has no company registered for id "${companyId}"`);
    }
    return company;
  }
}
