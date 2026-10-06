import { CommandFactory } from 'nest-commander';
import { CliModule } from './cli.module.js';

/**
 * Entry point for `npm run cli` (`node dist/cli.js`). A `nest-commander`
 * shell with no commands yet — `cli seed` and `cli run` are added by the
 * modules that own them (`docs/PLAN.md#file-ownership`).
 */
async function bootstrap(): Promise<void> {
  await CommandFactory.run(CliModule, {
    logger: ['warn', 'error'],
  });
}

bootstrap().catch((error: unknown) => {
  console.error('CLI failed', error);
  process.exit(1);
});
