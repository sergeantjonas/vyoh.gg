# vyoh.gg — motion and animation backlog

This project should feel polished and smooth. It is a portfolio showcase, so motion is not just decoration — it is part of the perceived engineering quality.

Guardrails:

- bold is allowed
- loud is not
- avoid confetti, slot-machine vibes, tacky gradients, and distracting motion
- calm aesthetic wins
- respect reduced-motion preferences
- use evidence when discussing perf impact

## Recommended starting trio

The original starting trio has all shipped. Next pickups likely come from Medium/Bigger swings below.

## High impact

### Trends charts come alive

Status: shipped

Implemented as:

- summary cards count up (KDA, win rate, totals) via `count-up.tsx` with `decimals` support
- KDA line entrance with `animationBegin`/`animationDuration` on Recharts `Line`
- queue chart converted to donut (PieChart + innerRadius) with hover-driven center label
- staggered entrance variants on summary container/cards

### Match-detail damage/gold bars grow from 0

Status: shipped

Implemented as:

- `StatBar` component with spring-driven `scaleX 0 → target`, `transformOrigin: left`
- damage bars normalized to highest damage in match, gold bars to highest gold
- stagger applied down each team block
- inline `CrossedSwordsIcon` (Lorc) and `TwoCoinsIcon` (Delapouite) from game-icons.net (CC BY 3.0) in `components/game-icons.tsx`

### Champions grid layout reorder on sort

Status: shipped

Implemented as:

- `champion-sort-selector.tsx` segmented control (Games / Win rate / KDA / Playtime) with sliding pill via `layoutId`
- `layout` prop on each `<m.li>` in `champion-table.tsx`
- `sortStats()` helper drives reorder; no remounts

## Medium impact

### Heatmap fills in waves

Status: parked

Ideas:

- diagonal opacity stagger from top-left to bottom-right
- suppress repeated animation with `sessionStorage`
- keep hover/tooltips immediate

### Scroll-driven section reveals on Trends

Status: parked

Ideas:

- `whileInView` fade + lift
- apply to major page sections, not every tiny element
- avoid slowing down frequent navigation

### Splash Ken Burns

Status: parked

Ideas:

- slow 30s continuous zoom + pan on backdrop
- subtle enough not to fight navigation
- replaces removed parallax feeling without pointer tracking

### Item-build sequence on match detail

Status: parked

Ideas:

- items appear in build order
- 60ms stagger
- pairs with existing team-row stagger

## Small polish

### Springy press states

Status: parked

Ideas:

- cards/buttons use subtle `whileTap={{ scale: 0.97 }}`
- stiff spring
- avoid applying to tiny controls where it feels jittery

### Champion icon breathing on hover

Status: parked

Ideas:

- scale 1.0 → 1.02 → 1.0 over 3s
- only on hover/focus
- respect reduced-motion

### Animated nav icons on tab change

Status: parked

Ideas:

- Matches clock ticks
- Trends arrow grows
- Champions crown shimmers
- activation only, not continuous looping

### First-paint orchestration

Status: partial

Shipped:

- skeletons on data routes (`MatchListSkeleton`, `TrendsSkeleton`, `ChampionsSkeleton`)
- shared `<Loader>` spinner for short fetches
- staggered Trends entrance (cards → chart) handles part of the orchestration story

Still parked:

- explicit header → summary → chart → list orchestration across the whole layout
- suppress/shorten on repeat visits

### Empty-state animation

Status: parked

Ideas:

- subtle Lottie or pure CSS animation
- use for "No matches yet to chart"
- must fit calm dashboard aesthetic

## Bigger swings

### Shared element transition: list → detail

Status: shipped

Implemented as:

- whole-card morph (not just the icon) via `layoutId={\`match-card-${matchId}\`}` on row + hero
- `ActiveMatchProvider` scopes the `layoutId` to the clicked row only — other rows do not animate
- `MatchHero` matches the row exactly: same `h-28`, typography, content (champion + Win/Loss, KDA, queue · duration · date)
- hover styles split into `.themed-card-interactive` so the static hero does not glow
- back-nav scroll restoration: `ActiveMatchProvider` saves `scrollY` on row click; `MatchList` restores it via instant `scrollTo` + 600ms rAF pin loop fighting popLayout
- `morphEpoch` bump 32ms after mount forces row remount so motion remeasures at restored scroll
- entrance opacity fade removed from `m.div` in `$accountSlug.tsx` (was washing out the morph); kept exit fade only

Reduced-motion audit still parked.

### Directional tab transitions

Status: parked

Ideas:

- Matches → Trends slides one direction
- Trends → Champions slides same forward direction
- reverse navigation slides backward
- base on tab order

### Reduced-motion audit

Status: parked

This is important because it demonstrates engineering depth, not just visual flair.

Audit:

- card tilt
- page transitions
- chart animations
- splash backdrop
- count-up numbers
- skeletons/shimmer
- hover animations
- shared element transitions

Document fallbacks in README if meaningful.

### Magnetic hover on key buttons

Status: parked

Ideas:

- cursor proximity slightly pulls buttons
- use very sparingly
- high gimmick risk if overused
