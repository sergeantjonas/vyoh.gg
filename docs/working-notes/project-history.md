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

## Last captured status — 2026-05-08

The personal-dashboard pivot is in. The app is a multi-account LoL dashboard with deep-linked accounts, infinite-scroll match history, trend charts, champion aggregation, match detail with team/item breakdowns, and a major motion/polish pass that covers Trends entrances, sort-driven layout reorder, damage/gold bar growth, list → detail morph with scroll restoration, and broader loading states.

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

`MATCHES_PAGE_SIZE = 10` limits per-fetch volume.

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
