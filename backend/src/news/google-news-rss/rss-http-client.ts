import { NewsSourceError } from '../news-source.js';

const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 200;

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
 * requests, and a retry with exponential backoff on `429`/`5xx` up to
 * `MAX_ATTEMPTS`. Every failure — network-level or exhausted retries —
 * surfaces as `NewsSourceError`; a raw fetch error or HTTP status never
 * reaches the caller.
 */
export class RssHttpClient {
  private lastRequestAt = 0;

  constructor(private readonly requestDelayMs: number) {}

  async fetchRssFeed(url: string, query: string): Promise<string> {
    await this.waitForPoliteness();
    try {
      return await this.fetchWithRetry(url, query, 1);
    } finally {
      this.lastRequestAt = Date.now();
    }
  }

  private async waitForPoliteness(): Promise<void> {
    if (this.lastRequestAt === 0) {
      return;
    }
    const remaining = this.requestDelayMs - (Date.now() - this.lastRequestAt);
    if (remaining > 0) {
      await sleep(remaining);
    }
  }

  private async fetchWithRetry(url: string, query: string, attempt: number): Promise<string> {
    let response: Response;
    try {
      response = await fetch(url);
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
