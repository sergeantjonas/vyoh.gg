# vyoh.gg

A personal cross-platform gaming dashboard. Aggregates League of Legends (Riot API) and Steam (Steam Web API) into a single view of my gaming life: match history, performance trends, playtime distribution, achievements.

Built as a portfolio project — equal parts hobby and engineering case study. The README grows alongside the code.

## Status

The app has pivoted from "public summoner search" to **personal multi-account dashboard**: the api locks to a whitelist of my own LoL accounts (no open Riot-key drainage), and the web app is a deep dashboard with infinite-scroll match history, trend charts, champion aggregation, match detail with team/item breakdowns, and a meaningful coat of visual polish (sliding navigation indicators, an interactive splash backdrop that follows the hovered card, per-champion themed cards, animated KDA tickers, command palette).

Currently shipped:

- Multi-account routing under `/lol/$accountSlug/{matches,trends,champions}` with deep-link-friendly URLs and a sliding `layoutId` indicator on the LoL sub-tabs.
- Match detail page with full participant breakdown, item tooltips (name + gold cost + rendered Riot ability markup), and a self-row ring on your own participant.
- Trends page with Recharts-driven KDA line + queue distribution bars, a 20/50/100 windowed selector, a streak badge (`🔥 3W` / `❄️ 4L`), and a 365-day match-activity heatmap.
- Cmd+K command palette (cmdk + Radix Dialog) and Radix Tooltip with auto-flip collision detection for item hover cards.
- Toast feedback layer (Sonner) wired into TanStack Query — mutation errors always surface; query errors only toast on background-refresh failures so initial loads still show inline error UI.
- Live Core Web Vitals overlay (toggleable via `?perf=1`) showing real-user LCP / INP / CLS / FCP / TTFB.
- Open Graph share cards rendered server-side (Satori → SVG → resvg → PNG) at `GET /og/match/:slug/:matchId.png`. Each match URL gets a custom 1200×400 card with champion splash, KDA, win/loss, queue, and account name.
- Per-champion theming driven by build-time-extracted dominant colors (Vibrant) and blurhash placeholders — match cards and champion cards both inherit the champion's color for border + hover glow, and the splash backdrop renders the blurhash instantly while the real image decodes.
- Custom scrollbar styling, frosted-glass nav, noise-grain backdrop, and a hover-driven splash backdrop that hoists to the LoL layout — picking a random recent champion as the seed, then crossfading to whichever card is hovered (works on both match list and champions tab).
- Background historical backfill that walks each whitelisted account's match history backwards in time over successive cron ticks (anchored on the oldest DB row's `playedAt` via Riot's exclusive `endTime` parameter, so head churn never causes drift). New rows stream to the client through a per-account Server-Sent-Events channel; the frontend invalidates the relevant TanStack Query keys on each `match-updated` event, so the matches list, trends, and champions tabs all light up live without ever leaving the cached endpoint.

Next: Steam integration (Steam Web API, identity stitching across services) and Lighthouse + bundle budget instrumentation per route.

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

### Riot API: rate-limit-aware fetching

Riot enforces two independent limits per dev key: a global **app-rate-limit** (20 req/s and 100 req/2 min per regional cluster) and a per-endpoint **method-rate-limit** (e.g. ~2000 req/10 s on `MATCH-V5 /by-puuid/{puuid}/ids`). One match-history fetch issues ~12 calls — Account-V1 lookup, Match-V5 list, then Match-V5 detail per match. Hitting either ceiling returns 429.

The api takes a layered approach:

**Per-summoner cache.** A `Summoner` table caches `gameName/tagLine → puuid` (Account-V1 only fires on first lookup), and a `Match` table with composite primary key `(matchId, puuid)` caches each summoner's match perspective. `LolService.backfillMissingMatches` only fetches Match-V5 detail for IDs not already in the cache. See [apps/api/src/lol/lol.service.ts](apps/api/src/lol/lol.service.ts).

A repeat query for a summoner with no new games drops from **~12 Riot calls to 1** (just the match-IDs list refresh):

