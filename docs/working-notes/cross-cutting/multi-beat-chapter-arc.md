# Multi-beat chapter architecture & choreography arc

Architecture + design plan for the multi-beat chapter experience. Replaces the shipped sticky-stage cross-fade (`0740849d`, 2026-06-05) which read as mushy and unread-able. Sub-note of [self-portrait-recap-arc.md](./self-portrait-recap-arc.md). Sibling of [r13-exit-dissolve.md](./r13-exit-dissolve.md) and [subject-chapter-design-spec.md](./subject-chapter-design-spec.md).

**History of this note's recommendation:**
- v1 (2026-06-05 morning) pitched a horizontal-scroll carrier — rejected mid-discussion as "not the leverage; choreography is."
- v2 (2026-06-05 afternoon) pitched sticky masthead + flat snap-stop beats + IO+animate per beat — researched extensively, then *also* abandoned at implementation time when owner pointed out that prior multi-beat iterations had already tried that exact pattern (`b3711bcb` era) and it kept being walked back.
- v3 (this note, 2026-06-06) describes what **actually shipped** in chunk 2: horizontal-track scroll-driven pin with dwell-and-transition mapping. The owner's original horizontal-track instinct was the right call; v2's snap-based pitch was wrong.

## Status

- **Shipped.** Multi-beat chapter experience fully landed in [apps/web/src/home/recap/](../../../apps/web/src/home/recap/) as first-class primitives — `multi-beat.tsx`, `chapter-multi-beat.tsx`, `ahri-chapter.tsx`, `steam-chapter.tsx`, `steam-chapter-closer-media.tsx`, `lol-moment-beat.tsx`, `steam-moment-beat.tsx`, `editorial-chrome.tsx`, plus the per-beat hooks (`use-beat-progress`, `use-chapter-nudge`, `use-asset-claim`, etc.). No `?layout=multi-beat` flag remaining; legacy `<ChapterGroup>`/`<ChapterBeat>` deleted.
- The shipped model is not identical to the v2/v3 pitches below — chunks 3+ converged on a different choreography than this note's recommendation section describes. Treat the choreography toolkit as a vocabulary reference, not as the live blueprint.
- This file is historical. The current design language is in [subject-chapter-design-spec.md](./subject-chapter-design-spec.md); the post-mortem of the exit-dissolve sub-arc is in [r13-exit-dissolve.md](./r13-exit-dissolve.md).

## The symptoms this arc is solving

Owner-reported on the shipped `0740849d` state (2026-06-05):

| Symptom | Root cause |
|---|---|
| Fading doesn't land | Cross-fade overlap window = two beats partially visible, no clear transition moment |
| Content hard to read | Reading text mid-cross-fade at 50% opacity is genuinely hard |
| Stuck in intermediate states | No per-beat snap force = scroll can rest anywhere |
| User can skip content | No `scroll-snap-stop: always` between beats = fast wheel skips multiple beats |
| Doesn't land visually | Cross-fade isn't a transition users have a mental model for |
| Scroll multiple times without anything happening | Tall outer section + subtle opacity change = lots of scroll distance for little response |

These are *structural*, not polish. Recovering by tuning the cross-fade curves doesn't fix them; the medium has to change.

## Recommended architecture (what shipped in chunk 2)

```tsx
// Outer section provides the scroll runway
<section
  data-chapter-multi-beat
  style={{
    height: `calc(${beatCount * SCROLL_RUNWAY_MULTIPLIER} * var(--main-h, 100dvh))`,
    width: "100vw",
    marginLeft: "calc(50% - 50vw)",  // full-bleed escape from max-w-4xl recap wrapper
  }}
>
  {/* Sticky stage pins for the chapter's vertical scroll length */}
  <div
    data-chapter-stage
    className="sticky top-0 flex w-full flex-col overflow-hidden"
    style={{ height: "var(--main-h, 100dvh)" }}
  >
    {/* Masthead sized to its content via flex-col + shrink-0 */}
    <header data-chapter-masthead className="relative z-20 w-full shrink-0 overflow-hidden">
      <div className="mx-auto h-full w-full max-w-4xl">{identity}</div>
    </header>

    {/* Horizontal track translated by useScroll-driven `x` */}
    <motion.div
      data-chapter-track
      className="flex min-h-0 flex-1 flex-row will-change-transform"
      style={{ x, width: `${beatCount * 100}%` }}
    >
      {children}  {/* each <MultiBeat> sets style={{ width: `${100 / beatCount}%` }} */}
    </motion.div>
  </div>
</section>
```

