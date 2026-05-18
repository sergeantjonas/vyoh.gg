# vyoh.gg

[![CI](https://github.com/sergeantjonas/vyoh.gg/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/sergeantjonas/vyoh.gg/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/sergeantjonas/vyoh.gg/branch/main/graph/badge.svg)](https://codecov.io/gh/sergeantjonas/vyoh.gg)

A personal cross-platform gaming dashboard. Aggregates League of Legends (Riot API) and Steam (Steam Web API) into a single view of my gaming life: match history, performance trends, playtime distribution, achievements.

Built as a portfolio project — equal parts hobby and engineering case study. The README grows alongside the code.

## Status

Personal multi-account LoL dashboard locked to a whitelist of my own accounts — no open Riot-key drainage. Shipped:

- Multi-account routing under `/lol/$accountSlug/{matches,trends,champions}` with deep-link-friendly URLs and a sliding `layoutId` nav indicator.
- Match detail with full participant breakdown, item tooltips (name + gold + rendered Riot ability markup), and a self-row highlight.
- Trends with Recharts KDA line + queue distribution bars, a 20/50/100 windowed selector, streak badge, and a 365-day match-activity heatmap.
- Per-champion theming from build-time Vibrant palette extraction; blurhash placeholders for an instant splash backdrop with zero visible hole.
- Background historical backfill via cron + SSE push — new matches surface live across all tabs without coupling renders to Riot latency.
- Server-rendered OG share cards (Satori → resvg → PNG) per match URL — no headless browser, no Vercel dependency.
- Cmd+K command palette, Radix Tooltip with auto-flip collision detection, Sonner toast feedback, and a live Core Web Vitals overlay (`?perf=1`).

Next: Steam integration and Lighthouse + bundle budget instrumentation per route.

## Stack

- **Frontend** — React 19, Vite 8, Tailwind CSS 4, shadcn-style primitives, motion (with `LazyMotion` `domMax` features for `layoutId` animations), TanStack Router (file-based) + TanStack Query 5, Recharts (lazy-loaded with the trends route), Radix UI primitives (Dialog + Tooltip), Sonner for toast feedback, react-calendar-heatmap for the activity grid, react-blurhash for splash placeholders, web-vitals for real-user perf metrics.
- **Build-time tooling (`tools/`)** — separate workspace for asset/precompute scripts. Currently houses `champion-assets/`, which uses node-vibrant + sharp + blurhash to derive a static JSON of per-champion dominant color and blurhash placeholders consumed at runtime.
- **Backend** — NestJS 11 with the SWC builder; Vitest in both apps via `unplugin-swc` (so decorator metadata works without Jest). Bottleneck rate limiter (per-regional cluster, chained 20 req/s + 100 req/2 min) plus a custom `RiotExceptionFilter` that maps Riot errors to friendly HTTP status codes. Server-side OG card rendering via `satori` + `@resvg/resvg-js`.
- **Database** — Postgres 16 (Docker Compose), Prisma 7 with the new driver-adapter API (`@prisma/adapter-pg` + `prisma.config.ts`). `Summoner` and `Match` (composite key `(matchId, puuid)`) tables back the per-summoner cache.
- **Cache / queue** — the per-summoner Postgres cache currently does most of the work. Redis + BullMQ planned for historical-backfill workers when that arc lands.
- **Tooling** — pnpm 10 workspaces, Biome 1.9 (single linter/formatter across the monorepo), TypeScript 6 strict with `noUncheckedIndexedAccess`.
- **Hosting** — TBD (Vercel for web + Railway/Fly for api is the cheap default).

## Repo layout

```
vyoh.gg/
├── .github/workflows/   # CI — lint/format/typecheck on every PR and push to main
├── apps/
│   ├── web/             # React + Vite + Tailwind + shadcn + motion → http://localhost:2009
│   └── api/             # NestJS + SWC + Vitest                     → http://localhost:2010
├── packages/
│   └── shared/          # cross-cutting types and DTOs imported by both apps
└── tools/
    └── champion-assets/ # build-time precompute: vibrant palette + blurhash per champion
```

The port choices have a story: **2009** is the year League of Legends launched, **2010** is the year I created my Steam account.

## Local development

Requires Node 22 (see `.nvmrc`), pnpm 10, and Docker (for the local Postgres).

```bash
pnpm bootstrap     # one-time: env files, install, postgres, migrate, seed
pnpm dev       # web on :2009, api on :2010 — single process, prefixed logs
```

`pnpm bootstrap` is idempotent — re-run any time the database or env files drift. The script bootstraps `.env` files (only if missing), brings up Postgres with a healthcheck wait, applies Prisma migrations, and seeds the database.

For a Riot API key, get a 24h dev key at [developer.riotgames.com](https://developer.riotgames.com/) and paste it into `apps/api/.env` (the setup script flags this if the placeholder is still there).

Other useful scripts:

```bash
pnpm db:up                                 # bring up postgres only (no migrations)
pnpm db:down                               # stop the postgres container (data preserved)
pnpm reset                                 # destructive: stop + drop volume (prompts y/N, -y to skip)
pnpm --filter @vyoh/api db:migrate         # create a new prisma migration
pnpm --filter @vyoh/api db:seed            # re-seed
pnpm check                                 # Biome format + lint (auto-fixes)
pnpm typecheck                             # tsc --noEmit across all packages
pnpm -r test                               # vitest in every workspace package
pnpm --filter @vyoh/web build              # production build with bundle report
```

CI runs `pnpm ci:check` (Biome in non-writing CI mode) and `pnpm typecheck` on every PR and every push to `main`.

## Tracked metrics

Web bundle size is a deliberate, ongoing budget. Each layer of the bootstrap was recorded so future regressions show up against a real baseline rather than a vibe:

| State                                  |   JS gzip |   CSS gzip |  Build |
| --------------------------------------- | --------: | ---------: | -----: |
| empty React app                         |  60.06 kB |          — |   85ms |
| + Tailwind v4                           |  60.16 kB |    1.77 kB |  112ms |
| + shadcn/ui (Button)                    |  70.28 kB |    4.43 kB |  172ms |
| + motion (intro animation)              | 109.33 kB |    4.59 kB |  220ms |
| + vertical slice (TanStack Query, Input)| 120.45 kB |    5.28 kB |  221ms |

Plus the Geist variable font, split into per-script woff2 files: Latin 28.4 kB, Latin-ext 15.3 kB, Cyrillic 14.7 kB — only the matching locale loads per visitor.

The biggest single jump is `motion/react` (+39 kB gzip). It's accepted at the bootstrap stage because there are no routes yet to code-split against; the natural moment to revisit is when the router lands. `LazyMotion` + per-route code splitting are both on the table.

**Real-user web vitals.** Beyond the build-time bundle budget, the web app reports the standard [Core Web Vitals](https://web.dev/articles/vitals) at runtime — LCP, INP, CLS, FCP, TTFB. Each metric streams from [apps/web/src/lib/web-vitals.ts](apps/web/src/lib/web-vitals.ts) to a multi-subscriber bus, with a console reporter wired by default (color-coded by `good` / `needs-improvement` / `poor`). A live overlay is available on any page by appending `?perf=1` to the URL — useful for local dev and for pulling numbers off the deployed site without DevTools. Additional sinks (an analytics endpoint, a Grafana exporter) plug into the same bus.

## Engineering case studies

Deep-dives on the gnarlier parts of the stack:

- **[Riot API rate limiting](docs/case-studies/riot-rate-limits.md)** — layered Bottleneck chain, rolling-window semantics, header-driven drift correction, and bounded waits.
- **[Historical backfill and SSE](docs/case-studies/historical-backfill-and-sse.md)** — cron-driven DB population, per-account Server-Sent-Events push, and the two bugs that nearly wedged the worker.
- **[Build-time champion assets](docs/case-studies/build-time-champion-assets.md)** — Vibrant palette + blurhash precompute in a separate pnpm workspace, per-champion CSS theming, and the splash placeholder strategy.
- **[Server-rendered OG cards](docs/case-studies/og-card-satori.md)** — Satori → resvg pipeline, flexbox-only constraint, font format requirements, and an SWC `outDir` gotcha.
- **[Visual layer](docs/case-studies/visual-layer.md)** — `SplashProvider` architecture, scope-keyed `AnimatePresence`, `LazyMotion domMax` requirement, and a context instantiation pitfall.
- **[Pagination and partial-failure resilience](docs/case-studies/pagination-partial-failure.md)** — `useInfiniteQuery` cursor, `Promise.allSettled` batching, and the planned SSE progressive loader.
