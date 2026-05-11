# vyoh.gg — project history and status

This file preserves historical context that should not live in always-loaded `CLAUDE.md`.

## Repo layout

```text
vyoh.gg/
├── apps/
│   ├── web/      # React 19 + Vite + Tailwind + Motion + TanStack Router
│   └── api/      # NestJS 11 + Prisma + Bottleneck + Vitest
└── packages/
    └── shared/   # cross-cutting types/DTOs imported by both apps
```

## Last captured status — 2026-05-11

Multi-account LoL dashboard. Today's session shipped: empty-state primitive + illustrations across 8 surfaces; recap-champion splash stacking-context fix (added `isolate`, split chrome via complementary masks, plain `<img>` instead of CSS background); visx integration across four surfaces in one session (death matchup heatmap, champion synergy chord, LP history brush, build-order Sankey via d3-sankey). `.tanstack/` added to `.gitignore`. Champion detail page now hosts a build-flow Sankey + minute×matchup death heatmap on top of the existing per-game-average tiles, sparkline, per-patch strip, items, matchups, time heatmap, and tilt indicator. Profile now hosts a champion-synergy chord between ProfileDuos and ProfileQueueDistribution. LP history main chart gains a visx brush strip below it with a "Show all" reset.

## Last captured status — 2026-05-10

Multi-account LoL dashboard with deep-linked accounts, infinite-scroll match history, champion aggregation + detail, LP history + season history, trends as a magazine-grid briefing of conclusion cards (auto-reorder on range change), match detail with full post-game review depth. Lane opponent hover popover on match rows. Live game view with Spectator-V5 data. **Profile** identity layer covers rank tiles, recent form, LP history, season history, pre-game ritual, now-playing, role strip, queue distribution, activity calendar, stats, duos, recap CTA. **Recap** sub-route at `/lol/$accountSlug/recap` (rank arc + headline champion + auto-picked top insight). **Per-view queue scope:** performance surfaces (Trends, ritual, recap, champions, role strip) consume the user's "serious queues" preference (default Ranked Solo + Ranked Flex; configurable via header `<SeriousQueuesSettings />` popover, persisted to localStorage); identity surfaces (recent form, now playing, queue distribution, activity calendar, stats bar, duos, recap rank arc) consume all queues. Match list owns its own queue filter UI for browsing.

## Recent arcs (2026-05-11)

### Empty-state pass (vnext #8)

`EmptyState` primitive in [components/empty-state.tsx](apps/web/src/components/empty-state.tsx) with 5 hand-rolled inline SVGs (matches, LP history, champion portrait, duos, live game). Calm/abstract style — 1px strokes, dashed accents, all driven by `currentColor` via `text-muted-foreground/40` on the wrapper. Rolled across 8 surfaces: matches list (queue-strand vs no-cache differentiated, "Clear queue filter" action on strands), profile LP history, champion detail, live game (not-in-game + game-over), champions list, trends page, recap rank arc, profile duos. Decision log: vnext-ideas.md.

### Recap champion splash polish

Root cause: section's stacking context only existed during the `whileInView` opacity animation (<1). Once it reached 1, the context dissolved and the `-z-20` local splash escaped to the body's stacking context, falling behind the global `SplashProvider`'s Ken Burns drift + brightness-0.7 filter — visible as "stretches then dims." Fix: `isolate` class forces a permanent stacking context. Also split section chrome: dropped section `bg-card/40`; added a separate chrome layer with complementary mask so the right side renders the splash undimmed while the left retains the card chrome. Converted backdrop from CSS `background-image` to plain `<img>` (motion's `initial` doesn't apply at first paint, causing an unstyled-frame flash). Final opacity 0.6.

### visx integration (vnext #6) — four surfaces in one session

Packages installed: `@visx/scale`, `@visx/group`, `@visx/responsive`, `@visx/heatmap`, `@visx/chord`, `@visx/brush`, `@visx/axis`, `@visx/shape`, plus `d3-sankey`. Surfaces:

