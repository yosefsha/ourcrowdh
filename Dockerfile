# One image for the whole application: NestJS serves the API, /health and the
# built SPA (docs/PLAN.md#decisions). Build context is the repository root.
#
#   docker build -t ourcrowdh .
#
# The same image runs the app (`node dist/main.js`, the default CMD) and the
# one-off migration task (`npm run migration:run`), so what CI migrates with is
# what production migrates with.

# ---- frontend build ------------------------------------------------------
FROM node:22-alpine AS frontend-build
WORKDIR /build/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/index.html frontend/vite.config.ts frontend/tsconfig.json frontend/tsconfig.app.json frontend/tsconfig.node.json ./
COPY frontend/public ./public
COPY frontend/src ./src
# MSW's service worker serves only `npm run dev:mock`. msw's postinstall
# writes it into public/ during `npm ci`, so it is removed from the build
# output rather than from the context: it must not ship in the production SPA.
RUN npm run build && rm -f dist/mockServiceWorker.js

# ---- backend build -------------------------------------------------------
# Full devDependencies here: the TypeScript compiler and Nest CLI are not
# shipped in the runtime image.
FROM node:22-alpine AS backend-build
WORKDIR /build/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json ./
COPY backend/src ./src
RUN npm run build

# ---- runtime -------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8000 \
    STATIC_DIR=/app/public
WORKDIR /app

# dumb-init as PID 1 so SIGTERM reaches Node and enableShutdownHooks() can
# drain the app on container stop.
RUN apk add --no-cache dumb-init

# Production dependencies only. `typeorm` is a runtime dependency, so its CLI
# is available here for `npm run migration:run`. No runtime dependency needs
# an install script (pg is pure JS), so lifecycle scripts are not run.
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# `dist/` carries the compiled migrations and the TypeORM CLI data source
# (dist/database/data-source.js) alongside the app — the backend is native ESM
# (docs/adr/0001-backend-esm-nestjs-12.md) and the CLI loads compiled JS only.
COPY --from=backend-build /build/backend/dist ./dist
COPY --from=frontend-build /build/frontend/dist ./public

# /app/data holds exported data. Writable by the unprivileged user when used
# as-is or with a named volume; a bind mount replaces it with the host
# directory and its ownership (see the "Data directory" note in
# docker-compose.yml).
RUN mkdir -p /app/data && chown node:node /app/data

# `node` is the unprivileged user (uid 1000) shipped with the official image.
USER node

EXPOSE 8000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
