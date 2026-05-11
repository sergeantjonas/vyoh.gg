# vyoh.gg — library shortlist

This file preserves shipped, rejected, and parked library ideas.

Use this only when planning a feature/polish arc. Do not add libraries just because they are listed here.

## Performance / observability

### `web-vitals`

Status: shipped

Implemented as:

- multi-subscriber bus
- console reporter
- `?perf=1` overlay

### `sonner`

Status: shipped

Toast feedback wired into TanStack Query mutation/query caches.

### `@vercel/og` idea

Status: shipped via direct `satori` + `@resvg/resvg-js`

Direct Satori/Resvg gave more flexibility than the Next-coupled `@vercel/og` package.

### `react-hotkeys-hook`

Status: parked

Potential uses:

- `j` / `k` between matches
- Esc to close detail
- `?` for shortcut help

Still relevant.

## Visual / animation — high leverage

### `@number-flow/react`

Status: rejected

Reason:

Slot-machine animation did not fit the calm aesthetic.

### `@formkit/auto-animate`

Status: parked

Potential use:

- drop-in list mutation animations
- useful when match-list filters land

### `@vibrant/core`

Status: shipped

Implemented through the `tools/champion-assets` precompute pipeline.

### `react-blurhash`

Status: shipped

Used for splash backdrop placeholders while the real image decodes.

### `react-circular-progressbar`

Status: parked

Potential use:

- animated gauges

Note:

Recharts can already cover most current needs.

### `embla-carousel-react`

Status: parked

Potential use:

- homepage "recent highlights" reel when home gets real content

## Visual / animation — bigger commitments

### `gsap` + ScrollTrigger`

Status: parked

Potential use:

- scroll-driven animations

Caveat:

Overlap with Motion. Lower priority.

### `@rive-app/react-canvas`

Status: parked

Potential use:

- interactive Rive animations
- empty states
- mascots

Caveat:

Can become gimmicky quickly.

### `react-three-fiber` + drei

Status: parked

Potential use:

- hero 3D scene

Caveat:

High gimmick risk on a stats dashboard.

### `@xyflow/react`

Status: parked

Potential use:

- item-build recipes
- match-event timelines
- item component → final item graphs

Real value once build-path visualization exists.

### `@visx/visx`

Status: shipped 2026-05-11

Installed packages: `@visx/scale`, `@visx/group`, `@visx/responsive`, `@visx/heatmap`, `@visx/chord`, `@visx/brush`, `@visx/axis`, `@visx/shape`. Used across four surfaces in one session:

- **Death matchup heatmap** (`apps/web/src/lol/trends/trend-death-matchup-heatmap.tsx`) — `scaleBand` / `scaleLinear`, on Champion detail. Minute × matchup grid.
- **Champion synergy chord** (`apps/web/src/lol/profile/profile-synergy.tsx`) — `Chord` + `Ribbon`, on Profile. Bipartite layout (your champs / teammates' picks) via symmetric matrix.
- **LP history brush** (`apps/web/src/lol/profile/profile-lp-history.tsx`) — `Brush` + `LinePath`, hybrid with existing Recharts main chart. Custom `renderBrushHandle` for visible drag affordance; remount-keyed reset.
- **Build-order Sankey** (`apps/web/src/lol/champions/champion-build-sankey.tsx`) — uses `d3-sankey` directly (no `@visx/sankey` exists). visx provides `ParentSize`. Lift-vs-baseline color encoding.

Peer-dep warnings on install (declares React 16–18, we're on 19) are cosmetic; runtime is fine.

Stock Recharts call sites (LineChart / BarChart / RadarChart with reference primitives) remain on Recharts per the parked-decision rationale below.

### `d3-sankey`

Status: shipped 2026-05-11

Used by the build-order Sankey above. No `@visx/sankey` package exists in the ecosystem; visx itself uses d3 under the hood, so this is a natural extension.

## Visual / animation — small delights

### `canvas-confetti`

Status: rejected

Reason:

Too tacky for the calm dashboard aesthetic.

### `react-rough-notation`

Status: parked

Likely off-brand for calm dashboard.

### `@nivo/calendar` / `react-calendar-heatmap`

Status: shipped as `react-calendar-heatmap`

Used for the 365-day activity grid on Trends.

### `react-photo-view`

Status: parked

Potential use:

- Apple-Photos-style fullscreen splash viewer

### `react-fast-marquee`

Status: parked

Likely off-brand for calm dashboard.

### `react-resizable-panels`

Status: parked

Potential use:

- split-pane compare-two-accounts view

Real value once comparison surfaces exist.

### `tailwindcss-motion`

Status: parked

Likely redundant with Motion.

### `vaul`

Status: parked

Potential use:

- mobile drawer for match detail
- pairs with a future mobile arc

## Mobile / interaction

### `@use-gesture/react`

Status: parked

Potential use:

- improve existing card tilt
- swipe gestures
- mobile-first interactions

## Newer ideas

### Virtualization

Status: shipped

`@tanstack/react-virtual` powers the match list. Migrated from `useWindowVirtualizer` to `useVirtualizer` against the `<main>` scroll container in the 2026-05-08 sticky-nav arc. Backs scroll-restoration on detail → list nav and the SSE-new-rows insert animation. `react-virtuoso` not adopted.

### Live-match tracker

Status: shipped 2026-05-10

`LiveGamePollerService` polls Spectator-V5 server-side every 60s for whitelisted accounts; cached in-memory per `(puuid, gameId)`. Emits `game-started` / `game-ended` SSE through the existing `MatchEventsService`. Opportunistic enrichment per detected game (rank + mastery for all 10 players, last-5 form pips for whitelisted players, bans, queue/map/mode badges, compositional radar). Full route at `/lol/$accountSlug/live` plus a "Live now" chip in the account header. See match-depth-roadmap Phase C.

### Achievements / Highlights

Status: parked

Idea:

Pattern-match existing match data for:

- pentas
- streaks
- perfect games
- standout performances

Why:

Pure derived analytics, no new dependencies. Could become a Highlights tab.

### Type-safe runtime validation with Zod

Status: parked

Idea:

Use Zod schemas for:

- Riot responses
- internal DTOs
- API/web boundary validation

Why:

`@vyoh/shared` defines TypeScript types, but runtime validation would harden boundaries.

### Item-build graphs with `@xyflow/react`

Status: parked

Idea:

Render match item builds as a flow graph:

```text
recipe components → final item
```

Why:

Visually striking and uses data already available.

### `react-virtuoso` + scroll-restoration polish

Status: parked

Idea:

Match-detail revisits should preserve scroll position. Current TanStack Router navigation resets scroll.

### `cobe`

Status: parked

Idea:

Interactive globe for account regions.

Caveat:

Probably gimmicky.

### `@lottiefiles/dotlottie-react`

Status: parked

Idea:

Lottie animations for empty states.

Could fit calm aesthetic if used subtly.

### `shiki`

Status: parked

Potential use:

- API explorer surface
- inline code in case-study pages

### `comlink`

Status: parked

Potential use:

- web workers for heavy compute

Caveat:

Overkill for current load. Relevant if client-side timeline parsing arrives.