**Per-beat structure** (`<MultiBeat>`):
- `w-full h-full shrink-0` flex item inside the track, content-sized inner div with consumer's `BEAT_LAYOUT` className applied.
- `useInView` with `root: mainScrollRef`, `amount: 0.5` flips `nudged` true when the beat is the visible one. Drives child `<ChapterReveal>` cascades.

### Five load-bearing structural moves

1. **`SCROLL_RUNWAY_MULTIPLIER` × `--main-h`** sizes section and stage. Sized to **`--main-h` (main's actual clientHeight, not dvh)** because `<main>` is shorter than the window — the page-level nav above main eats ~50px. Using dvh made the sticky stage taller than the visible scroll area, so sticky released before `useScroll` progress reached 1, which caused "chapter slides up mid-beat 2."
2. **Stage uses `flex flex-col` with masthead `shrink-0` and track `flex-1 min-h-0`** so the masthead sizes to its content and the track fills the rest. A fixed `mastheadHeight` prop reserved too much space when the title card was shorter (visible gap between masthead bottom and beat content top). `min-h-0` is required on the flex-1 track for Firefox flex resolution.
3. **Track has explicit `width: beatCount × 100%`** so the percentage translate maps to actual beat advances. Without this, the track inherits parent width (one stage-width) and `-75%` translates by 75% of one beat, not 3 beats. Each `<MultiBeat>` then takes `width: 100/beatCount%` — 1/N of the explicit track = exactly one stage width.
4. **Full-bleed escape with `marginLeft: calc(50% - 50vw); width: 100vw`** breaks the section out of the recap wrapper's `max-w-4xl` constraint. Beats slide across the full viewport on larger screens. Content inside each beat is re-centered with a `max-w-4xl mx-auto` reading-column wrapper (avoiding content-leans-left at 1920+ viewports). `[overflow-x: clip]` on `<main>` (set in __root.tsx) prevents the escape from producing a horizontal page scrollbar.
5. **`overflow-hidden` on the masthead `<header>`** clips title-card content that would otherwise bleed below the masthead box into the beat track area. Title-card content uses vh-relative units that don't fit a static box at all viewport sizes; clipping prevents the overlap visually.

### Scroll mechanics — the four tuning dials

The horizontal motion is driven by Motion's `useScroll({ target: sectionRef, container: mainScrollRef, offset: ["start start", "end end"] })`, mapped via a piecewise `useTransform`. Four constants in [chapter-multi-beat.tsx](../../apps/web/src/home/recap/chapter-multi-beat.tsx) tune the feel:

| Constant | Current | What it tunes |
|---|---|---|
| `SCROLL_RUNWAY_MULTIPLIER` | 2.3 | Total chapter scroll length. Higher = chapter takes more scroll, motion is gentler per scroll unit. |
| `DWELL_UNITS` | 2 | How long middle beats hold their position, in relative units. |
| `EDGE_DWELL_UNITS` | 3 | How long first and last beats hold, in relative units. Higher than middles so the chapter eases in and lingers at the end. |
| `TRANSITION_UNITS` | 4 | How long the motion between two beats takes, in relative units. |

For N=4 beats: total = 2×3 + 2×2 + 3×4 = 22 units. Outer beats hold for 3/22 ≈ 14% of chapter scroll, middle beats for 2/22 ≈ 9%, each transition takes 4/22 ≈ 18%. Vert:horiz ratio ≈ 0.9 (gentle).

Tuning rules of thumb:
- Motion feels too fast → bump `SCROLL_RUNWAY_MULTIPLIER`.
- Mouse scroll feels tedious → drop `SCROLL_RUNWAY_MULTIPLIER` (trades trackpad-skip resistance for tick efficiency).
- Beat doesn't get enough reading time → bump that beat's dwell units (currently global; see "Future: per-beat dwell" below).
- Transition feels zippy → bump `TRANSITION_UNITS` relative to dwells.

### Cross-browser engagement decisions

| Decision | Why |
|---|---|
| **No CSS scroll-snap anywhere** | We tried `scroll-snap-type: y mandatory` on `<main>` with snap-stop:always on beats. Firefox "vibrated" between candidate targets; Chrome had subtle composition bugs. The R-13 snap-compositor finding bites any architecture that mixes per-element translates with native snap on the same axis. |
| **No programmatic snap on `scrollend`** | We tried this too. Even with `scrollend` (vs debounced `scroll`), the snap animation fought continuous Mac trackpad scrolling — `scrollTop` writes during animation competed with user input. The user's scroll input would tug back against our `animate()`. Removed entirely; replaced with dwell-and-transition mapping (which provides natural "magnetic" resting positions without any animation). |
| **Linear-with-dwells `useTransform` mapping** | Each beat dwells for some scroll units (track stays still), then transitions move it to the next beat. Natural rest in dwell zones = beat centered. No snap fighting. Trade-off: total motion is in less scroll, so transitions are slightly amplified vs pure linear. Adjusted by tuning unit ratios. |
| **Motion `useScroll` over GSAP / Lenis** | Motion v12 `useScroll` auto-selects native `ScrollTimeline` on Chrome 115+/Safari 26+ (compositor-thread, zero JS per frame), rAF fallback on Firefox. One code path, all engines. Lenis would hijack native scroll and break the entire scroll-position-drives-translate pattern. GSAP ScrollTrigger doesn't add anything over what `useScroll` already does for this pattern. |

## Architectural pivots within chunk 2 (audit trail)

The substrate iterated extensively this session. Each pivot was driven by a specific failure mode:

| Commit | Direction | Why it changed |
|---|---|---|
| `bbe13728` | Original snap-based design (sticky masthead + flat snap-stop beats + IO+animate) | First implementation per v2 of this note. |
| `91846fcb` | Added `scroll-snap-type: y proximity` on main | Discovered the snap classes were inert — scroll-snap-stop:always does nothing without snap-type set. |
| `29cca7d9` | Switched proximity → mandatory | Firefox vibrating between proximity candidates. |
| `9e59e359` | **Reshaped around horizontal track + Motion useScroll** | Owner pushed back: "carets handle navigation, Motion has this pattern built in." Snap pattern abandoned. |
| `66345daf` | Explicit track height (not flex-1) | Firefox flex circular resolution made beats 0-height invisible. |
| `5f0bc03b` | `overflow-hidden` on masthead | Title card content was bleeding below masthead height and covering beats. |
| `1a9aeea7` | Beats `w-full` of explicit-width track (not `w-screen`) | Viewport-width beats overflowed the stage at viewports > recap's max-w-4xl. |
| `820a8962` | Section + stage sized to `--main-h` (not `dvh`) | Sticky released mid-beat 2 because stage was taller than main's clientHeight. |
| `d4742bc5` | Explicit track width `beatCount × 100%` | `-75%` translate was moving 75% of stage-width (≈one beat), not 3 beats. |
| `d5bbbcc2` | Masthead sized to content via flex-col, band paddings overridden in BEAT_LAYOUT | Fixed mastheadHeight reserved too much space; band default `pt-12` added an extra 48px gap. |
| `322e9cb1` | Centered content in max-w-4xl reading column inside full-bleed beats | Beats viewport-wide → text leaned to left edge with backdrop dominating right side. |
| `9c47ce44` | Added programmatic snap-to-dwell on scrollend | Trackpad flicks ended mid-transition with two beats half-visible. |
| `2942178d` | **Removed programmatic snap** | Snap fought continuous scroll on Mac trackpad. User explicitly: "this is causing it to fight the scrolling motion." |
| `d8d8dc94` → `1f22024f` → `ad5b4249` | Iterated dwell-and-transition mapping ratios | First version had ~3× amplified transitions ("REALLY fast"); converged on 1:3 dwell:transition with end dwells, then dialed in. |
| `c37b1de8` | Middle beats bumped to 2 units, edge beats to 3, transitions to 4 | Middle beats felt too short relative to edges (the difference was 2× by design but owner perceived it as "rushed" content). |

The arc here is informative: **the snap-based architecture I researched and recommended in v2 of this note was wrong.** It re-hit the exact problems that drove every prior multi-beat iteration back to the drawing board. The horizontal-track design — which I initially pitched, was rejected, then revived by the owner — was actually the right answer. Future sessions reading this: trust the structural decisions in the "five load-bearing moves" above, and don't re-litigate them with another snap-based attempt.

## Choreography is the showcase (the load-bearing layer)

The architecture is invisible plumbing. The reason previous iterations felt boring isn't structural — it's that every beat used uniform motion. The choreography toolkit below has to be applied *with intent per beat*, not stamped from a template.

**Standing rule:** all four Steam beats are individually art-directed. None of them is allowed to be "fade in from below." If two beats end up looking like the same template with different content, the design hasn't landed.

### Toolkit (named primitives, mix-and-match per beat)

1. **Layered parallax stack** (≥3 layers per beat). Background art (subject splash or hero), midground accent shape (geometric form in subject color), foreground copy. Each enters from a different vector with different timing and easing.
2. **Subject-as-camera-dolly.** The subject (champion splash, Steam hero capsule, achievement icon) *moves* during the beat — pan, scale, rotate slightly, parallax-shift on mouse. Apple AirPods move.
3. **Typographic kinetics.** Numbers split into digits and tumble in. Headlines split by character/word and stagger. Pull-quotes the size of the beat. Editorial scale.
4. **Mask reveals.** Content emerges from behind a moving mask — sweeping geometric shape, the subject's silhouette, an SVG path. Tactile and confident.
5. **Per-beat dwell weight (future, not yet implemented).** Each beat takes the same scroll time today regardless of content density. Heavy beats (verdict prose) and light beats (peak chips) get equal scroll. Owner perceives middle beats as rushed for that reason. A `dwellWeight` prop on `<MultiBeat>` summing into the track's piecewise mapping would let each beat opt into more or less scroll proportional to content. See "Future work" below.
6. **Ambient loops as signature.** Each beat has one continuous low-amplitude loop. Prevents "frozen between snaps" deadness.
7. **Hard cuts with transition stings.** Brief transition element fires on dwell-land — chromatic split, sweeping accent line, glitch flash for moment-chapters.
8. **Atmosphere pulse.** Existing atmosphere system (tint hue, intensity) shifts per beat. Already wired; can be more aggressive.
9. **Editorial chrome.** "Beat 02 / 04" page marker, chapter symbol, small subject byline. Persistent magazine-spread chrome.
10. **Masthead is alive too.** Don't just pin a static logo. Eyebrow text counts chapter progress, accent line stretches as the chapter loads, color tint picks up the active beat's accent.

### How the toolkit gets used

Each beat picks 4-6 primitives, deliberately. Per-beat choreography intent is design work and gets decided when the beat is being designed (with owner taste input), not pre-specified in this note.

## Scope

- **Steam chapter** (`apps/web/src/home/recap/steam-chapter.tsx`) — only multi-beat chapter currently. Substrate migrated; choreography pending (chunk 3).
- **Ahri chapter** (`apps/web/src/home/recap/ahri-chapter.tsx`) — currently single-pin via `ChapterContainer`. Ahri-multi-beat chunk is on pause until owner is confident in the new substrate. Now unblocked structurally; pending owner go-ahead.
- **Moment chapters** (`lol-moment-chapter.tsx`, `steam-moment-chapter.tsx`) — single-pin, not affected by this arc.
- **`<ChapterContainer>`** (single-pin model) — remains in tree for Ahri/moment chapters; do not delete.

## Cross-engine risk register (updated post-implementation)

1. **Firefox flex resolution with `h-full` children + `flex-1` parent** — fixed by giving the track explicit height (`commit 66345daf`). Don't reintroduce `flex-1` with `h-full` children inside.
2. **`<main>` height ≠ window height** — there's a top nav strip. Sticky math uses `--main-h` (set in [__root.tsx:77](../../apps/web/src/routes/__root.tsx#L77) on `<main>` via JS as `main.clientHeight` in px). Anything sized in `dvh` for sticky-stage purposes will desynchronize from `useScroll`'s progress mapping. Fixed in `820a8962`.
3. **Masthead overflow** — title card content using vh-relative units doesn't always fit a static height box. `overflow-hidden` on the `<header>` is load-bearing; without it, content bleeds over beats. Fixed in `5f0bc03b`.
4. **Track width inheritance** — flex containers don't auto-size to overflowing content width. The track must have explicit `width: beatCount × 100%` for percentage translates to map to beat advances. Fixed in `d4742bc5`.
5. **Beat width = stage width** — at viewports > 848px (recap wrapper's max-w-4xl), a beat using `w-screen` overflows the stage, breaking the percent-translate math. Beats must use `w-full` of the explicit-width track. Fixed in `1a9aeea7`.
6. **Native CSS scroll-snap doesn't survive cross-engine** — Firefox vibrates, Chrome composition bugs, snap-stop:always inert without snap-type. Architecture went snap-free entirely.
7. **Programmatic snap fights continuous scroll** — `animate(scrollTop, ...)` writes compete with user input on Mac trackpad. No programmatic snap. Architecture uses dwell-and-transition mapping for natural rest positions instead.

## A11y & reduced-motion

Settled answers from [W3C WAI-ARIA APG Carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/):

- Chapter `<section>`: `aria-roledescription="carousel"` + `aria-label="<chapter name>"` (no explicit `role="region"` — `<section>` with aria-label has implicit region role).
- Each `<div data-beat>`: `role="group"` + `aria-roledescription="slide"` + `aria-label="Beat N of M"`.
- **Do not bind arrow keys** to step beats. APG reserves arrows for native scroll.

`prefers-reduced-motion`: collapses to a vertical stack — masthead in flow, beats below, no transforms, no pinning. Same content, no motion. Already implemented in `<ChapterMultiBeat>`/`<MultiBeat>`.

## Library decision (confirmed)

**Motion sufficient. No GSAP. No Lenis.**

- Motion v12 `useScroll` auto-selects native `ScrollTimeline` on Chrome 115+/Safari 26+, rAF fallback on Firefox.
- `useInView` provides `root: mainScrollRef` option so per-beat nudge fires against `<main>`'s viewport.
- GSAP ScrollTrigger: doesn't add anything over `useScroll` for this pattern.
- Lenis: would hijack native scroll and break scroll-position-drives-translate.
- Programmatic snap (any source): rejected because it fights user input.

## Future work

These are documented in priority order; none blocks chunk 3.

1. **Count-up repositioning on beat 3 (peak chips)** — owner reported "does some odd repositioning because of the countup animation"; investigation deferred but probe script exists at [scripts/probe-countup-shift.mjs](../../scripts/probe-countup-shift.mjs).
2. **Chunk 3: art-direct each Steam beat** against the choreography toolkit. The actual visual-impressiveness work.
3. **Per-beat `dwellWeight` prop** to let editorial judgment set how much chapter scroll each beat consumes. Light beats (chips, screenshots) explicitly request less, heavy beats (prose) request more. Sum into the track's piecewise mapping in `ChapterMultiBeat`. Concretely: change `<MultiBeat>` to accept `dwellWeight?: number` (default 1), and have `ChapterMultiBeat` walk the children to collect their weights before computing stops.
4. **Migrate Ahri chapter to multi-beat** — substrate is now ready. Run the same migration pattern as Steam (consumer-side change only).
5. **Remove the `?layout=multi-beat` flag** once owner is confident in the new substrate. Delete legacy `<ChapterGroup>`/`<ChapterBeat>`. Single cleanup chunk.

## Diagnostic scripts (committable)

- [scripts/diagnose-multi-beat-flag.mjs](../../scripts/diagnose-multi-beat-flag.mjs) — verifies legacy vs multi-beat layout flag routing.
- [scripts/screenshot-multi-beat.mjs](../../scripts/screenshot-multi-beat.mjs) — screenshots at a single viewport with geometry probe.
- [scripts/screenshot-multi-beat-sizes.mjs](../../scripts/screenshot-multi-beat-sizes.mjs) — screenshots across MacBook viewport sizes (1440, 1728, 1920, 2560) to catch responsive issues.
- [scripts/verify-sticky-runway.mjs](../../scripts/verify-sticky-runway.mjs) — scrolls through the chapter and verifies sticky stage stays pinned through all beats with correct track translates.
- [scripts/probe-gap.mjs](../../scripts/probe-gap.mjs) — measures the rect chain inside a beat to find unexpected padding/margin gaps.
- [scripts/probe-countup-shift.mjs](../../scripts/probe-countup-shift.mjs) — TODO: measures peak-chip layout shift during count-up animation.

## What this note replaces / doesn't

- **Replaces** the assumption baked into `0740849d` (sticky stage + cross-fading beat layers). Beats stop being stacked layers; cross-fade is dropped entirely.
- **Replaces** the v2 recommendation of snap-based architecture. Native CSS scroll-snap and programmatic snap-to-dwell both failed cross-engine or fought user input.
- **Doesn't replace** [r13-exit-dissolve.md](./r13-exit-dissolve.md). That note's snap-compositor finding still applies — *this design just doesn't trigger it* because there's no native snap.
- **Doesn't replace** [subject-chapter-design-spec.md](./subject-chapter-design-spec.md). That spec defines design vocabulary *within* a beat — primitives, animation cascade, hover patterns. This note is about the *carrier between beats*.

## Sources

### Primary docs

- [Motion: `useScroll`](https://motion.dev/docs/use-scroll) — scroll-driven motion values, auto-uses ScrollTimeline where available
- [Motion: `useInView`](https://motion.dev/docs/use-in-view) — IntersectionObserver hook with `root` option
- [Motion: `animate()`](https://motion.dev/docs/animate) — imperative WAAPI-backed animation (we tried using it for snap; doesn't fit this architecture)
- [W3C WAI-ARIA APG Carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) — `role="group"` + `aria-roledescription="slide"` roles

### Local notes (load-bearing)

- [r13-exit-dissolve.md](./r13-exit-dissolve.md) — snap-compositor finding (still relevant as a constraint to avoid)
- [subject-chapter-design-spec.md](./subject-chapter-design-spec.md) — design vocabulary inside a beat
- [self-portrait-recap-arc.md](./self-portrait-recap-arc.md) — parent arc; contains the parked Ahri-multi-beat chunk
- [repo-conventions.md § Gate engine-specific perf cliffs](../repo-conventions.md)

### Local notes (referenced)

- MEMORY `feedback_scroll_driven_on_compositor_thread` — Motion as the right primitive
- MEMORY `feedback_engine_gate_perf_cliffs` — bidirectional engine gate
- MEMORY `project_subject_chapter_design_spec` — R-2 Ahri shipped 2026-06-01 as single-pin

### Reference sites (visual ceiling for choreography intent — chunk 3 work)

- [Apple AirPods Pro product pages](https://www.awwwards.com/inspiration/product-scroll-triggered-animation-apple-airpods-pro) — subject-as-camera-dolly per scene
- [Cyd Stumpel Portfolio 2025](https://www.awwwards.com/sites/cyd-stumpel-portfolio-2025) — Awwwards SOTD; per-beat bespoke choreography
- [Lusion v3](https://www.awwwards.com/inspiration/webgl-scroll-navigation-lusion) — Site of the Year 2024
- [Active Theory V6](https://www.awwwards.com/sites/active-theory-v6) — on-snap entrance shimmer; per-beat character
