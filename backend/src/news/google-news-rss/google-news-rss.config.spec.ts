import googleNewsRssConfig from './google-news-rss.config.js';

describe('googleNewsRssConfig', () => {
  const originalDelay = process.env.GOOGLE_NEWS_REQUEST_DELAY_MS;
  const originalLocale = process.env.GOOGLE_NEWS_LOCALE;

  afterEach(() => {
    if (originalDelay === undefined) {
      delete process.env.GOOGLE_NEWS_REQUEST_DELAY_MS;
    } else {
      process.env.GOOGLE_NEWS_REQUEST_DELAY_MS = originalDelay;
    }
    if (originalLocale === undefined) {
      delete process.env.GOOGLE_NEWS_LOCALE;
    } else {
      process.env.GOOGLE_NEWS_LOCALE = originalLocale;
    }
  });

  it('applies production-ready defaults when unset', () => {
    delete process.env.GOOGLE_NEWS_REQUEST_DELAY_MS;
    delete process.env.GOOGLE_NEWS_LOCALE;

    expect(googleNewsRssConfig()).toEqual({
      requestDelayMs: 1500,
      locale: 'hl=en-US&gl=US&ceid=US:en',
    });
  });

  it('reads overrides from the environment', () => {
    process.env.GOOGLE_NEWS_REQUEST_DELAY_MS = '2000';
    process.env.GOOGLE_NEWS_LOCALE = 'hl=fr-FR&gl=FR&ceid=FR:fr';

    expect(googleNewsRssConfig()).toEqual({
      requestDelayMs: 2000,
      locale: 'hl=fr-FR&gl=FR&ceid=FR:fr',
    });
  });

  it('fails loudly on a negative request delay', () => {
    process.env.GOOGLE_NEWS_REQUEST_DELAY_MS = '-5';

    expect(() => googleNewsRssConfig()).toThrow(/GOOGLE_NEWS_REQUEST_DELAY_MS/);
  });

  it('fails loudly on a malformed locale', () => {
    process.env.GOOGLE_NEWS_LOCALE = 'not-a-locale';

    expect(() => googleNewsRssConfig()).toThrow(/GOOGLE_NEWS_LOCALE/);
  });
});
