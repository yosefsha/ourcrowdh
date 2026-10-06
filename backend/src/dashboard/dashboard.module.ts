import { Module } from '@nestjs/common';

/**
 * Intentionally empty. The Dashboard API issue adds its own read port
 * (`dashboard/dashboard-read-model.ts`, `docs/PLAN.md#ports`), its
 * controller and its provider binding here.
 */
@Module({})
export class DashboardModule {}