- **Minute × matchup death heatmap** on Champion detail. `scaleBand` for X (minute buckets) / Y (matchup champions), `scaleLinear` for color intensity. Empty state via `ConclusionCard` if <5 matches with timeline.
- **Champion synergy chord** on Profile (`profile-synergy.tsx`). New backend endpoint `GET …/champion-pairs` aggregates per-match `(yourChamp, teammateChamp)`. Bipartite layout via `you:` / `them:` prefixed nodes in a symmetric matrix (asymmetric matrix collapsed teammate-side arcs to slivers — d3-chord sizes by row-sum). `TOP_PER_SIDE=6`, `MIN_RIBBON_GAMES=2`. Ribbon color = win rate, opacity = pair frequency.
- **LP history brush** (`profile-lp-history.tsx`). Hybrid Recharts + visx — main chart stays Recharts; visx `Brush` strip below for sub-range selection. Custom `renderBrushHandle` for visible drag affordance. visx's `<Brush>` owns internal selection state, so reset requires bumping a `brushKey` to force remount (not just clearing the React `brushDomain`). Y axis recomputes for the brushed window.
- **Build-order Sankey** on Champion detail (`champion-build-sankey.tsx`). New backend endpoint `GET …/champions/:championKey/build-flow` intersects timeline `ITEM_PURCHASED` events with `Match.items` final inventory to get the completion order of items the user kept. d3-sankey lays out columns (item 1 → item 2 → item 3); subtle node rects + `colorForLift()` color encoding (neutral grey within ±5pp of champion baseline WR, green/rose only for strong deviations) to suppress sample-size noise.

Pattern established: visx for non-stock viz, Recharts stays for stock cases (line/bar/radar with reference primitives). Decision log: vnext-ideas.md, library-shortlist.md.

## Recent arcs (2026-05-10, late session)

### Phase 6 + Trends T3.5/T3.7 cluster

`teamPosition` schema prereq (`MatchSummary` + `Match` model + mapper, Prisma migration `phase_6_match_team_position`) → `TrendWorstMatchup` + `TrendRolePerformance` ConclusionCards → `ProfileRoleStrip`. Shared `RoleIcon` loads CDragon position SVGs (`plugins/rcp-fe-lol-static-assets/global/default/svg/position-{top,jungle,middle,bottom,utility}.svg`) with hand-rolled inline SVGs as `onError` fallback. Decision log: views-roadmap.md.

### Magazine-grid reflow on Trends

Tiles declared as a single data array with per-tile `designPriority` + `active` predicates; insufficient-data tiles get a 1000-point penalty so they sink. `ConclusionCard` verdict cross-fade via `AnimatePresence mode="popLayout"`. `SampleSizeBadge` migrated to Motion `pathLength`. `grid-flow-row-dense` backfills holes left when span-2 tiles push to next row. Decision log: trends-rework.md.

### Profile pre-game ritual + Yearly recap route

Pre-game ritual section on Profile (form / after-last-game tilt / current-hour slot / suggested champion) anchored to serious-queues data. Recap sub-route `/lol/$accountSlug/recap` with three hero sections (rank arc, champion-of-the-year with splash backdrop, auto-picked top insight from tilt / streak / hour). Decision log: vnext-ideas.md.

### Duo / squad detection (vnext #1) v1

`GET /lol/.../duos` reads `MatchDetailCache.detail` for the user's recent matches, finds same-team puuids, aggregates by puuid (games / wins / top champion), filters at ≥ 3 games together, returns top 10. `ProfileDuos` renders top 3 between role strip and queue distribution; "you mostly queue solo" empty state when no recurring duo. Squad detection (3+ groupings), LP-overlay graphs, shared champion-pair stats, and match-list highlighting deferred. Decision log: vnext-ideas.md, match-depth-roadmap.md (D.10).

### Queue-scope reframe — global filter → per-view scope

Global header `<QueueFilter />` removed in favor of a `<SeriousQueuesSettings />` popover that drives a localStorage-persisted "serious queues" preference. Performance views consume `useSeriousMatches()` (default ranked solo + flex; user can include normal draft or drop flex). Identity views consume `useMatchWindow()` directly. Match list grew its own inline queue filter. Memory entry: `feedback_queue_scope_per_view.md`. Decision logs: views-roadmap.md, trends-rework.md.

