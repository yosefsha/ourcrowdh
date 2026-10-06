import { Module } from '@nestjs/common';

/**
 * Intentionally empty. `NOTIFIER` (`notifier.js`) has no provider bound
 * yet — the Console notifier issue adds
 * `{ provide: NOTIFIER, useClass: ConsoleNotifier }` and re-exports the
 * token.
 */
@Module({})
export class AlertsModule {}
