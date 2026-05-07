# vyoh.gg

A personal cross-platform gaming dashboard. Aggregates League of Legends (Riot API) and Steam (Steam Web API) into a single view of my gaming life: match history, performance trends, playtime distribution, achievements.

Built as a portfolio project — equal parts hobby and engineering case study. The README grows alongside the code.

## Status

The app has pivoted from "public summoner search" to **personal multi-account dashboard**: the api locks to a whitelist of my own LoL accounts (no open Riot-key drainage), and the web app is a deep dashboard with infinite-scroll match history, trend charts, champion aggregation, match detail with team/item breakdowns, and a meaningful coat of visual polish (sliding navigation indicators, splash-art backdrops with mouse parallax, animated KDA tickers, command palette).

Currently shipped:

- Multi-account routing under `/lol/$accountSlug/{matches,trends,champions}` with deep-link-friendly URLs and a sliding `layoutId` indicator on the LoL sub-tabs.
- Match detail page with full participant breakdown, item tooltips (name + gold cost + rendered Riot ability markup), and a self-row ring on your own participant.
- Trends page with Recharts-driven KDA line + queue distribution bars, a 20/50/100 windowed selector, and a streak badge (`🔥 3W` / `❄️ 4L`).
- Cmd+K command palette (cmdk + Radix Dialog).
- Custom scrollbar styling, frosted-glass nav, noise-grain backdrop, splash-art backdrop with mouse parallax that survives route transitions via a root `SplashProvider`.

Next: Steam integration (Steam Web API, identity stitching across services), Lighthouse + bundle budget instrumentation per route, and an SSE-streamed first-time backfill so the heavy "load 100 games" path can show progressive results.

## Stack

- **Frontend** — React 19, Vite 8, Tailwind CSS 4, shadcn-style primitives, motion (with `LazyMotion` `domMax` features for `layoutId` animations), TanStack Router (file-based) + TanStack Query 5, Recharts (lazy-loaded with the trends route).
- **Backend** — NestJS 11 with the SWC builder; Vitest in both apps via `unplugin-swc` (so decorator metadata works without Jest). Bottleneck rate limiter (per-regional cluster, chained 20 req/s + 100 req/2 min) plus a custom `RiotExceptionFilter` that maps Riot errors to friendly HTTP status codes.
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
└── packages/
    └── shared/          # cross-cutting types and DTOs imported by both apps
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

### Pagination + partial-failure resilience

The match list uses `useInfiniteQuery` with a 20-per-page cursor. An IntersectionObserver at the list bottom auto-fetches the next page; a manual "Load more" button exists as a fallback. The api route `/lol/.../matches?start=N&count=M` plumbs `start`/`count` directly through to Riot's match-v5 cursor.

The first time you ask for "Last 100 games" on an account with little cache, the api fans out up to 100 detail fetches behind the rate limiter. To prevent a single rate-limit-induced 429 from sinking the whole batch, `LolService.backfillMissingMatches` switched from `Promise.all` to `Promise.allSettled` — successful fetches land in the DB, failures are logged with a count, and the response returns whatever's now available. A retry from the user fans out only the still-missing IDs, so the system converges to the requested window in ~one extra round-trip on the unhappy path.

A planned next step is an SSE endpoint that streams `{matchId, status: "ready" | "failed"}` events as each Riot detail lands, so the web app can swap skeleton rows for real cards progressively. The current global indeterminate top-bar (driven by TanStack Query's `useIsFetching`) covers the global signal until then.

### Visual layer — `SplashProvider`, scope-keyed transitions, and `LazyMotion` `domMax`

A few patterns worth flagging that are easy to break by accident:

- **`SplashProvider` lives at the root.** Each match-detail page calls `useSplashChampion(name)` to publish the active champion; the provider preloads the splash via `image.decode()`, then crossfades through `AnimatePresence` keyed on the splash URL. Mouse-tracked parallax (±24/16 px, soft spring) is applied via motion values. Critically, the backdrop persists across route changes with a 100ms grace window — earlier prototypes that rendered the backdrop inside the route component flashed dark on every navigation because the portal unmounted and remounted.
- **Scope-keyed `AnimatePresence`.** The root layout keys on the *first* path segment (`"/" | "/lol" | "/steam"`), so top-level navigation animates while sub-tab switches inside `/lol/$slug/...` don't re-mount the LoL header + tabs. A second `AnimatePresence` inside `$accountSlug.tsx` handles the inner sub-tab transition.
- **`LazyMotion` features must be `domMax`.** `domAnimation` (the lighter bundle) doesn't include layout animations, so the sliding nav pill, the LoL sub-tab underline, and the trend-count selector all silently stop animating if you downgrade. Cost is ~5 kB gzip — accepted.

### In progress

- **Multi-source identity stitching** — same player across LoL and Steam, no canonical join key
- **Performance budget** — Lighthouse scores, bundle deltas per route, when to lazy-load
- **Background workers** — historical match backfill without burning the live rate budget
