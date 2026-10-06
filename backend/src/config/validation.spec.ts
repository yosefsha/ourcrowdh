import type { ValidationResult } from 'joi';
import { validationSchema } from './validation.js';

describe('validationSchema', () => {
  it('accepts an empty environment and fills in every default', () => {
    const result: ValidationResult = validationSchema.validate({}, { abortEarly: false });
    // `ValidationResult.value` is `any` on Joi's own error branch of the
    // union, so it is read (and cast) separately rather than destructured.
    const value = result.value as Record<string, unknown>;

    expect(result.error).toBeUndefined();
    expect(value).toMatchObject({
      PORT: 8000,
      DATABASE_URL: 'postgresql://app:app@localhost:5432/app',
      OLLAMA_URL: 'http://localhost:11434',
      OLLAMA_MODEL: 'qwen2.5:7b',
      SCHEDULER_ENABLED: false,
      RUN_CRON: '0 6 * * *',
      BACKFILL_DAYS: 90,
      ALERT_WINDOW_HOURS: 48,
    });
  });

  it('accepts a fully specified, valid environment', () => {
    const { error }: ValidationResult = validationSchema.validate(
      {
        PORT: '9000',
        DATABASE_URL: 'postgresql://app:app@db:5432/app',
        STATIC_DIR: '/app/public',
        OLLAMA_URL: 'http://ollama:11434',
        OLLAMA_MODEL: 'qwen2.5:7b',
        COMPANIES_FILE: 'seed/companies.txt',
        SCHEDULER_ENABLED: 'true',
        RUN_CRON: '0 6 * * *',
        BACKFILL_DAYS: '30',
        ALERT_WINDOW_HOURS: '24',
      },
      { abortEarly: false },
    );

    expect(error).toBeUndefined();
  });

  it('rejects a non-numeric PORT', () => {
    const { error }: ValidationResult = validationSchema.validate(
      { PORT: 'not-a-number' },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/PORT/);
  });

  it('rejects a malformed DATABASE_URL', () => {
    const { error }: ValidationResult = validationSchema.validate(
      { DATABASE_URL: 'not a url' },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/DATABASE_URL/);
  });

  it('rejects a DATABASE_URL with an unsupported scheme', () => {
    const { error }: ValidationResult = validationSchema.validate(
      { DATABASE_URL: 'mysql://app:app@localhost:3306/app' },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/DATABASE_URL/);
  });

  it('rejects a non-URL OLLAMA_URL', () => {
    const { error }: ValidationResult = validationSchema.validate(
      { OLLAMA_URL: 'definitely-not-a-url' },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/OLLAMA_URL/);
  });

  it('rejects a non-integer BACKFILL_DAYS', () => {
    const { error }: ValidationResult = validationSchema.validate(
      { BACKFILL_DAYS: 'ninety' },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/BACKFILL_DAYS/);
  });
});
