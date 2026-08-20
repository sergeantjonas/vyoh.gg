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

# onnxruntime-node ships a prebuilt runtime for every platform it supports and
# the loader here can open exactly one of them: Windows DLLs and macOS dylibs
# are 203 MB of the package's 259, for a 1.3 MB face-detection model.
#
# Pruned in the *build* stage, which is the whole trick. The obvious place is
# next to the runtime stage's `COPY node_modules`, and a `RUN rm -rf` there
# would delete the files while leaving them in the layer they arrived in — the
# image measures the same and the work reads as done. Deleting before the COPY
# is what actually makes them absent.
#
# Keyed off TARGETARCH rather than hardcoded: the dev box is arm64 and the VPS
# is likely x64, and getting this wrong fails at runtime on the first Steam
# artwork request rather than at build. Unknown arch is a hard error for the
# same reason — silently keeping nothing would ship a broken image.
ARG TARGETARCH
RUN set -eu; \
    case "${TARGETARCH}" in \
      amd64) keep=x64 ;; \
      arm64) keep=arm64 ;; \
      *) echo "onnx prune: unhandled TARGETARCH '${TARGETARCH}'" >&2; exit 1 ;; \
    esac; \
    found=0; \
    for bin in $(find node_modules/.pnpm -type d -path '*/onnxruntime-node/bin'); do \
      for napi in "${bin}"/napi-v*; do \
        test -d "${napi}/linux/${keep}" || continue; \
        found=1; \
        find "${napi}" -mindepth 1 -maxdepth 1 ! -name linux -exec rm -rf {} +; \
        find "${napi}/linux" -mindepth 1 -maxdepth 1 ! -name "${keep}" -exec rm -rf {} +; \
      done; \
    done; \
    test "${found}" = 1

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm --filter @vyoh/api build

# Strip the build and test toolchain out of what the runtime stage will copy.
#
# The reason is the executable surface, not the disk. Before this the production
# image put thirteen binaries on PATH and one of them belonged: biome, conc,
# concurrently, nest, playwright, spack, swc, swcx, tsc, tsserver, tsx and
# vitest, every one of them invokable inside a container serving public traffic.
# A language server and a browser launcher are not things a Nest server needs at
# runtime. Images are built on the VPS and never shipped anywhere, so the
# megabytes this frees are incidental — `scripts/deploy.sh` rsyncs source.
#
# After the build, which needs nest and swc.
#
# Two mechanisms, and only one of them depends on the list. The `.bin` sweep is
# an allowlist: everything except `prisma` goes, so a dependency added later
# cannot reintroduce an executable no matter what the package list below says.
# The package list is opportunistic cleanup of the code behind those binaries —
# a name that vanishes upstream is harmless. Removals are echoed rather than
# fataled, because the invariant is enforced structurally and drift in the list
# shows up as image size rather than as a broken container.
#
# pnpm writes `.bin` entries as ~900-byte shim *scripts*, not symlinks, so
# deleting a package leaves its shim behind looking perfectly runnable. The
# sweep matches on name for that reason; `-xtype l` finds nothing here.
#
# `@prisma/studio-core` and `@prisma/dev` are deliberately absent. The CLI
# requires both eagerly even for `migrate deploy` — hiding either one fails with
# `Cannot find module '@prisma/studio-core/data/bff'` and
# `'@prisma/dev/internal/state'` respectively — so 62 MB of Prisma Studio's data
# layer cannot leave while this container is the thing that runs migrations.
RUN set -eu; \
    for pkg in '@biomejs+*' 'concurrently' 'playwright' 'playwright-core' \
               'typescript' '@nestjs+cli' '@nestjs+schematics' '@swc+*' \
               'unplugin-swc' 'tsx' 'esbuild' '@esbuild+*' 'vitest' '@vitest+*' \
               'happy-dom' 'rolldown' '@rolldown+*' 'prettier' \
               '@electric-sql+pglite'; do \
      find node_modules/.pnpm -maxdepth 1 -type d -name "${pkg}@*" -exec rm -rf {} +; \
    done; \
    for bindir in node_modules/.bin apps/api/node_modules/.bin; do \
      test -d "${bindir}" || continue; \
      find "${bindir}" -maxdepth 1 ! -type d ! -name prisma \
        -exec sh -c 'echo "  dropped executable: $(basename "$1")"' _ {} \; -delete; \
    done; \
    left="$(find node_modules/.bin apps/api/node_modules/.bin -maxdepth 1 \
            ! -type d -exec basename {} \; | sort -u | tr '\n' ' ')"; \
    echo "runtime executables: ${left}"; \
    test "${left}" = "prisma "

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
# Read from a path relative to `process.cwd()`, which is why the entrypoint
# chdirs into apps/api rather than running from /app.
COPY --from=build --chown=node:node /repo/apps/api/models ./apps/api/models
COPY --chown=node:node apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh

USER node
WORKDIR /app/apps/api
EXPOSE 2010

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT??2010)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
