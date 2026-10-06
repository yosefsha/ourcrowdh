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
    // `nest-commander`'s own default `serviceErrorHandler` only writes the
    // error to stderr and lets `CommandRunnerService#run` resolve — a
    // command that threw (e.g. `seed` on a missing `COMPANIES_FILE`) would
    // otherwise exit 0. Set a non-zero `process.exitCode` explicitly so a
    // failing command fails loudly for its caller (`docker compose`, CI, a
    // human at a shell), consistent with the `.catch()` below for anything
    // thrown before a command even runs.
    serviceErrorHandler: (error: Error) => {
      console.error('CLI command failed', error);
      process.exitCode = 1;
    },
  });
}

bootstrap().catch((error: unknown) => {
  console.error('CLI failed', error);
  process.exit(1);
});
