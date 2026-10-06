import configuration from './configuration.js';

describe('configuration', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns the documented defaults when no environment variables are set', () => {
    delete process.env.PORT;
    delete process.env.DATABASE_URL;
    delete process.env.OLLAMA_URL;
    delete process.env.OLLAMA_MODEL;
    delete process.env.SCHEDULER_ENABLED;
    delete process.env.RUN_CRON;
    delete process.env.BACKFILL_DAYS;
    delete process.env.ALERT_WINDOW_HOURS;

    const config = configuration();

    expect(config.port).toBe(8000);
    expect(config.databaseUrl).toBe('postgresql://app:app@localhost:5432/app');
    expect(config.ollamaUrl).toBe('http://localhost:11434');
    expect(config.ollamaModel).toBe('qwen2.5:7b');
    expect(config.schedulerEnabled).toBe(false);
    expect(config.runCron).toBe('0 6 * * *');
    expect(config.backfillDays).toBe(90);
    expect(config.alertWindowHours).toBe(48);
  });

  it('reads every overridden variable instead of the default', () => {
    process.env.PORT = '9001';
    process.env.DATABASE_URL = 'postgresql://app:app@db:5432/app';
    process.env.STATIC_DIR = '/app/public';
    process.env.OLLAMA_URL = 'http://ollama:11434';
    process.env.OLLAMA_MODEL = 'llama3';
    process.env.COMPANIES_FILE = '/data/companies.txt';
    process.env.SCHEDULER_ENABLED = 'true';
    process.env.RUN_CRON = '0 */4 * * *';
    process.env.BACKFILL_DAYS = '30';
    process.env.ALERT_WINDOW_HOURS = '12';

    const config = configuration();

    expect(config).toEqual({
      port: 9001,
      databaseUrl: 'postgresql://app:app@db:5432/app',
      staticDir: '/app/public',
      ollamaUrl: 'http://ollama:11434',
      ollamaModel: 'llama3',
      companiesFile: '/data/companies.txt',
      schedulerEnabled: true,
      runCron: '0 */4 * * *',
      backfillDays: 30,
      alertWindowHours: 12,
    });
  });
});