```
[LolService] summoner cache HIT for Vyoh#EUW
[RiotService] europe /lol/match/v5/matches/by-puuid/.../ids?count=10 → 200 (110ms)
[LolService] match cache: 10 hit, 0 missing for puuid-...
[HTTP] GET /lol/summoners/euw1/Vyoh/EUW/matches → 200 (135ms)
```

**Proactive rate limiter — chained method → app → app.** Each call is scheduled through three Bottlenecks chained in series: a per-`(regional, method-family)` bucket (e.g. `europe:match-ids-by-puuid`), then the regional fast bucket (20 req/s with `minTime: 50ms` to kill same-tick bursts), then the regional slow bucket (100 req/2 min). Method limiters are lazily created the first time a family is used and chained into the regional fast limiter — Bottleneck's `chain()` enforces that a job has to clear *all* downstream buckets before firing. The 50ms `minTime` was added after observing two requests fired in the same JS tick (`count=20` and `count=10` from a page mounting matches + trends in parallel) blow past the local reservoir before either had returned. See [apps/api/src/riot/rate-limiter.service.ts](apps/api/src/riot/rate-limiter.service.ts) and [apps/api/src/riot/method-families.ts](apps/api/src/riot/method-families.ts).

**Concurrency cap, not just rate cap.** The fast bucket also enforces `maxConcurrent: 8` — at most 8 Riot calls can be *in flight* at any moment per regional cluster, regardless of how much rate budget is technically available. Without this, a "Last 50 matches" backfill happily fans out 30+ parallel fetches the instant the rate budget allows; Riot's tail-latency or undici's connection pool then misbehave under the burst, leaving 20+ connections wedged for seconds. Capping at 8 turns the same fanout into 8 in flight + the rest queued, cycling through cleanly: total clearance time on healthy paths is `(N / 8) × p50_latency` (≈ 1 s for 30 calls × 200 ms p50), and the worst case is bounded by the fetch timeout below.

**Header-driven drift correction.** Local Bottleneck state is in-memory only — every Nest restart wipes the reservoir, but Riot's rolling counters keep running. Right after a restart you'd happily fire 100 reqs locally while Riot still remembered the previous 90, and 429 anyway. Every Riot response (success or 429) carries `X-App-Rate-Limit{,-Count}` and `X-Method-Rate-Limit{,-Count}`; `RateLimiterService.syncFromHeaders` parses both, computes `remaining = limit - count` per window, and shrinks the matching limiter via Bottleneck's `updateSettings({ reservoir })`. Sync is **strictly downward** — it never inflates the bucket, only revokes capacity Riot says we don't have. The hardcoded method limits in `method-families.ts` are conservative initial seeds; the headers are the source of truth from the first response onward.

**Rolling vs. fixed window — the primitive that matters.** The slow regional limiter (100 req / 2 min) is configured with `reservoirIncreaseAmount: 1, reservoirIncreaseInterval: 1200, reservoirIncreaseMaximum: 100` rather than Bottleneck's *refresh* semantics. Refresh would replace the bucket with 100 in one chunk every 120 s — a fixed window. Riot's accounting is **rolling**: capacity is released continuously as old requests age out. After `syncFromHeaders` shrinks the reservoir to near-zero (which happens whenever a saturated `X-App-Rate-Limit-Count` lands), refresh would have it sit at zero for up to 119 s while Riot's window was already dripping capacity back to us. Increase semantics dribble one slot back every 1.2 s (≈ 100 / 120 s), tracking the rate at which Riot's window is actually releasing capacity. This was the load-bearing fix for an evening of cold-start hangs that masqueraded as fetch timeouts.

**Reactive retry-on-429.** The proactive layer prevents nearly all 429s, but service-side limits and dev-key sharing can still trigger one. The fetch path reads `Retry-After`, sleeps, retries up to twice, and logs `X-Rate-Limit-Type` (`application` / `method` / `service`) so we can see which ceiling tripped. After exhaustion the error propagates as `RiotError(429)`, which `RiotExceptionFilter` maps to a friendly HTTP 429. See [apps/api/src/riot/riot.service.ts](apps/api/src/riot/riot.service.ts).

