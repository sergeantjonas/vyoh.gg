# Scroll-driven shell behaviors

**Status:** Shipped 2026-05-26. All six chunks landed: motion.css with scroll-timeline + @property, nav compaction (--nav-collapse), splash opacity decay (.splash-scroll-scrim), section progress hairline (ScrollProgress), view-entry on BentoTile + CardShell. Firefox degrades gracefully (animation absent, initial state). prefers-reduced-motion: replace strategy in motion.css.

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

Firefox falls back to **no animation** — the styled state is the initial keyframe. Acceptable because all four target behaviors are decoration: the nav still works, the splash still shows, content still scrolls.

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
- **Splash opacity decay**: replace with a single static value at the midpoint (`0.18`). Calmer than animating.
- **Section progress indicator**: leave the bar at 100% width with reduced opacity — it becomes a static accent underline.
- **`view()` entries**: replace with `opacity: 1; transform: none` (just don't animate in).
