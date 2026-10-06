import { NewsSourceError } from '../news-source.js';

const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 200;
/** Google News RSS normally answers in well under a second; a stalled connection is treated as a failure rather than hanging the Run. */
const REQUEST_TIMEOUT_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelayMs(attempt: number): number {
  return BACKOFF_BASE_MS * 2 ** (attempt - 1);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Fetches a Google News RSS feed over HTTP (`docs/PLAN.md#news-source-isolation`).
 * Owns the only `fetch` call in the adapter: a politeness delay between
 * requests, a per-request timeout, and a retry with exponential backoff on
 * `429`/`5xx` up to `MAX_ATTEMPTS`. Every failure — network-level, a timeout
 * or exhausted retries — surfaces as `NewsSourceError`; a raw fetch error or
 * HTTP status never reaches the caller.
 *
 * Requests are serialised through `queue`: concurrent `fetchRssFeed` calls
 * (e.g. several companies fetched with `Promise.all`) queue up rather than
 * racing past the politeness delay together, and the next slot is reserved
 * as soon as a request starts, not after it finishes.
 */
export class RssHttpClient {
  private nextRequestNotBefore = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly requestDelayMs: number) {}

  async fetchRssFeed(url: string, query: string): Promise<string> {
    const task = this.queue.then(() => this.runRequest(url, query));
    // Keep the chain alive on failure too, so a later queued call still gets its turn.
    this.queue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  private async runRequest(url: string, query: string): Promise<string> {
    await this.waitForPoliteness();
    this.reserveNextSlot();
    return this.fetchWithRetry(url, query, 1);
  }

  private async waitForPoliteness(): Promise<void> {
    const remaining = this.nextRequestNotBefore - Date.now();
    if (remaining > 0) {
      await sleep(remaining);
    }
  }

  private reserveNextSlot(): void {
    this.nextRequestNotBefore = Date.now() + this.requestDelayMs;
  }

  private async fetchWithRetry(url: string, query: string, attempt: number): Promise<string> {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      throw new NewsSourceError(
        `Google News RSS request failed for query "${query}": ${(error as Error).message}`,
      );
    }

    if (response.ok) {
      return await response.text();
    }

    if (isRetryableStatus(response.status) && attempt < MAX_ATTEMPTS) {
      await sleep(backoffDelayMs(attempt));
      return this.fetchWithRetry(url, query, attempt + 1);
    }

    throw new NewsSourceError(
      `Google News RSS request failed with status ${response.status} for query "${query}"`,
    );
  }
}
