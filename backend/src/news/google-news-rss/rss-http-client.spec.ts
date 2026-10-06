import { jest } from '@jest/globals';
import { NewsSourceError } from '../news-source.js';
import { RssHttpClient } from './rss-http-client.js';

describe('RssHttpClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('returns the response body on a successful fetch', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<rss></rss>', { status: 200 }));
    const client = new RssHttpClient(0);

    const body = await client.fetchRssFeed('https://news.google.com/rss/search?q=x', 'x');

    expect(body).toBe('<rss></rss>');
  });

  it('retries a 429 with backoff and succeeds once Google stops throttling', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('<rss>ok</rss>', { status: 200 }));
    const client = new RssHttpClient(0);

    const promise = client.fetchRssFeed('https://news.google.com/rss/search?q=x', 'x');
    await jest.runAllTimersAsync();
    const body = await promise;

    expect(body).toBe('<rss>ok</rss>');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a 5xx with backoff and succeeds once Google recovers', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('<rss>ok</rss>', { status: 200 }));
    const client = new RssHttpClient(0);

    const promise = client.fetchRssFeed('https://news.google.com/rss/search?q=x', 'x');
    await jest.runAllTimersAsync();
    const body = await promise;

    expect(body).toBe('<rss>ok</rss>');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws NewsSourceError carrying the status and query after exhausting the retry budget', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 503 }));
    const client = new RssHttpClient(0);

    const promise = client.fetchRssFeed('https://news.google.com/rss/search?q=x', 'my query');
    const assertion = expect(promise).rejects.toThrow(/503/);
    await jest.runAllTimersAsync();
    await assertion;
    await expect(promise).rejects.toBeInstanceOf(NewsSourceError);
    await expect(promise).rejects.toThrow(/my query/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('wraps a network-level failure as NewsSourceError without leaking it', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network down'));
    const client = new RssHttpClient(0);

    await expect(
      client.fetchRssFeed('https://news.google.com/rss/search?q=x', 'x'),
    ).rejects.toBeInstanceOf(NewsSourceError);
  });

  it('does not retry a non-retryable 4xx status', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 404 }));
    const client = new RssHttpClient(0);

    await expect(
      client.fetchRssFeed('https://news.google.com/rss/search?q=x', 'x'),
    ).rejects.toBeInstanceOf(NewsSourceError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('waits at least requestDelayMs before issuing the next request', async () => {
    jest.useFakeTimers();
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response('ok', { status: 200 })));
    const client = new RssHttpClient(1000);

    await client.fetchRssFeed('https://news.google.com/rss/search?q=x', 'x');
    let resolved = false;
    void client.fetchRssFeed('https://news.google.com/rss/search?q=x', 'x').then(() => {
      resolved = true;
    });

    await jest.advanceTimersByTimeAsync(500);
    expect(resolved).toBe(false);

    await jest.advanceTimersByTimeAsync(600);
    expect(resolved).toBe(true);
  });
});
