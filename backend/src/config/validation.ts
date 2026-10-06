import Joi from 'joi';

/**
 * Env schema for every variable owned by the global config factory
 * (`docs/PLAN.md#configuration`), excluding `GOOGLE_NEWS_*` — those belong to
 * the news-source adapter and are declared and validated there.
 *
 * `ConfigModule.forRoot({ validationSchema })` runs this against
 * `process.env` at boot; a value that fails validation stops the app from
 * starting rather than surfacing as an undefined at the first request.
 *
 * Unknown keys (every other environment variable the process happens to
 * have, e.g. `PATH`, `HOME`) are allowed — this schema only constrains the
 * keys it lists.
 */
export const validationSchema = Joi.object({
  PORT: Joi.number().port().default(8000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .default('postgresql://app:app@localhost:5432/app'),
  STATIC_DIR: Joi.string().optional(),
  OLLAMA_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:11434'),
  OLLAMA_MODEL: Joi.string().default('qwen2.5:7b'),
  COMPANIES_FILE: Joi.string().optional(),
  SCHEDULER_ENABLED: Joi.boolean().default(false),
  RUN_CRON: Joi.string().default('0 6 * * *'),
  BACKFILL_DAYS: Joi.number().integer().positive().default(90),
  ALERT_WINDOW_HOURS: Joi.number().integer().positive().default(48),
}).unknown(true);
