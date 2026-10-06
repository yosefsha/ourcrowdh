import { RunRecord } from './run.repository.js';

/**
 * Prints a Run's outcome for `cli run` and sets a non-zero exit code on
 * failure. Pulled out of `RunCommand` so it stays unit-testable without
 * importing `nest-commander`: that package is CommonJS and `require()`s
 * `@nestjs/common` directly, which Jest's module loader cannot resolve on
 * this Node version (`@nestjs/common` is ESM-only — `docs/adr/0001` — and
 * real Node handles the interop fine, `node dist/cli.js` proves it, but
 * Jest's own CJS `require()` path does not). `process.exitCode`, not
 * `process.exit()`, so `CommandFactory.run()` can finish its own cleanup
 * before Node exits with that code.
 */
export function reportRunResult(record: RunRecord): void {
  if (record.status === 'failed') {
    console.error(`Run failed: ${record.error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Run ${record.id} succeeded: ${record.articlesFetched} articles fetched, ` +
      `${record.mentionsDiscovered} mentions discovered, ${record.mentionsClassified} classified ` +
      `(${record.classificationFailures} failures), ${record.newMentions} new mentions alerted.`,
  );
}
