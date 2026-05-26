# Scroll-driven shell behaviors

**Status:** Shipped 2026-05-26, refined 2026-05-26. Shipped scope: motion.css with named `--main-scroll` timeline + @property, nav compaction (`--nav-collapse`), section progress hairline ([scroll-progress.tsx](../../../apps/web/src/components/scroll-progress.tsx)), view-entry on BentoTile + CardShell. **Splash opacity decay was reverted** — the wrapper opacity multiplier made the splash feel dull, and removing it surfaced the Ken Burns loop against low-res splash art; the right call was to leave the pre-arc splash behavior intact. `SplashProvider` now drives `useThemeColor` so the per-route `--theme-color` cascade follows the active backdrop champion. ScrollProgress lives as a sibling of `<main>` (between `#section-header-slot` and `<main>`) — inside `<main>` it inherited the scrollbar-gutter inset. Firefox stable doesn't ship CSS scroll-driven animations on default builds, so ScrollProgress carries a JS fallback (`CSS.supports("animation-timeline: scroll()")` feature-detect → `requestAnimationFrame`-throttled scroll listener on `mainScrollRef`); nav compaction degrades to its initial-value state (uncompacted) on Firefox stable. prefers-reduced-motion: replace strategy in motion.css.

Read this when adding any scroll-coupled visual behavior, or when scoping a polish pass on the `<main>` scroll container.

KB anchors: [03-motion.md §4 Scroll-driven animations](~/.claude/knowledge/frontend-2026/03-motion.md), [01-css-and-styling.md "scroll-driven animations" table row](~/.claude/knowledge/frontend-2026/01-css-and-styling.md). MDN: https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline.

---

## Why

The shell architecture sets us up perfectly:

- `<main>` is the scroll container (not `window`); TanStack Router scroll restoration is disabled; each section owns its scroll-to-top per [CLAUDE.md §Architectural patterns](../../../CLAUDE.md). This means scroll position is predictable per route.
- Scroll-driven CSS animations are Newly Available in Safari 26 (Sept 2025) per [01-css-and-styling.md](~/.claude/knowledge/frontend-2026/01-css-and-styling.md); Chrome 115+ shipped them years ago. Firefox is still flagged — fallback is "no animation," which is acceptable since these are decoration-tier behaviors.
- Replaces what would otherwise be MotionValues + `useScroll()` + render-phase math, which the codebase explicitly avoids per the reverted scroll-linked parallax attempt in commit `4c60951` ([motion-backlog.md "Ambient backdrop polish"](motion-backlog.md)).

The reverted parallax used a JS-driven `y` transform that caused jank under load. **The CSS version is GPU-only, runs on the compositor, and is exempt from the React render loop entirely** — so the prior failure mode does not recur.

---

## What this is NOT

- **Not a return of vertical-translation parallax on the splash backdrop.** That was reverted intentionally. The shell uses **opacity decay** and **blur intensification**, not translate.
- **Not scroll-snap.** Snap-scrolling for the match-detail timeline is a separate idea filed under [data-viz-densification.md](data-viz-densification.md) Chunk 4.
- **Not scrollytelling.** Long-form scroll-driven storytelling for case-study pages is in [vnext-ideas.md §Scroll-driven case-study pages](vnext-ideas.md) and explicitly out of scope here — that's GSAP ScrollTrigger territory per [03-motion.md §2](~/.claude/knowledge/frontend-2026/03-motion.md).

---

## Browser-support stance

| Behavior | Chrome | Safari | Firefox |
|---|---|---|---|
| `animation-timeline: scroll()` | 115+ | 26+ | Behind `layout.css.scroll-driven-animations.enabled` |
| `animation-timeline: view()` | 115+ | 26+ | Same flag |
| `@property` (needed for animating custom props) | 85+ | 16.4+ | 128+ |
| `timeline-scope` (named timeline across subtrees) | 115+ | 26+ | Same flag |

Firefox stable falls back to **no animation** — the styled state is the initial-value keyframe (e.g. `--nav-collapse: 0` = uncompacted nav). Acceptable for decoration tier. The progress hairline carries a JS fallback so it still tracks scroll on Firefox stable; the other surfaces stay at their initial state.

Two practical Firefox quirks discovered during the refinement pass:

