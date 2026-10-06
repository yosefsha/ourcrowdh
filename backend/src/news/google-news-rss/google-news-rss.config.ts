import { registerAs } from '@nestjs/config';
import Joi from 'joi';

/**
 * Settings owned by the Google News RSS adapter (`docs/PLAN.md#configuration`).
 * Unlike the global `AppConfig`, these are declared and validated here, not
 * in `config/validation.ts` — the adapter is the only thing that knows these
 * variables exist, so it is the only thing that should validate them.
 */
export interface GoogleNewsRssConfig {
  /** Politeness delay between consecutive requests to Google News. */
  readonly requestDelayMs: number;
  /** Google News edition query string, e.g. `hl=en-US&gl=US&ceid=US:en`. */
  readonly locale: string;
}

export const GOOGLE_NEWS_RSS_CONFIG_TOKEN = 'googleNews';

interface GoogleNewsRssEnv {
  readonly GOOGLE_NEWS_REQUEST_DELAY_MS: number;
  readonly GOOGLE_NEWS_LOCALE: string;
}

const envSchema = Joi.object<GoogleNewsRssEnv>({
  GOOGLE_NEWS_REQUEST_DELAY_MS: Joi.number().integer().min(0).default(1500),
  GOOGLE_NEWS_LOCALE: Joi.string()
    .pattern(/^hl=[\w-]+&gl=[\w-]+&ceid=[\w-]+:[\w-]+$/)
    .default('hl=en-US&gl=US&ceid=US:en'),
}).unknown(true);

/**
 * Config factory registered with `ConfigModule.forFeature` in `news.module.ts`
 * — the `GOOGLE_NEWS_*` variables never reach the global schema. An invalid
 * value fails the boot the same way the global schema does, rather than
 * surfacing as a bad query at the first Run.
 */
export default registerAs(GOOGLE_NEWS_RSS_CONFIG_TOKEN, (): GoogleNewsRssConfig => {
  // Narrow on `result.error` (not destructured) so `result.value` stays
  // typed as `GoogleNewsRssEnv` in the success branch — Joi's own typings
  // widen `value` to `any` in the union's error branch.
  const result = envSchema.validate(process.env, { abortEarly: false });
  if (result.error) {
    throw new Error(`Invalid Google News RSS configuration: ${result.error.message}`);
  }
  return {
    requestDelayMs: result.value.GOOGLE_NEWS_REQUEST_DELAY_MS,
    locale: result.value.GOOGLE_NEWS_LOCALE,
  };
});
