# Backend — TypeScript / NestJS

The backend service lives in `backend/`. `.github/workflows/ci.yml` hardcodes
that directory as its working directory and runs on every push, so **CI is red
until it exists with the files below.**

```
backend/
  package.json            # Must define: start:dev, build, start:prod, lint, type-check, test, test:e2e, migration:run, migration:generate
  package-lock.json       # CI runs `npm ci`, which fails without it
  tsconfig.json           # strict: true
  tsconfig.build.json     # Excludes tests from the production build
  nest-cli.json
  eslint.config.mjs       # Flat config; `npm run lint` carries --max-warnings 0
                          # No Dockerfile here — the image is built from the root Dockerfile
  src/
    main.ts               # bootstrap(): global ValidationPipe, listens on PORT (default 8000)
    app.module.ts         # Root module — imports feature modules and ConfigModule
    config/
      configuration.ts    # Typed config factory
      validation.ts       # Env schema — the app refuses to boot on a bad env
    health/
      health.module.ts
      health.controller.ts  # GET /health — the ALB health check target
    <domain>/
      <domain>.module.ts
      <domain>.controller.ts  # Thin — validates and delegates
      <domain>.service.ts     # Business logic
      dto/<name>.dto.ts       # class-validator request/response DTOs
      <domain>.repository.ts  # Port interface + injection token — see below
      repositories/           # One file per concrete source (Postgres, HTTP, …)
    migrations/           # TypeORM migrations — `npm run migration:run` applies them
  test/
    <domain>.e2e-spec.ts  # Supertest against the real Nest app
    jest-e2e.json
```

Unit specs (`*.spec.ts`) sit next to the file they cover under `src/`; end-to-end
specs (`*.e2e-spec.ts`) live in `test/`.

What CI needs from the backend, beyond the files existing:
- `npm ci` must install `pg` — it is what the readiness check imports before the suite runs. There is no Redis.
- `npm run migration:run` must apply cleanly to an empty database.
- **The suite must not skip.** A skipped or `todo` test fails the build; specs that skip themselves when no database is present will trip it, so gate them on something CI satisfies.
- `npm run lint` must carry `--max-warnings 0`, or the lint gate can never fail — `typescript-eslint`'s recommended preset ships most rules as warnings.
- `npm run type-check` (`tsc --noEmit -p tsconfig.json`) is its own gate, so a type error is reported as a type error rather than as a build failure.

## ESM

The backend is native ESM on NestJS 12 — see `docs/adr/0001-backend-esm-nestjs-12.md`. Do not convert anything back to CommonJS.
- Relative imports end in `.js`: `import { OrderService } from './order.service.js';`
- Use `import.meta.dirname` instead of `__dirname`.
- Jest runs with `NODE_OPTIONS=--experimental-vm-modules`; the `test` and `test:e2e` scripts already set it.
- `migration:run` / `migration:generate` load the compiled data source — run `npm run build` first.
- E2E specs boot the app with `NestFactory.create(AppModule)` (plus the same global pipes as `main.ts`) and swap ports with `overrideProvider` on a module built the same way; `Test.createTestingModule` disables SPA serving.

## Code Style
- Type every function signature including the return type. `strict: true` in `tsconfig.json`, and no `any` — use `unknown` and narrow.
- One class/concern per file. `PascalCase` for classes/types/interfaces, `camelCase` for functions/variables, `kebab-case.<role>.ts` for filenames (`order.service.ts`, `create-order.dto.ts`).
- Controllers must be thin — validate, delegate to a service, map to a response DTO. No business logic, no data access.
- Request/response shapes are `class`-based DTOs with `class-validator` decorators, not bare interfaces — the global `ValidationPipe` needs a class at runtime.
- Enable the global pipe with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` so unknown fields are rejected rather than silently carried.
- Use constructor injection with `readonly` parameters. No property injection, no service locator.
- Internal value objects are `readonly` interfaces or classes with `readonly` fields — immutable by default.
- Throw Nest's `HttpException` subclasses (`NotFoundException`, `ConflictException`, …) from the service layer, or map domain errors to them in an exception filter. Never leak a driver error to the client.

## Configuration
- Use `@nestjs/config` with `isGlobal: true` and a typed `configuration.ts` factory. Read config through `ConfigService`, never `process.env` outside that factory.
- Validate the environment at startup with a schema (`validation.ts`); an invalid env must fail the boot, not surface as an undefined at the first request.
- Provide sensible defaults so `npm run start:dev` works with no env vars set: `PORT=8000`, `DATABASE_URL=postgresql://app:app@localhost:5432/app`. The full list of variables and defaults is in `docs/PLAN.md#configuration`.
- Secrets come from the environment (Secrets Manager in ECS) — never from a committed `.env`.

## Data sources go behind a port interface
Anything fetched from outside the process — an HTTP API, a database, a cache, a
queue — is reached through an `interface` named in domain terms, with domain
return types and its own error types. One implementation per source under
`<domain>/repositories/`, bound to an injection token in the module's
`providers`, plus an in-memory fake for tests. The full rule set lives in
`.claude/agents/backend-engineer-nestjs.md`.

## Testing
- `jest` as the runner, `supertest` for HTTP-level tests.
- Unit tests construct the service under test directly (`new OrderService(fake)`) — reach for `Test.createTestingModule` only when Nest's DI is what's under test.
- E2E specs boot the real `AppModule` against the real Postgres container, with the same global pipes as `main.ts`, and assert on status codes and body shapes.
- Substitute the in-memory fake through `overrideProvider(TOKEN)`; do not mock the driver.
- Test both success paths and error/edge cases.
- Run a single test: `npm test -- src/orders/order.service.spec.ts -t "rejects a duplicate"`

## Dependencies
- `package.json` pins ranges; `package-lock.json` is the lock and is committed. CI runs `npm ci`, so the two must agree.
- Runtime deps stay out of `devDependencies` — the production image installs with `npm ci --omit=dev`.

## Container runtime
- One image for the whole application, built from the **root** `Dockerfile` with the repository root as context (`docker build .`). There is no `backend/Dockerfile` and no `frontend/Dockerfile` — do not add one.
- Multi-stage on a `node:22-alpine` base: a frontend stage runs `npm ci` and `npm run build` in `frontend/`; a backend stage does the same in `backend/`; the runtime stage runs `npm ci --omit=dev` for the backend, copies the backend `dist/` to `/app/dist` and the frontend `dist` to `/app/public`, and sets `STATIC_DIR=/app/public`.
- The root `.dockerignore` is an allow-list. A new file the build needs (for example a seed file read at runtime) must be added to it and copied into the runtime stage explicitly.
- Entrypoint: `node dist/main.js`, listening on **8000** — that is what the ALB target group and the ECS security groups expect, so `main.ts` must default `PORT` to 8000 rather than Nest's own 3000.
- Run as a non-root user, and `dumb-init` (or `--init`) as PID 1 so SIGTERM reaches Node and `app.enableShutdownHooks()` can drain.
- `GET /health` must return 200 — the ALB health check targets it.
- Database migrations run as `npm run migration:run`, in CI, in compose's one-shot `migrate` service, and as a one-off task wherever the image is deployed. The runtime image must therefore ship the compiled migrations and the TypeORM CLI datasource.
