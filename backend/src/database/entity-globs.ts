import { join } from 'path';

/**
 * The glob patterns TypeORM uses to discover entities and migrations,
 * relative to this directory. Shared between `database.module.ts` (the
 * Nest app, wired through `ConfigService`) and `data-source.ts` (the
 * TypeORM CLI entry point, which has no DI container to read config
 * through) so the two connection definitions cannot drift apart.
 */
export interface EntityGlobs {
  // TypeORM's own `DataSourceOptions` type requires mutable arrays here.
  readonly entities: string[];
  readonly migrations: string[];
}

export function entityGlobs(databaseDir: string): EntityGlobs {
  return {
    entities: [join(databaseDir, '..', '**', '*.entity{.ts,.js}')],
    migrations: [join(databaseDir, '..', 'migrations', '*{.ts,.js}')],
  };
}
