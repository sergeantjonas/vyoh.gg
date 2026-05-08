# vyoh.gg — motion and animation backlog

This project should feel polished and smooth. It is a portfolio showcase, so motion is not just decoration — it is part of the perceived engineering quality.

Guardrails:

- bold is allowed
- loud is not
- avoid confetti, slot-machine vibes, tacky gradients, and distracting motion
- calm aesthetic wins
- respect reduced-motion preferences
- use evidence when discussing perf impact

---

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

### Directional tab transitions

Status: shipped

Implemented as:

- `pageSlideVariants` with `custom` prop on `AnimatePresence` so exiting elements receive updated direction at exit time
- direction computed synchronously in render body (ref mutation) so entering element gets correct `initial` on its first render — no extra pass
- non-tab routes (match detail, unknown paths) resolve to `dir=0` for a plain fade
- reduced motion collapses to fade only via `effectiveDir = prefersReducedMotion ? 0 : slideDir`

### Splash Ken Burns

Status: shipped

Implemented as:

- `kenBurnsDrift()` uses FNV hash of champion name to produce a unique pan angle and magnitude per champion — each splash drifts its own way
- 18s `repeatType: "reverse"` loop, scale 1→1.13, drift up to ±3% x/y
- `loopActive = !reduced && isPresent` stops the loop on reduced motion and settles back to neutral on exit (avoids running compositor work after the layer fades)
- wsrv.nl pre-blurred WebP replaces live CSS `filter: blur()`, removing per-frame repaint cost
- blurhash placeholder decoded once to a 32×32 data URL and cached in module scope — no repeated canvas operations on remount

---

## Medium impact

### Heatmap fills in waves

Status: shipped

Implemented as:

- `transformDayElement` in `trend-activity.tsx` uses `cloneElement` to append `heatmap-cell` class and `animationDelay: (col + row) * 10ms` per SVG rect — diagonal wave left→bottom-right
- `@keyframes heatmap-reveal` (opacity 0→1, 280ms ease-out) + `.heatmap-cell` class in `index.css`
- `@media (prefers-reduced-motion: reduce)` suppresses the animation entirely
- hover/tooltips unaffected (CSS animation-delay only applies to the reveal, not pointer events)

### Scroll-driven section reveals on Trends

Status: shipped

Implemented as:

- `Reveal` wrapper component in `trends.tsx` with `whileInView`/`viewport={{ once: true, amount: 0.1 }}`
- wraps all five trend sections (`TrendSummaryCards`, `TrendRecord`, `TrendActivity`, `TrendKda`, `TrendQueue`)
- reduced motion: `initial={}/whileInView={}` no-ops (no invisible flash)

### Item-build sequence on match detail

Status: shipped

Implemented as:

- `itemsContainer` variant (`staggerChildren: 0.04, delayChildren: 0.05`) on `ItemSlots` container
- `itemReveal` variant (`scale 0.7→1, opacity 0→1`, spring 500/26) on each `m.div` slot wrapper
- reduced motion: `initial="show"` skips animation entirely

---

## Small polish

### Springy press states

Status: shipped

Implemented as:

- scroll-to-top button: `whileTap={{ scale: 0.88 }}` + `whileHover={{ y: -3 }}`
- champion cards: `whileTap={{ scale: 0.97 }}` on `CardTilt`'s `m.div` — applies to all cards using the tilt wrapper; disabled automatically via the reduced-motion early return
- queue filter, count selector, and other small controls left without `whileTap` — too small for it to read well

### Champion icon breathing on hover

Status: shipped

Implemented as:

- `@keyframes card-breathe` (scale 1→1.03→1, 3s ease-in-out infinite) in `index.css`
- `.group:hover .card-splash-breathe` activates the animation only when the parent group is hovered — animation stops and element returns to scale(1) on unhover
- `champion-card.tsx` inner splash div uses `.card-splash-breathe` class (replaced `group-hover:scale-105` CSS transition)
- `@media (prefers-reduced-motion: reduce)` suppresses animation

### Animated nav icons on tab change

Status: shipped

Implemented as:

- each tab icon wrapped in `m.span` with `key={active ? 1 : 0}` — key change on activation triggers remount and spring-in from a unique initial state
- Matches (`History`): enters from `scale 0.75, rotate -12°`
- Trends (`TrendingUp`): enters from `scale 0.75, y 5px`
- Champions (`Crown`): enters from `scale 0.65, rotate 8°`
- spring stiffness 450 / damping 18 for a snappy pop
- `initial={false}` on deactivation — no animation when leaving active state
- reduced motion: `initial={false}` skips all activation animation

### First-paint orchestration

Status: partial

Shipped:

- skeletons on data routes (`MatchListSkeleton`, `TrendsSkeleton`, `ChampionsSkeleton`)
- shared `<Loader>` spinner for short fetches
- staggered Trends entrance (cards → chart) handles part of the orchestration story
- scroll-driven reveals on Trends sections
- empty states (`No matches yet to chart`, `No matches cached yet`, `No matches yet to aggregate`) fade in with 0.4s opacity transition

Still parked:

- explicit header → summary → chart → list cascade across the whole layout on first visit
- suppress/shorten on repeat visits within a session

### Champion card image fade-in

Status: shipped

Implemented as:

- per-card `loaded` boolean in `champion-card.tsx`; image starts at `opacity-0` and fades to `opacity-95` once `onLoad` fires
- boolean never resets on champion swap, so virtualizer-driven remounts keep the previous frame visible until the new image decodes — no flicker
- tinted placeholder uses `color-mix(in oklab, var(--theme-color) 18%, transparent)` — slow loads hint at the champion's palette
- 300ms transition, consistent for both first-load and instant cache hits

### Champion cards CountUp + win-rate bar

Status: shipped

Implemented as:

- `CountUp` wired into win rate % and KDA in `champion-table.tsx`, 0.7s ease-out
- animated fill bar below the stats line: `scaleX 0 → winRate`, spring 220/28, green ≥50% / red <50%
- reduced motion: `initial={{ scaleX: s.winRate }}` skips the fill animation

### Match detail polish batch

Status: shipped

Implemented as:

- blue/red team blocks stagger: blue enters immediately, red delayed 120ms, spring 300/28
- `isMe` participant row: pulsing `boxShadow` ring overlay, 2.8s loop, delayed 0.8s after row lands, disabled for reduced motion
- compact champion strip: appears below account header when hero scrolls past, `position: fixed` with live `getBoundingClientRect()` measurement via `[data-account-header]` query
- hero↔strip crossfade: hero exits `opacity 0, y -8` over 250ms; strip enters with spring 400/35

### Empty-state animation

Status: shipped

Implemented as:

- `m.p` with `initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}` on all three empty-state paragraphs (matches, trends, champions routes)
- no reduced-motion gate — a 400ms opacity fade is below the threshold of distracting motion

---

## Second polish pass

### Parallax splash backdrop on scroll

Status: shipped

Implemented as:

- `useMotionValue(scrollY)` + scroll listener on `mainScrollRef` in `SplashProvider`
- `useTransform(scrollY, s => reduced ? 0 : s * -0.03)` drives `backdropY`
- applied as `style={{ y: backdropY }}` on the portal wrapper — purely compositor (no paint)
- removed `overflow-hidden` from the fixed wrapper; inner layer already extends ±4% to absorb the shift
- gated to `!reduced` via the transform function

### Infinite scroll load-more stagger

Status: shipped

Implemented as:

- added `y: isNew ? 10 : 0` to `initial` on each virtual row in `match-list.tsx`
- `animate={{ y: 0 }}` on all rows so new batches slide up from below on fetch-next-page
- works for both initial page load and subsequent load-more pages; back-nav restore rows are unaffected (`isNew = false` when seenCount pre-populated)

### Custom spring Recharts tooltip on KDA chart

Status: shipped

Implemented as:

- `KdaTooltip` component in `trend-kda.tsx` with `AnimatePresence` wrapping `active && payload`
- `m.div` with `initial={{ opacity: 0, y: 4, scale: 0.96 }}`, spring 400/28 entrance and exit
- matches existing popover styling (`bg-popover/85`, border, `backdrop-blur-md`, shadow-xl)
- replaced Recharts' built-in `contentStyle`/`formatter` props with the custom component
- reduced motion: `initial={}/exit={}` no-ops

### Live row insertion + win/loss pulse on SSE new matches

Status: shipped

Implemented as:

- `prevMatchIdsRef` Set tracks all seen matchIds across query updates
- on each `matches` change, leading new matchIds (not in the set, appearing at index 0, 1…) are collected as `flashMatchIds` state, cleared after 2.5s
- virtual rows keyed by `match.matchId` instead of `virtualRow.index` — identity tracking means SSE-inserted rows always mount fresh and play `initial`
- SSE rows: `initial={{ opacity: 0, y: -16 }}` (from above), spring 340/28 entrance
- `isNew` prop passed to `MatchRow`; card shows a one-shot `boxShadow` pulse — green for win, red for loss, 1.6s ease-in-out, no repeat

### Count-selector stat re-animation

Status: shipped (was already working)

The `animate={{ scaleX: s.winRate }}` on champion win-rate bars and `CountUp to={...}` on stats already spring to new values when the match window changes — no additional code needed. Motion interpolates from current to target on every `animate` change; `CountUp` re-runs its tween whenever `to` changes.

---

## Bigger swings

### Reduced-motion audit

Status: shipped

Audit surface resolved:

- card tilt (`card-tilt.tsx`) — `useReducedMotion` added; returns `<>{children}</>` (no tilt wrapper) when reduced ✓
- page transitions — `effectiveDir` collapses to fade ✓
- chart animations (Recharts `trend-kda.tsx`) — `animationDuration={reduced ? 0 : 1800}` ✓
- splash backdrop — `loopActive = !reduced && isPresent` ✓
- count-up numbers — `skip = reduced` guard ✓
- skeletons/shimmer — `@media (prefers-reduced-motion: reduce) { .animate-shimmer { animation: none } }` in `index.css` ✓
- heatmap wave — same `prefers-reduced-motion` block in `index.css` ✓
- card breathing — same block ✓
- hover animations — `whileHover` generally fine ✓
- shared element transitions — `morphEpoch`/layout animations not gated (acceptable; layout shifts are position-based, not decorative)
- nav icon spring pops — `initial={false}` when reduced ✓

### Magnetic hover on key buttons

Status: parked

Ideas:

- cursor proximity slightly pulls the button toward the cursor
- use very sparingly (one or two hero CTAs at most)
- high gimmick risk if overused; revisit only when other polish is complete
