import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { HttpStatus, INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

/**
 * Boots the real `AppModule` the same way `main.ts` does.
 *
 * `Test.createTestingModule().compile()` resolves `ServeStaticModule`'s
 * loader provider before `HttpAdapterHost` has a real adapter attached
 * (that only happens once `createNestApplication()` runs), so it freezes in
 * a no-op loader and static/SPA serving silently never wires up. Going
 * through `NestFactory.create` directly — the same path production uses —
 * avoids that ordering trap entirely.
 */
async function bootstrapTestApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  await app.init();
  return app;
}

// `@types/superagent` (pulled in transitively by `@types/supertest`) does not
// currently publish a type for the thenable `Test` returns — it still
// resolves at runtime, so this describes the shape supertest actually
// hands back instead of fighting the upstream types.
interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Record<string, string>;
  readonly text: string;
}

async function httpGet(app: INestApplication, path: string): Promise<HttpResponse> {
  // `INestApplication#getHttpServer()` is typed `any` in `@nestjs/common`;
  // it is always the underlying Express server once `app.init()` has run.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return await request(app.getHttpServer()).get(path);
}

describe('Health & SPA serving (e2e)', () => {
  let app: INestApplication;
  let staticDir: string;

  beforeAll(async () => {
    // A temp dir fixture, per the issue's acceptance criteria — created fresh
    // for this run rather than committed, so nothing here can drift from what
    // the test actually exercises.
    staticDir = mkdtempSync(join(tmpdir(), 'backend-static-'));
    writeFileSync(
      join(staticDir, 'index.html'),
      '<!doctype html><html><body>spa-shell</body></html>',
    );
    process.env.STATIC_DIR = staticDir;

    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app.close();
    rmSync(staticDir, { recursive: true, force: true });
    delete process.env.STATIC_DIR;
  });

  it('GET /health returns 200 with { status: "ok" }', async () => {
    const response = await httpGet(app, '/health');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /api/does-not-exist returns a 404 JSON body, not the SPA fallback', async () => {
    const response = await httpGet(app, '/api/does-not-exist');

    expect(response.status).toBe(HttpStatus.NOT_FOUND);
    expect(response.headers['content-type']).toMatch(/json/);
  });

  it('serves index.html for an unknown deep link when STATIC_DIR exists', async () => {
    const response = await httpGet(app, '/companies/x');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.headers['content-type']).toMatch(/html/);
    expect(response.text).toContain('spa-shell');
  });
});

describe('Boot with a missing STATIC_DIR (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Dev without a frontend build: STATIC_DIR points at a directory that
    // was never created. Boot must still succeed — `/health` must stay up.
    process.env.STATIC_DIR = join(tmpdir(), 'backend-static-missing-' + Date.now());

    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.STATIC_DIR;
  });

  it('still boots and serves /health', async () => {
    const response = await httpGet(app, '/health');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
