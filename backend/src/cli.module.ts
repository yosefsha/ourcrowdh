import { Module } from '@nestjs/common';

/**
 * Root module for the CLI shell (`npm run cli`, `docs/PLAN.md#decisions`:
 * "One entry point, `cli run`"). No commands are registered yet — each
 * owning feature module adds its own `nest-commander` `CommandRunner` (and
 * imports whatever it needs) once that feature exists: `cli seed`
 * (Seed loader), `cli run` (Run orchestrator).
 */
@Module({})
export class CliModule {}