### Per-view controls placement consolidated

Briefly tried a sticky-below-header slot for matches queue filter + champions sort/count via portal mechanism. Reverted — three sticky chrome layers (global nav + account header + sticky controls) was structurally too heavy. Settled on inline non-sticky controls at the top of each long-list page (Matches, Champions, Trends), all using the same `flex items-center justify-between gap-3` pattern. The "filter from deep scroll" friction is intentionally handed off to the **Cmd+K palette extension** (vnext top-10) — that's the right surface for filtering long lists without scrolling up. Decision log: vnext-ideas.md.

## Recent arcs (2026-05-10)

### Lane opponent hover popover

Match history rows now surface the lane opponent's champion name with a hover popover revealing the full opposing team roster. The popover (`match-list-row-popover.tsx`) is lazy-loaded via `React.lazy` + `Suspense` to keep the match list bundle tight. `match-row.tsx` wraps the vs-column in a Radix `HoverCard`; participant cards show champion icon and name for all five opponents.

### Live game view

Full spectator page at `/lol/$accountSlug/live` plus an in-game indicator chip in the account header.

**Backend:**
- `LiveGamePollerService` polls Riot Spectator-V5 every 60 s for all tracked accounts; results held in an in-memory `Map<puuid, PuuidEntry>`.
- On new game: async enrichment fetches rank (League-V4), champion mastery, and last-5 match form for whitelisted accounts (those in the DB). Enrichment writes into the cache entry incrementally as promises settle.
- SSE events `game-started` / `game-ended` emitted through the existing `MatchEventsService` Subject.
- New endpoint: `GET /lol/summoners/:region/:gameName/:tagLine/live`.
- `LiveMatch` and related types added to `@vyoh/shared`.

**Frontend:**
- `use-live-match.ts`: `useLiveGame` (TanStack Query, `refetchInterval: 30 s`) + `useLiveGameEvents` (SSE subscription, invalidates on game-started/ended events).
- `live.tsx`: two-team participant cards (champion image with wsrv.nl → raw CDragon fallback, summoner spell icons and keystone via DDragon URLs, rank badge, mastery, form pips for whitelisted accounts), bans strip, queue/map/mode header badges, auto-exit state when game ends.
- Compositional analysis: `useQueries` fetches CDragon role data for all 10 champions in parallel; Recharts `RadarChart` overlays blue/red team profiles across six axes (tank/fighter/mage/assassin/marksman/support).
- `live-game-chip.tsx` (in `_shared`): animated "In Game" link chip using `AnimatePresence` / `m.div`, placed in the account header beside the queue filter and account switcher so it's visible on all sub-tabs when a game is active.
- Summoner spell icons and keystone perk images switched from CDragon `rcp-be-lol-game-data` raw paths (both returned 404) to DDragon: spells use `cdn/{version}/img/spell/{SpellKey}.png` keyed via `useDDragonVersion()`; keystones use versionless `cdn/img/perk-images/{CamelCasePath}`.

## Recent arcs (2026-05-08, night session)

### Sticky nav bars + `<main>` scroll container

