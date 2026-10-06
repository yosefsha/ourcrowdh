import { Logger } from '@nestjs/common';
import { jest } from '@jest/globals';
import { DateWindow, FetchedArticle } from '../news-source.js';
import { fetchWithBisection, FetchWindowFn } from './window-bisector.js';

function article(url: string, publishedAt: Date): FetchedArticle {
  return { url, title: 'Title', outlet: 'Outlet', publishedAt, source: 'google-news-rss' };
}

function articles(count: number, prefix: string, publishedAt: Date): FetchedArticle[] {
  return Array.from({ length: count }, (_, index) => article(`${prefix}/${index}`, publishedAt));
}

describe('fetchWithBisection', () => {
  it('returns the result unchanged when it is under the item cap', async () => {
    const window: DateWindow = {
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-01-10T00:00:00Z'),
    };
    const fetchWindow = jest
      .fn<FetchWindowFn>()
      .mockResolvedValue([article('https://a', window.from)]);

    const result = await fetchWithBisection(window, fetchWindow);

    expect(fetchWindow).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it('splits the window in half and merges results when the response hits the item cap', async () => {
    const window: DateWindow = {
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-01-11T00:00:00Z'),
    };
    const fetchWindow = jest
      .fn<FetchWindowFn>()
      .mockResolvedValueOnce(articles(100, 'https://capped', window.from))
      .mockResolvedValueOnce(articles(50, 'https://half1', window.from))
      .mockResolvedValueOnce(articles(50, 'https://half2', window.from));

    const result = await fetchWithBisection(window, fetchWindow);

    expect(fetchWindow).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(100);
    const halfWindows = jest
      .mocked(fetchWindow)
      .mock.calls.slice(1)
      .map((call) => call[0]);
    const [firstHalfWindow, secondHalfWindow] = halfWindows;
    expect(firstHalfWindow?.from).toEqual(window.from);
    expect(secondHalfWindow?.to).toEqual(window.to);
    expect(firstHalfWindow?.to).toEqual(secondHalfWindow?.from);
  });

  it('stops bisecting once the window has reached one day, even if still at the cap, and logs the truncation', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const window: DateWindow = {
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-01-02T00:00:00Z'),
    };
    const fetchWindow = jest
      .fn<FetchWindowFn>()
      .mockResolvedValue(articles(100, 'https://a', window.from));

    const result = await fetchWithBisection(window, fetchWindow);

    expect(fetchWindow).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(100);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('truncated');
    warnSpy.mockRestore();
  });

  it('de-duplicates by url across the two halves', async () => {
    const window: DateWindow = {
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-01-11T00:00:00Z'),
    };
    const shared = article('https://shared', window.from);
    const fetchWindow = jest
      .fn<FetchWindowFn>()
      .mockResolvedValueOnce(articles(100, 'https://capped', window.from))
      .mockResolvedValueOnce([shared])
      .mockResolvedValueOnce([shared]);

    const result = await fetchWithBisection(window, fetchWindow);

    expect(result.filter((candidate) => candidate.url === 'https://shared')).toHaveLength(1);
  });
});
