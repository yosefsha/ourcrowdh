import { Module } from '@nestjs/common';

/**
 * Intentionally empty. `RUN_REPOSITORY` (`run.repository.js`) has no
 * provider bound yet — the Run orchestrator issue adds
 * `{ provide: RUN_REPOSITORY, useClass: PostgresRunRepository }` and
 * re-exports the token.
 */
@Module({})
export class RunsModule {}