**Dual sticky navs, full-viewport-width:**
- `<Nav>` promoted from `relative` to `sticky top-0 z-50`
- Account header in `$accountSlug.tsx` escaped the `max-w-4xl` content column via `ml-[calc(50%-50vw)] w-screen`; inner `mx-auto max-w-4xl px-6` re-constrains content — same escape trick as the Nav itself
- `bg-background/50 backdrop-blur-md` on account header (slightly more transparent than Nav's `/60`)

**`<main>` as scroll container:**
- Module-level `mainScrollRef: { current: HTMLElement | null }` singleton at `lib/scroll-container.ts` — shared across all scroll consumers without React context
- `__root.tsx` restructured to `flex h-dvh flex-col overflow-hidden`; `<main>` gets `flex-1 overflow-y-auto [overflow-x:clip]` and holds `mainScrollRef`
- `[overflow-x:clip]` on `<main>` stops the `w-screen` account header from creating horizontal overflow on Windows (where `100vw` includes the scrollbar gutter)
- `useWindowVirtualizer` → `useVirtualizer` in `match-list.tsx`; `getScrollElement: () => mainScrollRef.current`; `scrollMargin` recomputed via `getBoundingClientRect()` diff against the container instead of `offsetTop`
- `scroll-to-top.tsx`, `active-match-context.tsx`, `match-list.tsx`, `$accountSlug.tsx` all migrated from `window.scrollY / scrollTo / addEventListener` to container equivalents
- `html, body { overflow: hidden }` in `index.css` prevents `<html>` from ever showing a scrollbar; this fixes the transient second scrollbar on tab transitions — AnimatePresence `mode="popLayout"` makes the exiting `m.div` `position: absolute` and without a positioned ancestor inside `<main>`, the containing block resolves to `<html>`, which the tall virtual list height then overflows

**Match list page size aligned:**
- `MATCHES_PAGE_SIZE` bumped 10 → 20 to match `INITIAL_VISIBLE = 20`, eliminating the eager second fetch that fired before any scrolling
- `REVEAL_INCREMENT` bumped 10 → 20 for symmetry

## Recent arcs (2026-05-08, evening session)

### Rate-limiter chain wedge — two compounding bugs

Match list stopped growing after ~30 min of uptime. `EXECUTING` counter on the chained Bottleneck climbed monotonically across cron ticks (20 → 1 → 2 → … → 34) without ever decrementing. Two interacting issues:

- Deadline abandonment was leaking Bottleneck slots. `Promise.race([queued, deadline])` rejects the caller's await but the limiter job stays scheduled; if the chain is wedged, the wrapped `fn` never runs and the slot never frees. Fix: short-circuit *inside* the wrapped callback so the slot drops the moment Bottleneck dispatches it.
- `updateSettings({ reservoir })` perturbs the `reservoirIncrease` ticker. Every successful response was calling `syncFromHeaders` → `updateSettings({ reservoir: target })`, nudging the ticker out of phase. Fix: drain via `incrementReservoir(target - current)`, the targeted operation that composes with the increase ticker.
- Added a periodic `logger.debug` of every limiter's counts + reservoir so the next regression is diagnosable from the log without re-instrumenting.

### Historical backfill worker

Cron used to fetch only the latest 20 matches per account, head-only. Match list capped at 20 forever. New `syncAccountHistorical` step runs alongside head sync per tick:

- Anchors on `min(playedAt)` from the DB. Time-anchored, not offset-anchored, so head churn (new games played between ticks) doesn't cause drift.
- Calls `getMatchIdsByPuuid({ endTime, count: 20 })` — Riot's exclusive `endTime` parameter returns matches strictly older than the boundary.
- When Riot returns a short page ("reached genesis"), persists `historicalDoneAt: DateTime?` on the `Summoner` row; the cron skips the call thereafter.
- 4 accounts × 21 calls/tick every 5 min stays well under the 100 req / 120 s app-slow ceiling. A 1000-game account fully backfills in ~4 hours of unattended uptime.

### Live SSE updates of new rows

Backfill events emit through a small `MatchEventsService` (`Subject<MatchUpdatedEvent>` + `forPuuid` filter). The `@Sse('matches/events')` controller route resolves the requested account to a puuid and merges filtered events with a 30 s heartbeat. The frontend `useMatchEventsSubscription` hook opens an `EventSource` at the `$accountSlug.tsx` layout and `queryClient.invalidateQueries` against `["lol", "matches-cached", …]` / `["lol", "matches-cached-infinite", …]` on `match-updated`. Push for *signalling*; pull (DB read via `/matches/cached`) for *content* — keeps the SSE schema decoupled from the row schema. Mounted at the layout, so the stream survives sub-tab navigation and tears down on account switch / unmount.

### Splash backdrop perf overhaul

Hover-driven flicker on a 4K monitor exposed five compounding issues in the splash backdrop pipeline.

- `filter: blur(5px)` on the splash `<img>` forced fullscreen re-rasterize each frame any transform animated. Replaced with a wsrv.nl proxy URL that bakes the blur into a small WebP (`?w=600&blur=1&output=webp&q=80`); the browser composites a pre-blurred bitmap with no live filter cost. CSS keeps only `saturate(0.92) brightness(0.7)` (cheap matrix filters).
- Cached blurhash decode in a module-scope `Map<hash, dataUrl>`. Replaces `react-blurhash` (per-mount canvas paint) with one decode per hash and a reused `<img>` element on subsequent champion swaps.
- `fetchPriority="low"` on the decorative backdrop image so it stops competing with LCP.
- `useIsPresent()` from motion settles the Ken Burns transform back to neutral on exit over the same 0.7 s as the parent opacity fade — stops the infinite repeat from continuing on outgoing layers during cross-fade.
- Hover-driven champion changes debounced 80 ms in `$accountSlug.tsx`. A quick mouse sweep over the match list no longer remounts the backdrop per row.
- Dropped the `new Image() + decode()` fade-in dance — `<m.img onLoad>` does the same job in less code.

Champion card thumbnails now also route through wsrv.nl: ~12× smaller (89 KB JPG → 7 KB WebP) and ~6× less decode work, with framing identical to the original CDragon centered crop. Both surfaces fall back to the direct CDragon URL via `<img onError>` if wsrv.nl ever fails.

Dep swap: `react-blurhash` → `blurhash` direct. New helpers in `champion-icon.ts`: `championCardSplashUrl`, `championBackdropSplashUrl`. Full rewrite of `splash-backdrop.tsx`; debounce in `$accountSlug.tsx`.

### Match-list scroll-restore + champion-card pop-in polish

Two related UX bugs surfaced in the same session.

**Scroll-restore was firing on every return to /matches.** `ActiveMatchProvider` wrote `scrollYRef` on row click and never cleared it, so any time `MatchList` mounted it ran the restore + 600 ms pin loop — including returning from /trends or /champions where the saved value was always stale. Compounded by TanStack Router's `scrollRestoration` being disabled (it interferes with `MatchList`'s manual restore on detail → list back-nav), every cross-tab transition just inherited the last document scroll position; clicking Trends from a deep position in the list dumped you partway down the shorter Trends page.

