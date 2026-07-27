# syntax=docker/dockerfile:1
#
# NestJS api. Built from the repo root:
#   docker build -f apps/api/Dockerfile .
#
# Node 22 rather than 24 because the runtime depends on type stripping (≥ 22.18):
# `@vyoh/shared` is consumed as raw `.ts` through its package exports, so the
# compiled `dist/` still `require()`s TypeScript at runtime. bookworm-slim rather
# than alpine because sharp, onnxruntime-node and @resvg/resvg-js all ship glibc
# prebuilds and would otherwise compile from source.

FROM node:22-bookworm-slim AS build

# bookworm-slim ships no openssl. Prisma probes for it to pick a query-engine
# binary and, finding none, falls back to the openssl-1.1.x build — which is the
# wrong one for bookworm's OpenSSL 3.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

# Manifests first so the install layer survives every source-only change.
# All five workspace manifests are needed even under `--filter`: pnpm validates
# the whole lockfile against pnpm-workspace.yaml before it installs a subset.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY tools/champion-assets/package.json tools/champion-assets/
COPY tools/perf-probe/package.json tools/perf-probe/
# The api's postinstall is `prisma generate`, so the schema has to be in place
# before install runs. Cheap to copy early: it changes far less often than src.
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts

RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --filter @vyoh/api... --store-dir /pnpm-store

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm --filter @vyoh/api build

# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

# `node_modules` comes across whole rather than through `pnpm deploy --prod`,
# and both halves of that are deliberate:
#   - Prisma's generated client is written into the virtual store at install
#     time. `pnpm deploy` re-materialises packages from the content-addressable
#     store, i.e. the pristine `@prisma/client` without the generated output.
#   - The prisma CLI is a devDependency, and the entrypoint needs it for
#     `migrate deploy`. Pruning would take it out and put it straight back.
# The web image does prune, because neither applies there.
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/package.json /repo/pnpm-workspace.yaml ./
# Raw source, not a build output: this is what the api's `require("@vyoh/shared")`
# resolves to.
COPY --from=build --chown=node:node /repo/packages/shared ./packages/shared
COPY --from=build --chown=node:node /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /repo/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
# Read from `process.cwd()` and from a path relative to it, which is why the
# entrypoint chdirs into apps/api rather than running from /app.
COPY --from=build --chown=node:node /repo/apps/api/accounts.json ./apps/api/accounts.json
COPY --from=build --chown=node:node /repo/apps/api/models ./apps/api/models
COPY --chown=node:node apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh

USER node
WORKDIR /app/apps/api
EXPOSE 2010

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT??2010)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
