import 'reflect-metadata';
import { DataSource } from 'typeorm';
import configuration from '../config/configuration.js';
import { entityGlobs } from './entity-globs.js';

/**
 * Entry point for the TypeORM CLI (`npm run migration:run` /
 * `migration:generate`). It is run against the compiled output
 * (`dist/database/data-source.js`) so that the production image — built
 * with `npm ci --omit=dev` and therefore without `ts-node` — can apply
 * migrations with the exact same command CI uses.
 *
 * Reuses the same `configuration()` factory the app bootstraps with, so
 * `process.env` is still only read in `config/configuration.ts`.
 */
const appConfig = configuration();

// The TypeORM CLI requires the file it is pointed at to contain exactly one
// `DataSource` export — a default export only, nothing named alongside it.
export default new DataSource({
  type: 'postgres',
  url: appConfig.databaseUrl,
  ...entityGlobs(import.meta.dirname),
  synchronize: false,
});