- Added `clearListScroll()` to `active-match-context.tsx`. A small `MatchListReturnReset` component lives inside the provider and clears `scrollYRef` + `activeMatch` whenever pathname leaves the matches subtree.
- `useLayoutEffect` on pathname in `AccountLayout` scrolls window to 0 on every cross-tab transition, with a single carve-out for detail → list back-nav so `MatchList`'s restore still wins. Effect order is bottom-up — `MatchList`'s restore `useLayoutEffect` runs first; the layout one short-circuits if it's a return-from-detail, otherwise scrolls.
- Renamed the local `const window = useCachedMatchesWindow(...)` to `matchesWindow` — was shadowing the global `window` and made the first `scrollTo` attempt typecheck against `UseQueryResult.scrollTo`, which doesn't exist.

**Champion cards popped in on slow loads.** Card thumbnails come from wsrv.nl over the network; on a cold cache or slow connection the image just snapped into place when it arrived.

- Per-card `loaded` boolean, image starts at `opacity-0` and transitions to `opacity-95` once `onLoad` fires. 300 ms transition for both first-load and instant cache hits, intentionally consistent.
- Boolean intentionally never resets on champion swap, so virtualizer-driven src changes mid-scroll keep the previous frame visible until the new image decodes — no flicker.
- Tinted placeholder behind the strip uses `color-mix(in oklab, var(--theme-color) 18%, transparent)` so a slow load hints at the champion's palette instead of empty space.

## Recent arcs (2026-05-08)

### Trends entrances

- summary cards count up (KDA, win rate, totals) via extended `count-up.tsx` with `decimals` support
- staggered Motion variants on summary container/cards
- KDA Recharts `Line` animates with `animationBegin: 480` / `animationDuration: 1800`
- queue chart converted from BarChart to donut PieChart with hover-driven center label (count + percentage), legend rows also drive `activeIndex`

