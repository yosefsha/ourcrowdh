import { reportRunResult } from './report-run-result.js';
import { RunRecord } from './run.repository.js';

const succeededRun: RunRecord = {
  id: 'run-1',
  trigger: 'cli',
  status: 'succeeded',
  startedAt: new Date('2026-01-01T00:00:00Z'),
  finishedAt: new Date('2026-01-01T00:01:00Z'),
  articlesFetched: 3,
  mentionsDiscovered: 2,
  mentionsClassified: 2,
  classificationFailures: 0,
  newMentions: 1,
  error: null,
};

const failedRun: RunRecord = {
  ...succeededRun,
  status: 'failed',
  error: 'Ollama unreachable',
};

describe('reportRunResult', () => {
  const originalExitCode = process.exitCode;
  const originalLog = console.log;
  const originalError = console.error;
  let logged: string[];
  let errored: string[];

  beforeEach(() => {
    process.exitCode = undefined;
    logged = [];
    errored = [];
    console.log = (message: string): void => {
      logged.push(message);
    };
    console.error = (message: string): void => {
      errored.push(message);
    };
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    console.log = originalLog;
    console.error = originalError;
  });

  it('leaves process.exitCode unset and logs a summary on a succeeded Run', () => {
    reportRunResult(succeededRun);

    expect(process.exitCode).toBeUndefined();
    expect(errored).toEqual([]);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('run-1');
    expect(logged[0]).toContain('1 new mentions alerted');
  });

  it('sets process.exitCode to 1 and logs the error on a failed Run', () => {
    reportRunResult(failedRun);

    expect(process.exitCode).toBe(1);
    expect(logged).toEqual([]);
    expect(errored).toHaveLength(1);
    expect(errored[0]).toContain('Ollama unreachable');
  });
});
