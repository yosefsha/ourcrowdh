---
status: accepted
---

# Backend runs as native ESM on NestJS 12

NestJS 12 (`@nestjs/common`, `@nestjs/core`, `@nestjs/typeorm`) is published as pure ESM — `"type": "module"` with no CommonJS entry point — so a CommonJS Nest app cannot `require()` it. We build the backend as an ESM package on NestJS 12 rather than pinning NestJS 11, the last CommonJS line, because the repository standard is to write to the framework's current idiom, and starting a new codebase one major version behind buys only a migration later.

## Considered Options

- **NestJS 11 + CommonJS** — mature tooling (`__dirname`, plain Jest, no import suffixes) and what the original instructions assumed; rejected because it is a dead-end line for a new project.
- **NestJS 12 + ESM** — chosen.

## Consequences

- `backend/package.json` has `"type": "module"`; `tsconfig.json` uses `module`/`moduleResolution: "nodenext"`.
- Relative imports carry a `.js` suffix (`import { X } from './x.js'`), even in `.ts` files.
- `import.meta.dirname` / `import.meta.url` replace `__dirname` / `__filename`.
- Jest runs in ESM mode: `NODE_OPTIONS=--experimental-vm-modules`. The flag is experimental in Node; if a Jest or Node upgrade breaks it, that is the first place to look.
- The TypeORM CLI loads the **compiled** data source (`dist/database/data-source.js`), so `npm run build` must precede `migration:run` / `migration:generate` — in CI, in compose's `migrate` service and in the image.
- TypeScript is pinned to `~6.0.x`, the range satisfying both `@nestjs/schematics` and `typescript-eslint`. Widen it only when both allow.
- E2E specs boot the app with `NestFactory.create(AppModule)`, not `Test.createTestingModule`, because the latter freezes `ServeStaticModule` into a no-op loader before an HTTP adapter exists.
