import { Logger } from '@nestjs/common';
import { Alert, Notifier } from '../alerts/notifier.js';
import {
  Classification,
  ClassificationFailedError,
  MentionClassifier,
} from '../classification/mention-classifier.js';
import { CompanyRepository } from '../companies/company.repository.js';
import { MentionWriter } from '../mentions/mention-writer.js';
import { DateWindow, NewsSource, NewsSourceError } from '../news/news-source.js';
import { RunRecord, RunRepository, RunTrigger } from './run.repository.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** Mutable working copy of `RunCounts` — the port's own type is `readonly`. */
interface MutableRunCounts {
  articlesFetched: number;
  mentionsDiscovered: number;
  mentionsClassified: number;
  classificationFailures: number;
  newMentions: number;
}

function zeroCounts(): MutableRunCounts {
  return {
    articlesFetched: 0,
    mentionsDiscovered: 0,
    mentionsClassified: 0,
    classificationFailures: 0,
    newMentions: 0,
  };
}

/**
 * Orchestrates one Run (`docs/PLAN.md#run-pipeline`): collect, classify,
 * alert. Depends only on the six ports contracted in `docs/PLAN.md#ports` —
 * never on a concrete adapter — so it is unit-tested entirely against the
 * in-memory fakes and needs no change once the Postgres/Google/Ollama
 * adapters are bound behind those same tokens.
 */
export class RunService {
  private readonly logger = new Logger(RunService.name);

  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly newsSource: NewsSource,
    private readonly classifier: MentionClassifier,
    private readonly mentionWriter: MentionWriter,
    private readonly runRepository: RunRepository,
    private readonly notifier: Notifier,
    private readonly backfillDays: number,
    private readonly alertWindowHours: number,
  ) {}

  /**
   * Runs the whole pipeline to completion and resolves with the final
   * (`succeeded` or `failed`) `RunRecord` — used by the `cli run` command,
   * which awaits it to decide its exit code. Rejects with
   * `RunAlreadyInProgressError` if a Run already holds the lock, before any
   * Run row is created.
   */
  async execute(trigger: RunTrigger): Promise<RunRecord> {
    return this.runRepository.withLock(() => this.runPipeline(trigger));
  }

  /**
   * Acquires the lock and starts the Run, then continues the pipeline in
   * the background without the caller waiting for it to finish —
   * `RunsController` uses this so `POST /api/runs` can answer 202
   * immediately. Resolves as soon as the Run row exists (with the lock
   * still held for the rest of the pipeline); rejects with
   * `RunAlreadyInProgressError` if the lock is already held.
   */
  async startInBackground(trigger: RunTrigger): Promise<RunRecord> {
    return new Promise<RunRecord>((resolve, reject) => {
      this.runRepository
        .withLock(() => this.runPipeline(trigger, resolve))
        .catch((error: unknown) => {
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }

  async list(limit: number): Promise<readonly RunRecord[]> {
    return this.runRepository.list(limit);
  }

  private async runPipeline(
    trigger: RunTrigger,
    onStarted?: (run: RunRecord) => void,
  ): Promise<RunRecord> {
    const run = await this.runRepository.start(trigger);
    onStarted?.(run);
    const counts = zeroCounts();
    try {
      // Classifier unavailable fails fast, before any collection happens.
      await this.classifier.assertReady();
      const window = await this.computeWindow(run.startedAt);
      await this.collect(run.id, window, counts);
      await this.classify(counts);
      await this.alert(run, counts);
      await this.runRepository.finish(run.id, counts);
      return { ...run, ...counts, status: 'succeeded', finishedAt: new Date(), error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.runRepository.fail(run.id, message, counts);
      return { ...run, ...counts, status: 'failed', finishedAt: new Date(), error: message };
    }
  }

  /** Last successful Run start − 2 days → now; first Run: now − BACKFILL_DAYS → now. */
  private async computeWindow(now: Date): Promise<DateWindow> {
    const lastSuccessfulStart = await this.runRepository.lastSuccessfulStart();
    const from = lastSuccessfulStart
      ? new Date(lastSuccessfulStart.getTime() - 2 * DAY_MS)
      : new Date(now.getTime() - this.backfillDays * DAY_MS);
    return { from, to: now };
  }

  private async collect(
    runId: string,
    window: DateWindow,
    counts: MutableRunCounts,
  ): Promise<void> {
    const companies = await this.companyRepository.findAll();
    let failedCompanies = 0;
    for (const company of companies) {
      let articles;
      try {
        articles = await this.newsSource.fetchArticles(company, window);
      } catch (error) {
        if (error instanceof NewsSourceError) {
          failedCompanies += 1;
          this.logger.error(`NewsSource failed for "${company.slug}": ${error.message}`);
          continue;
        }
        throw error;
      }
      counts.articlesFetched += articles.length;
      counts.mentionsDiscovered += await this.mentionWriter.recordDiscovered(
        runId,
        company.id,
        articles,
      );
    }
    if (failedCompanies > 0) {
      this.logger.warn(
        `${failedCompanies} of ${companies.length} companies failed to fetch news this Run`,
      );
    }
  }

  private async classify(counts: MutableRunCounts): Promise<void> {
    const pending = await this.mentionWriter.findPending();
    for (const mention of pending) {
      try {
        const result: Classification = await this.classifier.classify({
          company: mention.company,
          title: mention.title,
          outlet: mention.outlet,
        });
        await this.mentionWriter.saveClassification(mention.id, result);
        counts.mentionsClassified += 1;
      } catch (error) {
        if (error instanceof ClassificationFailedError) {
          await this.mentionWriter.markFailed(mention.id, error.message);
          counts.classificationFailures += 1;
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Sends the Alert, then marks its Mentions alerted — in that order.
   * `markAlerted` runs only once `notify` has resolved, so if `notify`
   * throws, nothing is marked and these Mentions are offered again by the
   * next Run's `findUnalerted`. `counts.newMentions` is set right after
   * `notify` succeeds (not after `markAlerted`): if `markAlerted` itself
   * then throws, the Run still fails, but its recorded counts correctly
   * reflect the Alert that was actually sent — delivery is at-least-once,
   * never zero (`docs/PLAN.md#run-pipeline`).
   */
  private async alert(run: RunRecord, counts: MutableRunCounts): Promise<void> {
    const since = new Date(run.startedAt.getTime() - this.alertWindowHours * HOUR_MS);
    const newMentions = await this.mentionWriter.findUnalerted(since);
    const alert: Alert = { runId: run.id, generatedAt: run.startedAt, mentions: newMentions };
    await this.notifier.notify(alert);
    counts.newMentions = newMentions.length;
    if (newMentions.length > 0) {
      await this.mentionWriter.markAlerted(
        run.id,
        newMentions.map((mention) => mention.mentionId),
      );
    }
  }
}