**Bounded waits + queue observability.** A correctly-tuned rate limiter still has failure modes that masquerade as a network hang — a primitive misconfigured (the rolling-window finding above had this shape), a stuck downstream chain, an under-counted reservoir. Every `schedule()` call has a 15-second outer deadline (`Promise.race` against the limiter promise); breaching it throws `RateLimiterTimeoutError`, which the filter maps to HTTP 503 with `"Upstream rate limit saturated — please retry in a moment"`. Three diagnostic hooks make the wait visible while it's happening: a 10-second `still pending` warning logs `N queued, M in flight` so the operator can tell queue-starvation from in-flight stall at a glance; a `callback dispatched after Nms` log fires the moment Bottleneck actually runs the user function (the *absence* of which was the diagnostic that pivoted a recent debugging session — `EXECUTING > 0` on a chained limiter doesn't mean the callback is running, only that an upstream slot has handed off downstream); and a `callback resolved/rejected` log marks the end so it's possible to measure inner-call latency separately from queue wait.

**Fetch-level timeout — racing against undici.** Node's `fetch()` has no default timeout. More surprisingly, `AbortSignal.timeout()` and manual `AbortController.abort()` don't reliably cancel `fetch` once the underlying TCP connection has stalled — undici (Node's bundled `fetch` impl) honours abort at the dispatcher layer for new requests, but a wedged socket can leave the abort signal flipped while the fetch promise stays pending forever. Particularly easy to reproduce under WSL2. Worse, installing the npm `undici` package and calling `setGlobalDispatcher(...)` doesn't help: Node bundles its own internal undici copy, separate from anything in `node_modules`. Most online guides predate this split. The fix is to race the fetch against a manually-controlled `setTimeout` and let the `await` throw if the timeout wins:

```ts
const res = await Promise.race([fetchPromise, hardTimeout]);
```

When `hardTimeout` wins, the await throws `RiotError(504)` and the limiter slot frees. The fetch promise itself stays pending until Node's TCP layer reaps the socket — a bounded leak, acceptable worst case since the alternative is "the api is hung." `AbortSignal` stays attached in case undici *does* honour it. The 15-second schedule deadline above stays as the outer backstop; the 10-second fetch timeout handles the more common in-flight-stall case.

**Observability.** All three layers log structured events — cache hits/misses, every Riot call with status + duration, every HTTP request with its outcome. Sufficient for development; production would surface the same signals through Prometheus or similar.

**Background sync — taking Riot off the user's critical path.** Even with all of the above, fetching ~30 cold matches on a personal-tier key (100 req / 2 min) is genuinely tight, and the architectural mismatch is treating Riot as the request-time data source for overview screens. The fix: a `MatchSyncService` runs `@Cron('*/5 * * * *')` plus an `OnApplicationBootstrap` hook that fires once on api start, walking the whitelisted accounts and backfilling missing match details for each — through the same rate-limited `RiotService`, so it cooperates with any on-demand traffic. Each tick does two passes per account: a *head sync* (the most recent 20 IDs) keeps the front of the list fresh, and a *historical step* anchors on the oldest match's `playedAt` and asks Riot for matches strictly older via the exclusive `endTime` parameter. The historical step is robust to head churn — new games appended between ticks don't shift the offset because there is no offset. When Riot returns a short page the worker persists `historicalDoneAt` on the `Summoner` row and the cron skips the call thereafter; a 1000-game account is fully backfilled in ~4 hours of unattended uptime. A per-tick re-entrancy lock prevents overlap, and Bottleneck paces the burst so total Riot throughput stays well under the 100 req / 120 s app-slow ceiling. Trends, Champions, and the match list (now infinite-scrolling against the DB) all read from `GET /matches/cached`, which is pure DB — no Riot, no backfill, no possibility of a 30 s hang on overview screens. A refresh button on the layout header triggers on-demand sync via `POST /matches/sync` and invalidates the relevant TanStack Query keys on success, so users get the "I want it now" affordance without coupling page renders to Riot's tail latency. Steady-state Riot traffic for ~5 tracked accounts: roughly **1–3 calls/min**, comfortably under any rate ceiling. See [apps/api/src/lol/match-sync.service.ts](apps/api/src/lol/match-sync.service.ts) and [apps/web/src/lol/refresh-account-button.tsx](apps/web/src/lol/refresh-account-button.tsx).

**Live updates via SSE.** The cron does the growing; clients learn about it through a per-account Server-Sent-Events channel at `GET /lol/summoners/:region/:gameName/:tagLine/matches/events`. A small `MatchEventsService` (`Subject<MatchUpdatedEvent>` + `forPuuid` filter) sits between the worker and the controller; both head and historical paths `emit({ puuid, added, source })` after each successful backfill (only when `added > 0` — silent ticks stay silent). The frontend opens an `EventSource` at the `$accountSlug.tsx` layout, listens for `match-updated`, and `queryClient.invalidateQueries` against the relevant `["lol", "matches-cached", …]` and `["lol", "matches-cached-infinite", …]` keys. The cached endpoint stays pure DB — push is for *signalling* that the cache is stale, pulls are for *content*, which keeps the SSE schema decoupled from the row schema. A 30 s heartbeat keeps idle proxies from killing the connection. NestJS's `@Sse` decorator handles the wire format; EventSource handles reconnect.

**The full investigation.** Two compounding bugs in the rate-limiter chain almost wedged the historical worker before it could ship: deadline-abandoned promises were leaking Bottleneck slots, and `updateSettings({ reservoir })` was perturbing the `reservoirIncrease` ticker every time `syncFromHeaders` fired. Inner short-circuit on the deadline + draining via `incrementReservoir` resolved both. Combined with the rolling-window primitive choice from the previous session, the chain now stays alive across cron ticks indefinitely. The full debugging arcs (and the architectural arc that built on them) are written up at [docs/case-studies/riot-rate-limits.md](docs/case-studies/riot-rate-limits.md) and [docs/case-studies/historical-backfill-and-sse.md](docs/case-studies/historical-backfill-and-sse.md).

**Open: misuse prevention.** Today the api accepts any `gameName#tagLine` in the URL — anyone hitting the deployed endpoint could drain the Riot key on queries we don't care about. Tied to the broader "personal dashboard, not search engine" pivot — likely lock the api to a whitelist of accounts and drop the search interface entirely.

### Pagination + partial-failure resilience

The match list uses `useInfiniteQuery` with a 20-per-page cursor. An IntersectionObserver at the list bottom auto-fetches the next page; a manual "Load more" button exists as a fallback. The api route `/lol/.../matches?start=N&count=M` plumbs `start`/`count` directly through to Riot's match-v5 cursor.

The first time you ask for "Last 100 games" on an account with little cache, the api fans out up to 100 detail fetches behind the rate limiter. To prevent a single rate-limit-induced 429 from sinking the whole batch, `LolService.backfillMissingMatches` switched from `Promise.all` to `Promise.allSettled` — successful fetches land in the DB, failures are logged with a count, and the response returns whatever's now available. A retry from the user fans out only the still-missing IDs, so the system converges to the requested window in ~one extra round-trip on the unhappy path.

A planned next step is an SSE endpoint that streams `{matchId, status: "ready" | "failed"}` events as each Riot detail lands, so the web app can swap skeleton rows for real cards progressively. The current global indeterminate top-bar (driven by TanStack Query's `useIsFetching`) covers the global signal until then.

### Build-time precompute: per-champion palette and blurhash

Champion splashes are the visual hero element of the dashboard, but two things make them awkward at runtime:

1. **The CDragon endpoint is 720p.** On a wide viewport the splash gets upscaled ~2×, which reads as "stretched photograph" rather than "atmospheric backdrop."
2. **They're network-bound.** A few hundred ms of transparent hole between page load and image decode looks like a bug.

Both are solved by precomputation. A small workspace at [tools/champion-assets/](tools/champion-assets/) iterates the CDragon champion-summary, downloads each splash, extracts a Vibrant palette via `node-vibrant`, and emits a 32×32 blurhash via `sharp` + `blurhash`. Output: a sorted, deterministic JSON committed at [apps/web/src/data/champion-assets.json](apps/web/src/data/champion-assets.json) — about 21 KB for 191 champions.

```json
{
  "Ahri": {
    "dominantHex": "#5979bd",
    "blurhash": "UE9812EKVUVC%jX7i]VqDgjEp0kXroMxtTtm"
  },
  ...
}
```

The web app consumes this via a tiny [champion-theme.ts](apps/web/src/lib/champion-theme.ts) lookup with a fallback. Two consumers:

- **Themed cards.** Every match card and champion card sets a `--theme-color` CSS variable inline; a single `.themed-card` rule in `index.css` uses `color-mix(in oklab, ...)` to derive a 30 %/65 %/45 % alpha border + hover glow + box-shadow from that one variable. Win/loss is still communicated via the colored vertical bar inside the card, so dropping the win/loss border in favor of champion-themed didn't lose info-density. Source: [champion-card.tsx](apps/web/src/lol/champion-card.tsx) — chrome shared between the match list and the champions tab.
- **Blurhash backdrop placeholder.** The splash layer renders the hash immediately on champion change, then crossfades the actual image in (`opacity: 0 → 0.20`) once `image.decode()` resolves. No empty backdrop is ever visible.

**Scaling cost.** ~15 s for 191 champions at 8-way concurrency on a normal connection. Re-run on Riot patch updates; the JSON's stable sort keeps diffs minimal.

**Why a separate workspace.** `node-vibrant` and `sharp` are heavy native deps that don't belong in the runtime bundle. Putting them in their own pnpm workspace under `tools/` keeps the web/api dependency graphs clean and makes room for future scripts (OG-card generation, Lighthouse runner) without polluting an existing app.

### Server-rendered share cards (Satori → SVG → resvg → PNG)

Pasting a match URL into Slack, Discord, Twitter, or Telegram triggers a fetch for an Open Graph image. Each match URL gets a unique 1200×400 card showing champion splash + KDA + win/loss + queue + account name — pure server-rendered PNG, no headless browser, no Vercel dependency.

The pipeline is two libraries chained:

1. **[satori](https://github.com/vercel/satori)** turns a JSX-like tree into SVG, applying flexbox layout in pure JS. No DOM, no Chromium, no fonts-via-system-call — fonts are passed in as `Buffer`s and applied through Satori's own text-shaping (Yoga + ufo).
2. **[@resvg/resvg-js](https://github.com/yisibl/resvg-js)** converts the SVG to PNG via Rust bindings. Satori's SVG output is intentionally narrow in feature scope (no filters, no clip paths beyond rectangles) so resvg can render it deterministically across platforms.

Sequenced in [apps/api/src/og/og-card.ts](apps/api/src/og/og-card.ts):

```
fetch splash → base64 data URL  ─┐
                                 ├─→ satori(card, {fonts}) → SVG → resvg.render() → PNG buffer
build JSX-like tree of <div>s ───┘
```

The endpoint (`GET /og/match/:slug/:matchId.png`) resolves the slug via `IdentityService`, fetches match detail from `LolService`, finds the user's participant, and pipes the result to `renderMatchCard`. PNG returned with `Cache-Control: public, max-age=86400, s-maxage=2592000` — match data is immutable post-game, cache aggressively.

A few constraints worth flagging because they bite:

**Satori is flexbox-only.** Every `<div>` with more than one child must declare `display: flex`, `display: contents`, or `display: none` — it errors loudly otherwise. Block layout doesn't exist. Once you internalize this it composes cleanly, but the first time the validator fires it's startling.

**Fonts must be TTF / OTF (not woff2).** The web app uses `@fontsource-variable/geist` which ships only woff2. Satori needs raw font tables. Solution: hit Google Fonts' CSS endpoint with an old User-Agent (`Mozilla/4.0`) — Google detects the legacy UA and returns `format('truetype')` URLs in the @font-face rules. Download the TTFs once, commit them to [apps/api/src/og/fonts/](apps/api/src/og/fonts/), load via `readFileSync` at module init.

**SWC's outDir is verbatim.** NestJS' SWC builder doesn't strip `rootDir` like `tsc` would, so `src/og/og-fonts.ts` lands at `dist/src/og/og-fonts.js` — and `__dirname` resolves to `dist/src/og/`. The `nest-cli.json` `assets` config has to copy fonts to `dist/src/og/fonts/` (not `dist/og/fonts/`) for the file lookups to succeed at runtime.

**Open: making bots actually see the OG meta tags.** The endpoint produces a real PNG and the route declares the OG meta tags via TanStack Router's `head` config — but vyoh.gg is a SPA without SSR, so the meta tags only populate client-side after JS executes. Slack, Twitter, and Discord don't run JS; they parse static HTML. To close this loop, the deployed setup needs either (a) a bot-detection middleware that returns pre-baked HTML for known crawler UAs, or (b) full SSR via TanStack Start. Both are deployment-shape decisions that are premature without a target — the durable artifact (the PNG endpoint) is hosted independently.

### Visual layer — `SplashProvider`, scope-keyed transitions, and `LazyMotion` `domMax`

A few patterns worth flagging that are easy to break by accident:

- **`SplashProvider` lives at the root.** Consumers call `useSplashChampion(name, offsetX?)` to publish the active champion; the provider preloads via `image.decode()` and crossfades through `AnimatePresence` keyed on the champion alias. The backdrop persists across route changes with a 100ms grace window — earlier prototypes that rendered the backdrop inside the route component flashed dark on every navigation because the portal unmounted and remounted. The image is anchored `object-top` (so short viewports crop the bottom, never the champion's face) and treated with a small `blur(5px) saturate(0.92)` filter to soften the ~2× upscale of the 720p source. While the real image decodes, a `react-blurhash` canvas seeded by the precomputed hash is rendered immediately so the page never shows an empty hole. The horizontal offset (default `22%`) shifts the focal subject into the right margin — the central content column otherwise hides it; the value is set once via `useSplashChampion` and applied via a single transform on the wrapper, so navigations between pages don't slide the backdrop horizontally.
- **Splash hoisted to the LoL layout.** The original implementation called `useSplashChampion` from each leaf route, which meant the backdrop unmounted whenever the user crossed sub-tabs (matches → trends → champions). The active champion now lives at the `$accountSlug.tsx` layout: it picks a random initial champion from the loaded matches and exposes a `HoverChampionProvider` so the matches list and champions table can override it on card hover via a context-shared setter. The context lives in a non-route file (`apps/web/src/lol/hover-champion-context.tsx`) — when it lived inside the route file, the bundler's path resolution between `$accountSlug.tsx` (file) and `$accountSlug/index.tsx` (directory index) instantiated two distinct contexts and the consumer always saw `null`.
- **Scope-keyed `AnimatePresence`.** The root layout keys on the *first* path segment (`"/" | "/lol" | "/steam"`), so top-level navigation animates while sub-tab switches inside `/lol/$slug/...` don't re-mount the LoL header + tabs. A second `AnimatePresence` inside `$accountSlug.tsx` handles the inner sub-tab transition.
- **`LazyMotion` features must be `domMax`.** `domAnimation` (the lighter bundle) doesn't include layout animations, so the sliding nav pill, the LoL sub-tab underline, and the trend-count selector all silently stop animating if you downgrade. Cost is ~5 kB gzip — accepted.
- **Radix Tooltip with portal + collision detection.** Item hover cards on match detail use Radix's `Tooltip` primitive with `side="top"` defaulting and auto-flip to `bottom` when the trigger is near the viewport top. Portaling out of the row also frees them from any `overflow-hidden` ancestor that would otherwise clip them — important when the tooltip is taller than the participant row that triggered it.

### In progress

- **Multi-source identity stitching** — same player across LoL and Steam, no canonical join key
- **Performance budget** — Lighthouse scores, bundle deltas per route, when to lazy-load
- **Background workers** — historical match backfill without burning the live rate budget