- **`animation-duration` must be non-zero.** The `animation: <name> linear both` shorthand defaults duration to `0s`, which Firefox refuses to apply — even when `animation-timeline` is set. Use `1ms` as a sentinel; the duration is ignored once the scroll timeline takes over. Applies to every `animation:` declaration inside the `@supports (animation-timeline: scroll())` block.
- **Don't rely on `animation-fill-mode: both` with an unresolved timeline.** If the timeline can't resolve (Firefox stable, broken named-lookup, etc.), `fill: both` plus a `0s` default duration collapses to a 0-duration time-based animation that instantly completes at the `to` keyframe — manifests as "bar permanently at 100%, nav permanently compacted." Gate every scroll-driven rule behind `@supports (animation-timeline: scroll())` so non-supporting engines see only the initial-value state.

---

## Target outcome

Four shell behaviors, all driven by `animation-timeline: scroll(nearest)` on `<main>`:

### 1. Nav compaction
- Height collapses from `4rem → 3rem` over the first 120px of scroll.
- Backdrop-blur intensifies from `8px → 16px`.
- Border-bottom opacity strengthens from `0.4 → 0.9`.
- Logo wordmark micro-scales `1 → 0.92`.

### 2. Splash backdrop opacity decay
- The portal-mounted splash from [splash-backdrop.tsx](../../../apps/web/src/lol/_shared/assets/splash-backdrop.tsx) currently sits at `opacity: 0.2` everywhere.
- New behavior: starts at `0.28` at top of scroll, decays to `0.08` by 320px scrolled. Composes with the existing Ken Burns drift (which is time-driven and unaffected).
- Rationale: hero pages get more presence; deep-scroll reads (long match lists) get less visual competition with data.

