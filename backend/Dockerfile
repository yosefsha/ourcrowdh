# ---- builder -----------------------------------------------------------
# Full devDependencies here: the TypeScript compiler and Nest CLI are not
# shipped in the runtime image.
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runtime ------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# dumb-init as PID 1 so SIGTERM reaches Node and enableShutdownHooks() can
# drain the app on ECS task stop.
RUN apk add --no-cache dumb-init

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# `dist/` carries the compiled migrations and the TypeORM CLI datasource
# (dist/database/data-source.js) alongside the app, so `npm run migration:run`
# works identically here and in CI.
COPY --from=builder /app/dist ./dist

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 8000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
