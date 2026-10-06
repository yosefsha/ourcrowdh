import { Command, CommandRunner } from 'nest-commander';
import { reportRunResult } from './report-run-result.js';
import { RunService } from './run.service.js';

/**
 * `cli run` (trigger `'cli'`, `docs/PLAN.md#decisions`: "One entry point,
 * `cli run`"). The reporting/exit-code logic lives in `report-run-result.ts`
 * (see its own doc comment for why), so this class is left as a thin,
 * untested-by-design adapter — the same shape as `main.ts`'s `bootstrap()`
 * or `RunsController`'s routes, which also are not where this codebase's
 * logic coverage lives.
 */
@Command({
  name: 'run',
  description: 'Run the Press Mentions Monitoring pipeline once: collect, classify, alert.',
})
export class RunCommand extends CommandRunner {
  constructor(private readonly runService: RunService) {
    super();
  }

  async run(): Promise<void> {
    const record = await this.runService.execute('cli');
    reportRunResult(record);
  }
}