### Champion sort selector + grid reorder

- new `champion-sort-selector.tsx` segmented control (Games / Win rate / KDA / Playtime) with sliding pill via `layoutId`
- `champion-table.tsx` adds `sort` prop and `sortStats()` helper; each `<m.li>` gets `layout` for physical reorder, no remounts

### Match-detail damage/gold bars

- `StatBar` with spring `scaleX 0 → target`, `transformOrigin: left`, staggered down each team
- damage normalized to match high; gold normalized to match high
- inline icons in `components/game-icons.tsx`: `CrossedSwordsIcon` (Lorc) and `TwoCoinsIcon` (Delapouite) from game-icons.net, CC BY 3.0
- `match-detail-view.tsx` no longer renders the header (now in `MatchHero`); just `TeamBlocks`

### Account switcher preserves sub-tab

- `account-switcher.tsx` reads pathname via `useRouterState`, picks `tabRoute` from `segment[3]` (`trends` / `champions` / `matches`)
- navigates to `/lol/$accountSlug/{tab}` with `search: (prev) => prev` so queue filter survives

### Loading states

- new shared `shimmer-block.tsx`, `loader.tsx` (uses `<output aria-label>` for biome a11y)
- `trends-skeleton.tsx`, `champions-skeleton.tsx` for data routes
- match list/detail skeletons already existed; this fills the gap on Trends/Champions

### Splash backdrop owner-ID race fix

- `splash-backdrop.tsx` adds owner-ID system: module-level `ownerSeq`, per-hook `ownerRef`, `activeOwnerRef`
- `clearChampion(owner)` early-returns if `activeOwnerRef.current !== owner`
- fixes race where AnimatePresence-delayed cleanup of the old route ran AFTER the new route's setter, blanking the splash

### Shared element list → detail morph

