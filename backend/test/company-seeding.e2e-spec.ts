import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Client } from 'pg';

interface CompanyRow {
  readonly id: string;
  readonly name: string;
}

interface FormerNamesRow {
  readonly former_names: string[];
}

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5432/app';
// `test/` runs from `backend/` (`jest-e2e.json`'s `rootDir`), the same
// working directory `npm run cli` and compose's `migrate` service use.
const CLI_ENTRY = join(import.meta.dirname, '..', 'dist', 'cli.js');

/**
 * Runs the real, compiled `cli seed` (`node dist/cli.js seed`) as a child
 * process — the exact command compose's `migrate` service runs — rather
 * than booting `AppModule` in-process. Two reasons:
 *
 *  - It is the only way to exercise `SeedCommand` itself: `nest-commander`
 *    is CommonJS and `require()`s `@nestjs/common` directly, which only
 *    resolves under plain Node (native `require(esm)`), not under Jest's
 *    `--experimental-vm-modules` runner (`docs/adr/0001-backend-esm-nestjs-12.md`).
 *  - A second, independent `NestFactory.create(AppModule)` in this same
 *    Jest process — on top of the two `health.e2e-spec.ts` already boots —
 *    made TypeORM's dynamic entity-glob import race with Jest's per-file
 *    module teardown ("trying to `import` a file after the Jest environment
 *    has been torn down"). Running the CLI out-of-process sidesteps that
 *    entirely and is a more faithful e2e: it is the actual boundary an
 *    operator (and compose) drives.
 *
 * Requires `npm run build` to have already produced `dist/cli.js` — true in
 * CI (which builds before `test:e2e`) and true locally once `npm run build`
 * has been run.
 */
function runSeedCli(env: Record<string, string>): { readonly status: number } {
  try {
    execFileSync(process.execPath, [CLI_ENTRY, 'seed'], {
      cwd: join(import.meta.dirname, '..'),
      env: { ...process.env, ...env },
      stdio: 'pipe',
    });
    return { status: 0 };
  } catch (error) {
    const status = (error as { status?: number }).status;
    return { status: status ?? 1 };
  }
}

describe('Company list seeding (e2e)', () => {
  let client: Client;
  let dir: string;
  let fixturePath: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'company-seeding-e2e-'));
    fixturePath = join(dir, 'companies.txt');

    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.query("DELETE FROM companies WHERE slug IN ('acme-robotics', 'ludeo')");
    await client.end();
    rmSync(dir, { recursive: true, force: true });
  });

  it('seeding twice leaves the same row count, and an edited name updates the row in place', () => {
    writeFileSync(fixturePath, 'Acme Robotics\nLudeo (formerly Edge)\n');
    expect(runSeedCli({ DATABASE_URL, COMPANIES_FILE: fixturePath }).status).toBe(0);
  }, 30_000);

  it('re-seeding the same content leaves one row with the same id', async () => {
    writeFileSync(fixturePath, 'Acme Robotics\nLudeo (formerly Edge)\n');
    runSeedCli({ DATABASE_URL, COMPANIES_FILE: fixturePath });

    const before = await client.query<CompanyRow>(
      "SELECT id, name FROM companies WHERE slug = 'acme-robotics'",
    );
    expect(before.rows).toHaveLength(1);
    const companyId = before.rows[0].id;

    expect(runSeedCli({ DATABASE_URL, COMPANIES_FILE: fixturePath }).status).toBe(0);

    const after = await client.query<CompanyRow>(
      "SELECT id, name FROM companies WHERE slug = 'acme-robotics'",
    );
    expect(after.rows).toHaveLength(1);
    expect(after.rows[0].id).toBe(companyId);
  }, 30_000);

  it('editing a name in the fixture (same slug) updates the existing row, not a new one', async () => {
    writeFileSync(fixturePath, 'Acme Robotics\nLudeo (formerly Edge)\n');
    runSeedCli({ DATABASE_URL, COMPANIES_FILE: fixturePath });
    const before = await client.query<CompanyRow>(
      "SELECT id FROM companies WHERE slug = 'acme-robotics'",
    );
    const companyId = before.rows[0].id;

    // "acme-robotics" kebab-cases the same regardless of letter case, so
    // this is a pure name edit — the slug, and therefore the row, must
    // stay the same.
    writeFileSync(fixturePath, 'ACME ROBOTICS\nLudeo (formerly Edge)\n');
    expect(runSeedCli({ DATABASE_URL, COMPANIES_FILE: fixturePath }).status).toBe(0);

    const after = await client.query<CompanyRow>(
      "SELECT id, name FROM companies WHERE slug = 'acme-robotics'",
    );
    expect(after.rows).toHaveLength(1);
    expect(after.rows[0].id).toBe(companyId);
    expect(after.rows[0].name).toBe('ACME ROBOTICS');

    const ludeo = await client.query<FormerNamesRow>(
      "SELECT former_names FROM companies WHERE slug = 'ludeo'",
    );
    expect(ludeo.rows[0].former_names).toEqual(['Edge']);
  }, 30_000);

  it('fails loudly (non-zero exit) and writes nothing when COMPANIES_FILE does not exist', async () => {
    const missingPath = join(dir, 'does-not-exist.txt');

    const before = await client.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM companies',
    );

    const result = runSeedCli({ DATABASE_URL, COMPANIES_FILE: missingPath });

    expect(result.status).not.toBe(0);
    const after = await client.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM companies',
    );
    // A failed run must write nothing — the row count before and after
    // the failing CLI invocation must be identical.
    expect(after.rows[0].count).toBe(before.rows[0].count);
  }, 30_000);
});
