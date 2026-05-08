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

Status: parked

Use when Recharts hits a wall.

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

Status: parked

Options:

- `@tanstack/react-virtual`
- `react-virtuoso`

Why:

The infinite-scroll match list will eventually balloon DOM size. Virtualization gives a clean perf-engineering chapter with measurable before/after.

### Live-match tracker

Status: parked

Idea:

API polls Riot spectator API for tracked accounts. Web shows live match progress via SSE.

Why:

Real-time + polling + SSE in one feature. The SSE backfill arc is now shipped (per-account `match-updated` channel for the historical worker), so the wire format and frontend invalidation pattern are reusable; only the spectator-API polling layer would be net-new.

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
