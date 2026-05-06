# vyoh.gg

A personal cross-platform gaming dashboard. Aggregates League of Legends (Riot API) and Steam (Steam Web API) into a single view of my gaming life: match history, performance trends, playtime distribution, achievements.

Built as a portfolio project — equal parts hobby and engineering case study. The README grows alongside the code.

## Status

- Bootstrap arc complete (2026-05-06): pnpm workspace, `apps/web` and `apps/api` scaffolded, Biome + TypeScript strict, GitHub Actions CI gating every push and PR.
- Next: a vertical slice (summoner search → match history → match detail) with mocked data, to validate the web ↔ api ↔ shared-types contract before persistence lands.
- After that: Postgres + ORM, Redis + BullMQ for Riot rate-limit handling, then the actual Riot/Steam integrations.

## Stack

- **Frontend** — React 19, Vite 8, Tailwind CSS 4, shadcn/ui (Radix-based), motion (formerly Framer Motion)
- **Backend** — NestJS 11 with the SWC builder; Vitest for tests via `unplugin-swc` (so decorator metadata works without Jest)
- **Database** — Postgres (ORM TBD — TypeORM or Prisma)
- **Cache / queue** — Redis + BullMQ (planned; for Riot rate-limit handling and background backfills)
- **Tooling** — pnpm workspaces, Biome 1.9 (single linter/formatter across the monorepo), TypeScript strict with `noUncheckedIndexedAccess`
- **Hosting** — TBD (Vercel for web + Railway/Fly for api is the cheap default)

## Repo layout

```
vyoh.gg/
├── .github/workflows/   # CI — lint/format/typecheck on every PR and push to main
├── apps/
│   ├── web/             # React + Vite + Tailwind + shadcn + motion → http://localhost:2009
│   └── api/             # NestJS + SWC + Vitest                     → http://localhost:2010
└── packages/
    └── shared/          # cross-cutting types and DTOs imported by both apps
```

The port choices have a story: **2009** is the year League of Legends launched, **2010** is the year I created my Steam account.

## Local development

Requires Node 22 (see `.nvmrc`), pnpm 10, and Docker (for the local Postgres).

```bash
cp .env.example .env                       # optional: override compose defaults
cp apps/api/.env.example apps/api/.env     # api env: DATABASE_URL + RIOT_API_KEY
docker compose up -d                       # start Postgres on :5432
pnpm install                               # install all workspace deps
pnpm --filter @vyoh/api db:migrate         # apply prisma migrations
pnpm --filter @vyoh/api db:seed            # populate the matches table

pnpm --filter @vyoh/web dev                # web dev server on :2009
pnpm --filter @vyoh/api start:dev          # api in watch mode on :2010

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

## Engineering case studies

### Riot API: rate-limit-aware fetching

Riot's developer keys allow **20 requests/second and 100 requests/2 minutes per regional cluster** (americas, europe, asia, sea). One match-history fetch issues ~12 calls — one Account-V1 lookup, one Match-V5 list, then one Match-V5 detail per match. Two consecutive searches without coordination would hit the per-second cap; sustained use would hit the per-2-minute cap.

The api takes a layered approach:

**Per-summoner cache.** A `Summoner` table caches the `gameName/tagLine → puuid` mapping (Account-V1 only fires on the first lookup), and a `Match` table with composite primary key `(matchId, puuid)` caches each summoner's match perspective. `LolService.backfillMissingMatches` only fetches Match-V5 detail for IDs not already in the cache. See [apps/api/src/lol/lol.service.ts](apps/api/src/lol/lol.service.ts).

A repeat query for a summoner with no new games drops from **~12 Riot calls to 1** (just the match-IDs list refresh):

```
[LolService] summoner cache HIT for Vyoh#EUW
[RiotService] europe /lol/match/v5/matches/by-puuid/.../ids?count=10 → 200 (110ms)
[LolService] match cache: 10 hit, 0 missing for puuid-...
[HTTP] GET /lol/summoners/euw1/Vyoh/EUW/matches → 200 (135ms)
```

**Proactive rate limiter.** One Bottleneck per regional cluster, chained — 20 req/s on top, 100 req/2 min underneath. Each `RiotService.fetch` is scheduled through the limiter for its cluster; jobs queue if the budget is depleted, never sent past the limit. See [apps/api/src/riot/rate-limiter.service.ts](apps/api/src/riot/rate-limiter.service.ts).

**Reactive retry-on-429.** The proactive limiter prevents nearly all 429s, but Riot's service-side limits can still trigger one. The fetch path detects 429, reads the `Retry-After` header, sleeps, and retries (up to 2 times). After exhaustion, propagates as a `RiotError(429)` which the `RiotExceptionFilter` maps to an HTTP 429 with a friendly message. See [apps/api/src/riot/riot.service.ts](apps/api/src/riot/riot.service.ts).

**Observability.** All three layers log structured events — cache hits/misses, every Riot call with its status and duration, every HTTP request with its outcome. Sufficient for development; production would surface the same signals through Prometheus or similar.

**Open: misuse prevention.** Today the api accepts any `gameName#tagLine` in the URL — anyone hitting the deployed endpoint could drain the Riot key on queries we don't care about. Tied to the broader "personal dashboard, not search engine" pivot — likely lock the api to a whitelist of accounts and drop the search interface entirely.

### In progress

- **Multi-source identity stitching** — same player across LoL and Steam, no canonical join key
- **Performance budget** — Lighthouse scores, bundle deltas per route, when to lazy-load
- **Background workers** — historical match backfill without burning the live rate budget
