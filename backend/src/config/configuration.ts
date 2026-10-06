import { resolve } from 'path';

/**
 * Typed shape of the application configuration. This is the only place in the
 * codebase (besides this file itself) that is allowed to know the raw
 * environment variable names — everything else reads through `ConfigService`.
 */
export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly staticDir: string;
  readonly ollamaUrl: string;
  readonly ollamaModel: string;
  readonly companiesFile: string;
  readonly schedulerEnabled: boolean;
  readonly runCron: string;
  readonly backfillDays: number;
  readonly alertWindowHours: number;
}

/**
 * Config factory registered with `ConfigModule.forRoot({ load: [configuration] })`.
 * `process.env` is read here and nowhere else in the application; every other
 * module reads the typed values back out through `ConfigService`.
 */
export default function configuration(): AppConfig {
  return {
    port: parseInt(process.env.PORT ?? '8000', 10),
    databaseUrl: process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5432/app',
    // Resolved from `backend/` — the default assumes npm scripts run with
    // `backend/` as the working directory, as they do locally and in CI.
    staticDir: process.env.STATIC_DIR ?? resolve(process.cwd(), '../frontend/dist'),
    ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL ?? 'qwen2.5:7b',
    companiesFile: process.env.COMPANIES_FILE ?? resolve(process.cwd(), 'seed/companies.txt'),
    schedulerEnabled: (process.env.SCHEDULER_ENABLED ?? 'false').toLowerCase() === 'true',
    runCron: process.env.RUN_CRON ?? '0 6 * * *',
    backfillDays: parseInt(process.env.BACKFILL_DAYS ?? '90', 10),
    alertWindowHours: parseInt(process.env.ALERT_WINDOW_HOURS ?? '48', 10),
  };
}
