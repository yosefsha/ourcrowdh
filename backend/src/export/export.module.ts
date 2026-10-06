import { Module } from '@nestjs/common';

/**
 * Intentionally empty. The Export issue adds its own read port
 * (`export/export-read-model.ts`, `docs/PLAN.md#ports`), its controller and
 * its provider binding here.
 */
@Module({})
export class ExportModule {}
