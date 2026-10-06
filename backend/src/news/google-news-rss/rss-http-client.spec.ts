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

  it('wraps a body-read failure as NewsSourceError instead of letting it escape', async () => {
    const response = new Response('<rss></rss>', { status: 200 });
    jest.spyOn(response, 'text').mockRejectedValue(new TypeError('stream closed'));
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    const client = new RssHttpClient(0);

    await expect(
      client.fetchRssFeed('https://news.google.com/rss/search?q=x', 'x'),
    ).rejects.toBeInstanceOf(NewsSourceError);
  });

  it('cancels the response body of a retried status before sleeping, instead of leaking the connection', async () => {
    jest.useFakeTimers();
    const throttled = new Response('', { status: 429 });
    if (!throttled.body) {
      throw new Error('test setup: Response.body was unexpectedly null');
    }
    const cancelSpy = jest.spyOn(throttled.body, 'cancel').mockResolvedValue(undefined);
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(throttled)
      .mockResolvedValueOnce(new Response('<rss>ok</rss>', { status: 200 }));
    const client = new RssHttpClient(0);

    const promise = client.fetchRssFeed('https://news.google.com/rss/search?q=x', 'x');
    await jest.runAllTimersAsync();
    await promise;

    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('wraps an aborted (timed-out) request as NewsSourceError without leaking it', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));
    const client = new RssHttpClient(0);

    await expect(
      client.fetchRssFeed('https://news.google.com/rss/search?q=x', 'x'),
    ).rejects.toBeInstanceOf(NewsSourceError);
  });

  it('passes an AbortSignal with a timeout on every request, so a stalled connection cannot hang the Run', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }));
    const client = new RssHttpClient(0);

    await client.fetchRssFeed('https://news.google.com/rss/search?q=x', 'x');

    const call = fetchMock.mock.calls[0];
    const options = call?.[1] as { signal?: unknown } | undefined;
    expect(options?.signal).toBeInstanceOf(AbortSignal);
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

  it('serialises concurrent calls so the politeness delay is never bypassed', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response('ok', { status: 200 })));
    const client = new RssHttpClient(1000);

    // Two calls fired without awaiting the first, as `Promise.all` over several companies would.
    const first = client.fetchRssFeed('https://news.google.com/rss/search?q=a', 'a');
    const second = client.fetchRssFeed('https://news.google.com/rss/search?q=b', 'b');

    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await Promise.all([first, second]);
  });
});