- whole-card morph via `layoutId={\`match-card-${matchId}\`}` on `match-row.tsx` + `match-hero.tsx`
- `active-match-context.tsx` scopes `layoutId` to the clicked row only (other rows don't animate); also owns scroll save/restore and `morphEpoch`
- `match-row.tsx` `onPointerDown`: `saveListScroll()` + `flushSync(() => setActiveMatch(match.matchId))`
- `MatchHero` matches the row exactly: `h-28`, same typography, same content layout
- hover split: `.themed-card` (base border) + `.themed-card-interactive:hover` (glow); `championCardBaseClassName` for hero (no interactive add-on)
- entrance opacity fade removed from `m.div` in `$accountSlug.tsx` — was washing out the morph; exit-only fade now

### Back-nav scroll restoration

- `match-list.tsx` reads `restoredScrollY` from `readListScroll()` in `useState` initializer (does NOT consume; multiple StrictMode mounts all restore the same value)
- `visibleCount` initialized to fit restored scroll: `Math.ceil((scrollY + innerHeight) / 124) + 4`
- `seenCountRef = useRef(restoredScrollY > 0 ? visibleCount : 0)` suppresses entrance stagger so the list doesn't slide down on back-nav
- `useLayoutEffect`: instant `scrollTo` + 600ms rAF pin loop fighting popLayout, then `setTimeout(bumpMorphEpoch, 32)` forces row remount so motion remeasures at correct scroll
- `useCachedMatchSummary(matchId)` in `use-matches.ts` searches infinite + windowed query caches so the hero renders instantly while detail loads
- removed `scrollRestoration: true` from `main.tsx` router config; it was overriding the manual restore

## Recent arcs

### Match detail focus mode

When on `/lol/$slug/matches/$matchId`, the queue filter, account switcher, and sub-tabs hide. They are replaced with a shadcn `Breadcrumb`:

```text
Matches › Aug 12 — Ahri
```

The breadcrumb springs in from the left and crossfades the dynamic label as `detail.data` lands. It uses `AnimatePresence mode="wait"` keyed on the label string.

### Queue filter

On `/lol/$accountSlug/*`, queue is both:

- a Riot Match-V5 query param passed through `RiotService.getMatchIdsByPuuid`
- a URL search param validated on the `$accountSlug` route

It persists across Matches/Trends/Champions tabs and account switching via:

- `search: (prev) => prev` on `<Link>`
- `useNavigate`
- query keys in `useMatches` and `useMatchesWindow`

`MATCHES_PAGE_SIZE = 20` limits per-fetch volume (aligns with `INITIAL_VISIBLE = 20` in `match-list.tsx`).

### Command palette

Cmd+K command palette using `cmdk` + custom Dialog primitives. It jumps to pages, accounts, or current-account tabs.

### Match list polish

- pointer-aware card tilt
- animated KDA tickers
- `useMotionValue` + spring
- `useReducedMotion`-aware

### Trends page

- win/loss streak badge computed from latest matches
- charting via lazy-loaded Recharts on the trends route
- separate windowed query + shared `MatchCountSelector` for 20/50/100 match windows

### Visual polish

- custom scrollbars
- noise/grain background
- mesh-gradient variant tried and rejected as too loud
- layout-id sliding indicators on top nav and LoL sub-tabs
- brand icons inlined from simple-icons
- skeletons with shimmer for match list and detail

### Splash backdrop

`SplashProvider` is hoisted to root so the backdrop survives route transitions. It includes mouse-tracked parallax and crossfades between champions.

### Item tooltips

Item tooltips show name, gold cost, and rendered Riot description markup with custom CSS for tags like:

- `<active>`
- `<passive>`
- `<attention>`

### Pagination

Match list uses `useInfiniteQuery` with:

- intersection-observer auto-load
- manual "Load more"
- separate windowed query for trends/champions

### Champion display names

`useChampionName` maps Match-V5 aliases to CDragon display names.

Fixes examples:

- `JarvanIV`
- `AurelionSol`
- `MonkeyKing`

### CDragon migration

Replaced pinned-version DDragon with `cdn.communitydragon.org/latest/...` so newer champions/items do not 404.

### Splash direction map

Per-champion flip map controls splash facing direction. Default is flip, with exceptions in `champion-direction.ts`.

## Important patterns to preserve

### Scope-keyed `AnimatePresence`

Top-level transitions are keyed on the first path segment in `__root.tsx`:

- `/`
- `/lol`
- `/steam`

This means Home ↔ LoL ↔ Steam animates, while sub-tab switches inside `/lol/$slug/*` do not re-key the whole layout.

Sub-tab transitions are handled separately inside `$accountSlug.tsx`.

### `SplashProvider`

`SplashProvider` wraps the whole app and exposes:

```ts
useSplashChampion(name)
```

The match-detail page sets the champion. The backdrop persists across navigation with a short grace period and crossfade between champions. This avoids flashing from unmounting the backdrop on each route change.

### `LazyMotion` features

`LazyMotion` uses `domMax` in `main.tsx`.

Do not downgrade to `domAnimation`. `layoutId` animations depend on `domMax`, including:

- sliding nav pill
- sub-tab underline
- count-selector indicator

### Test animation bypass

`count-up.tsx` has a `SHOULD_ANIMATE` bypass:

```ts
import.meta.env.MODE !== "test"
```

Preserve this. happy-dom does not reliably advance Motion timelines.

## Parked follow-ups

### API dist spec files

Nest's SWC builder currently emits spec files into `apps/api/dist/`.

This is cosmetic only. Specs are not imported by the runtime tree.

Possible future fixes:

1. configure SWC builder exclude in `nest-cli.json`
2. add `.swcrc` rules
3. move tests to `__tests__/` directories

Defer until it actually bothers us.

### SSE / streaming for heavy backfills

When fetching a "Last 100 games" window for an account with little cache, the API currently fetches match details through the rate limiter and returns when all settle.

A better UX could stream progress via SSE:

```ts
{ matchId, status: "ready" | "failed" }
```

The web side could replace skeleton rows as each match lands.

This pairs well with:

- Bottleneck queue depth
- partial results
- optimistic UI
- global progress bar
- case-study write-up

Defer until the global bar feels insufficient.

### Redis + BullMQ

Still planned, not wired.

Add when historical backfill workers need a real queue. Do not add just because the architecture originally planned it.
