# syntax=docker/dockerfile:1
#
# TanStack Start web tier. Built from the repo root:
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.vyoh.gg .
#
# `VITE_API_URL` is a build argument, not an environment variable, because Vite
# bakes it into the client bundle and into the markup `head()` emits. Changing
# where the api lives means rebuilding this image. `API_INTERNAL_URL` is the
# runtime counterpart and is set on the container instead — see
# apps/web/src/lib/api-url.ts.

FROM node:22-bookworm-slim AS build

RUN corepack enable
WORKDIR /repo

# tsconfig.base.json is not optional here: every package tsconfig extends it,
# and a missing `extends` target does not fail the build, it silently drops
# `skipLibCheck` and `strict` and the build dies in third-party .d.ts files.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY tools/champion-assets/package.json tools/champion-assets/
COPY tools/perf-probe/package.json tools/perf-probe/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --filter @vyoh/web... --store-dir /pnpm-store

COPY packages/shared packages/shared
COPY apps/web apps/web

ARG VITE_API_URL
ARG VITE_SITE_URL
# Read by vite.config.ts. Without it the build falls back to `git rev-parse`,
# which has no repository to ask inside the image and reports "dev" on the
# status page.
ARG BUILD_COMMIT
# Browser error reporting. A DSN is an ingest endpoint rather than a
# credential, so baking it into a public image is fine — unlike the auth token
# E3's sourcemap upload will need, which must never be an ARG here.
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_SAMPLE_RATE
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_SITE_URL=${VITE_SITE_URL} \
    BUILD_COMMIT=${BUILD_COMMIT} \
    VITE_SENTRY_DSN=${VITE_SENTRY_DSN} \
    VITE_SENTRY_SAMPLE_RATE=${VITE_SENTRY_SAMPLE_RATE}

# Sourcemap upload (E3). The org is a public identifier and rides as an ARG;
# the auth token is a BuildKit secret mount, which exists only for the duration
# of this RUN and is never written to a layer. An ARG would be readable via
# `docker history` on a package that is anonymously pullable.
#
# `|| true` on the read: absent secret means an unauthenticated build (a local
# `docker build`, or a fork's CI), and vite.config.ts already no-ops the plugin
# when the token is empty. Failing here instead would make the image
# unbuildable without a Sentry account, which is the wrong trade for a public
# repo.
ARG SENTRY_ORG
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    SENTRY_ORG="${SENTRY_ORG}" \
    pnpm --filter @vyoh/web build

# Prunes devDependencies into a self-contained tree. Worth doing here (and not
# in the api image) because nothing in the web runtime is generated at install
# time: the server bundle externalises only react, react-dom and
# @tanstack/react-router, and those are plain dependencies.
#
# The store mount is repeated because `--legacy` re-materialises every package
# from the content-addressable store; without it here, this step re-downloads
# what the install step already has.
#
# The `rm` is not optional. `--legacy` leaves a back-link to the source package
# at node_modules/.pnpm/node_modules/@vyoh/web -> /repo/apps/web. Nothing
# resolves through it, but BuildKit follows symlinks while resolving a COPY
# source and dies on one that escapes it — as `resolve : lstat apps: no such
# file or directory`, which names neither the link nor the stage.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm deploy --filter @vyoh/web --prod --legacy /out --store-dir /pnpm-store \
    && rm -f /out/node_modules/.pnpm/node_modules/@vyoh/web

# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/package.json ./package.json
# Raw source beside a symlink, mirroring the api image. `pnpm deploy`
# materialises workspace packages *inside* `node_modules`, and Node refuses to
# strip types from any file whose realpath sits under `node_modules`
# (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING). Since `server/*.ts` runs as raw
# TypeScript and imports `@vyoh/shared`, the deployed copy would kill the
# container at its first import — a boot loop, not a degraded path.
COPY --from=build --chown=node:node /repo/packages/shared ./packages/shared
RUN rm -rf node_modules/@vyoh/shared \
    && ln -s ../../packages/shared node_modules/@vyoh/shared \
    && chown -h node:node node_modules/@vyoh/shared

COPY --from=build --chown=node:node /repo/apps/web/dist ./dist
# Run as TypeScript by Node's type stripping — see server/index.ts.
COPY --from=build --chown=node:node /repo/apps/web/server ./server

USER node
EXPOSE 2009

# A static file rather than `/`: this is a liveness check on the web process,
# and rendering the document would fold the api's health into it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT??2009)+'/robots.txt').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "server/index.ts"]
