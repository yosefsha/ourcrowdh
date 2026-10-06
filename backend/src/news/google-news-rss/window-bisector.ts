import { DateWindow, FetchedArticle } from '../news-source.js';

/** Google News RSS search truncates a feed once it reaches this many items. */
const GOOGLE_NEWS_ITEM_CAP = 100;
const MIN_WINDOW_DAYS = 1;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type FetchWindowFn = (window: DateWindow) => Promise<readonly FetchedArticle[]>;

/**
 * Works around Google News RSS's item cap (`docs/PLAN.md#news-source-isolation`):
 * when `fetchWindow` returns `GOOGLE_NEWS_ITEM_CAP` or more Articles, the
 * feed may have been truncated, so the window is split in half and each
 * half is fetched (and, if necessary, bisected again) until the window
 * reaches `MIN_WINDOW_DAYS` or the result falls under the cap. Results from
 * every half are merged and de-duplicated by url — the same Article can
 * appear in both the capped fetch and a half once it is re-fetched.
 */
export async function fetchWithBisection(
  window: DateWindow,
  fetchWindow: FetchWindowFn,
): Promise<readonly FetchedArticle[]> {
  const results = await fetchWindow(window);
  if (results.length < GOOGLE_NEWS_ITEM_CAP || !canBisect(window)) {
    return dedupeByUrl(results);
  }

  const midpoint = new Date((window.from.getTime() + window.to.getTime()) / 2);
  const firstHalf = await fetchWithBisection({ from: window.from, to: midpoint }, fetchWindow);
  const secondHalf = await fetchWithBisection({ from: midpoint, to: window.to }, fetchWindow);
  return dedupeByUrl([...firstHalf, ...secondHalf]);
}

function canBisect(window: DateWindow): boolean {
  const spanDays = (window.to.getTime() - window.from.getTime()) / ONE_DAY_MS;
  return spanDays > MIN_WINDOW_DAYS;
}

function dedupeByUrl(articles: readonly FetchedArticle[]): readonly FetchedArticle[] {
  const seenUrls = new Set<string>();
  const deduped: FetchedArticle[] = [];
  for (const article of articles) {
    if (seenUrls.has(article.url)) {
      continue;
    }
    seenUrls.add(article.url);
    deduped.push(article);
  }
  return deduped;
}