### 3. Section progress indicator
- A 2px hairline under the nav border. Width animates from `0 → 100%` over the full scroll range of the active section (`animation-timeline: scroll(nearest)` with no inset).
- Color: the active section's accent (`var(--accent)` from [accent-color-system.md](accent-color-system.md), which should land first or in parallel).
- Subtly opacity-fades to `0` when the scroll progress is at 0 (don't draw a 0-width line).

### 4. Per-element `view()` entries
- Stat cards, match rows, bento tiles enter as they scroll into view: opacity `0 → 1`, `translateY 8px → 0`, `animation-timeline: view(block)` with `animation-range: entry 0% cover 30%`.
- Replaces ~80% of historical "fade-in on scroll" reveal code per [03-motion.md §4.4](~/.claude/knowledge/frontend-2026/03-motion.md). Cheaper than IntersectionObserver + state.
- **Important interaction with stagger:** if a list ALSO has mount stagger (from [mount-and-overlay-motion.md](mount-and-overlay-motion.md)), gate the `view()` entry to "below-the-fold items only" via `animation-range: entry`. Above-fold items use the mount stagger, below-fold items use scroll-driven entry. Document the boundary in the component.

---

## Chunked plan

### Chunk 1 — Foundation: `motion.css` + scroll-timeline declarations

New file `apps/web/src/styles/motion.css`, imported once in `main.tsx`.

Contents:
- Named scroll-timeline registration: `main { scroll-timeline-name: --main-scroll; scroll-timeline-axis: block; }` on the actual scroll container (verify the selector matches whatever the layout uses — likely `[data-main-scroll]` or similar; **read the current root layout first** before deciding).
- `@property` registrations for any custom properties we'll animate (`--nav-height`, `--splash-opacity`, `--progress-width`). Each needs `syntax`, `inherits`, `initial-value`.
- The four `@keyframes` blocks for nav-compact, splash-decay, section-progress, view-entry.
- Reduced-motion media block: `@media (prefers-reduced-motion: reduce) { /* set all animation-timeline: none; */ }` — animations collapse to their initial state, which is the un-scrolled appearance. See [reduced-motion-replacements.md](reduced-motion-replacements.md).

Test: snapshot of the computed style on a synthetic `<main>` element confirms the timeline registration. Tricky in happy-dom because it doesn't compute scroll-driven animations; rely on the `:root` rule existence + a real-browser visual check via the `verify` skill.

### Chunk 2 — Nav compaction

Apply to [nav.tsx](../../../apps/web/src/components/nav.tsx). Two ways to wire:
- Pure CSS: add `animation: nav-compact linear; animation-timeline: --main-scroll; animation-range: 0 120px;` to the nav root. Cleanest.
- CSS variable driven: animate a `--nav-collapse` property `0 → 1` and let the nav consume it via `height: calc(4rem - var(--nav-collapse) * 1rem)` etc. More composable but more indirection.

**Pick the variable-driven approach** because the nav already composes multiple visual states (active pill, gradient underline, scroll-progress under-bar) and one normalized progress variable is easier to reason about than four parallel animations.

Test: synthetic scroll event on `<main>` updates the variable, and nav height/blur computed style follows. (Happy-dom limitation acknowledged; supplement with a Playwright check if one ever exists.)

### Chunk 3 — Splash backdrop opacity decay

Modify [splash-backdrop.tsx](../../../apps/web/src/lol/_shared/assets/splash-backdrop.tsx) to read its base opacity from `var(--splash-opacity)` instead of the hardcoded `0.2`. Then the `motion.css` animation `splash-decay` drives the variable from `0.28 → 0.08`.

Composes with existing Ken Burns (transform-driven) without conflict — they animate different properties.

Test: the inline style uses the var; the var changes on scroll progress.

### Chunk 4 — Section progress indicator

New tiny component `apps/web/src/components/scroll-progress.tsx` mounted once under the nav border. A single `<div>` with `width: var(--progress-width); background: var(--accent); height: 2px;`. The width is driven by:

```css
@keyframes section-progress {
  to { --progress-width: 100%; }
}
[data-scroll-progress] {
  animation: section-progress linear;
  animation-timeline: --main-scroll;
}
```

Depends on [accent-color-system.md](accent-color-system.md) for `--accent`.

Test: width follows scroll position; the line is invisible when scroll is at 0 (opacity tied to progress > 0).

### Chunk 5 — Per-element `view()` entries

Apply selectively, not blanket-globally:
- Match list rows in [match-list.tsx](../../../apps/web/src/lol/matches/match-list.tsx) — but only below-the-fold (the first N rows use mount stagger from [mount-and-overlay-motion.md](mount-and-overlay-motion.md)).
- Champion grid items in [champion-table.tsx](../../../apps/web/src/lol/champions/champion-table.tsx).
- Bento tiles on `/` in [apps/web/src/components/bento/](../../../apps/web/src/components/bento/).
- Trends `ConclusionCard` items (when they enter on scroll, not on filter-reflow which is `layout`-driven).

Per element:
```css
.list-item {
  animation: view-entry linear;
  animation-timeline: view(block);
  animation-range: entry 0% cover 30%;
}
```

`view-entry` keyframes go from `opacity: 0; transform: translateY(8px);` to `opacity: 1; transform: translateY(0);`.

Test: structural — class is applied; animation declaration is present. Visual verification via the `verify` skill.

### Chunk 6 — Reduced-motion + cross-browser audit

Single pass:
- All four behaviors gracefully degrade in Firefox (no animation, initial state).
- All four respect `prefers-reduced-motion: reduce` (animation: none, initial state).
- Verify on iOS Safari 26 sim that the splash-decay doesn't fight Safari's scroll bounce.
- Verify on a long-scroll page (`/lol/$accountSlug/matches` with many rows) that the per-element `view()` entries don't accumulate jank.

---

## Files in scope

New:
- `apps/web/src/styles/motion.css`
- `apps/web/src/components/scroll-progress.tsx` + test

Modified:
- `apps/web/src/main.tsx` (import motion.css)
- `apps/web/src/components/nav.tsx` (consume `--nav-collapse`)
- `apps/web/src/lol/_shared/assets/splash-backdrop.tsx` (consume `--splash-opacity`)
- `apps/web/src/lol/matches/match-list.tsx`
- `apps/web/src/lol/champions/champion-table.tsx`
- `apps/web/src/components/bento/*` (per-tile class addition)
- Root layout to mount `<ScrollProgress />`

---

## Risks / open questions

- **`<main>` scroll-container identification.** The motion.css `scroll-timeline-name` must apply to the actual scroll container. Read the current root layout at pickup time — it's likely `<main>` directly, but might be a wrapper.
- **`@property` syntax compat.** Need `@property` for any custom prop that is animated. Confirm Tailwind v4 doesn't strip these from the global stylesheet during build.
- **Interaction with `layoutId` morphs.** The route transition fade in `__root.tsx` may briefly conflict with a scroll-driven nav-compact mid-morph (snapshot frozen while VT runs). Test: scroll then click a match — does the nav un-compact + re-compact in a jarring way? Likely fine because VT freezes the snapshot, not the live element.
- **Recharts tooltips inside scrolled-into-view tiles.** A chart that scrolls in and immediately has its tooltip hovered may show a flash of the un-scrolled-in animation. Edge case; probably ignorable.

---

## Reduced motion

Per [reduced-motion-replacements.md](reduced-motion-replacements.md):

- **Nav compaction**: replace with the *compacted state always*. Better information density anyway for reduced-motion users on smaller viewports.
- **Section progress indicator**: leave the bar at 100% width with reduced opacity — it becomes a static accent underline.
- **`view()` entries**: replace with `opacity: 1; transform: none` (just don't animate in).

(Splash opacity decay reduced-motion replacement was dropped along with the feature — splash now uses its baseline pre-arc opacity unconditionally.)

---

## Post-ship refinements (2026-05-26)

After the initial six chunks landed, an iteration pass produced these changes:

### Splash decay reverted

Initial implementation wrapped `ChampionSplashLayer` in a `.splash-scroll-scrim` div with `opacity: var(--splash-opacity)` decaying from `0.28` → `0.08` across the first 320px of scroll. Two problems surfaced once it shipped:

1. The endpoint at `0.08` made the data-reading region feel **dull** — the splash effectively disappeared, killing the per-champion identity signal.
2. Tuning the endpoint upward (`0.16`) helped the dullness, but the wrapper introduced an opacity multiplier on top of the inner image's existing `opacity: 0.2` / `filter: brightness(0.7)` baseline — the splash was never going to read the same as pre-arc no matter how we tuned it.
3. Removing the wrapper entirely surfaced the existing Ken Burns drift loop (which had always been there but was masked by the previously-lower visible opacity), and the slow scale 1 → 1.13 + ±3% drift was more noticeable than expected against 1080p splash art.

Resolution: revert the splash decay entirely. The `--splash-opacity` `@property`, `splash-decay` keyframes, `.splash-scroll-scrim` rule, `@supports` declaration, and reduced-motion replacement were all removed. The inner image's `animate={{ opacity: imgReady ? 0.2 : 0 }}` is back to its pre-arc value (had drifted to `1.0` during the experiment). Ken Burns retained — it was always part of pre-arc behavior, and once the visible opacity returned to `0.2` the motion reads as ambience rather than passive resizing.

### `--theme-color` cascade lifted into `SplashProvider`

Originally `useThemeColor` was called per-route (champion detail, match detail). Now `SplashProvider` calls it from the active backdrop champion, so the accent cascade follows the splash automatically — account overview, champion detail, match detail, and any future LoL surface that claims the splash all light up without per-route wiring. Removed the explicit `useThemeColor` calls and `championTheme` imports from `$championKey.tsx` and `$matchId.tsx`.

### ScrollProgress relocated outside `<main>`

Initial placement: inside `<main>` with `position: sticky; top: 0`. Two problems:

1. `<main>` has `scrollbar-gutter: stable both-edges` (~10px reserved on each side to prevent content shift). Any element inside `<main>` is constrained to the content area; the bar sat inset on both sides. Negative margins (`-mx-4`) shifted the bar's box but not its rendered `width: var(--progress-width)` resolution, so the bar still rendered at content-width regardless.
2. Anonymous `animation-timeline: scroll()` (which I'd used to avoid `timeline-scope`) worked in Chrome/Safari but the gutter constraint forced a re-architecture anyway.

Resolution: ScrollProgress is now a sibling of `<main>`, mounted between `#section-header-slot` and `<main>` in [__root.tsx](../../../apps/web/src/routes/__root.tsx). It gets the full viewport width naturally. Switched back to the named `--main-scroll` timeline (timeline-scope on `<body>` reaches it across the subtree). 2px inline-margin (`mx-0.5`) tucks the bar a hair inside the viewport edges so it doesn't overlap window chrome.

### Firefox JS fallback for the progress bar

Firefox stable still has `layout.css.scroll-driven-animations.enabled` flagged off as of 2026-05. `CSS.supports("animation-timeline: scroll()")` returns false → the `@supports` block doesn't apply → `--progress-width` stays at its initial `0%` → bar invisible. Added a feature-detected JS fallback in [scroll-progress.tsx](../../../apps/web/src/components/scroll-progress.tsx): when CSS support is missing, attach a `requestAnimationFrame`-throttled scroll listener to `mainScrollRef` that writes `--progress-width` directly. Chrome/Safari early-return and stay on the pure-CSS path. The fallback is scoped to the progress bar only — nav compaction stays at its uncompacted initial state on Firefox stable (decoration tier, acceptable).
