# R-13 beat exit-dissolve — three lanes & spike plans

Sub-note of [self-portrait-recap-arc.md](./self-portrait-recap-arc.md) R-13. Captures the research, the diagnosed root cause of the prior thrashing arc, and three concrete lanes for the next attempt with a recommendation.

## Status

- 2026-06-02 — thrashing arc (8 commits chasing an in-place dissolve via JS counter-translate) reverted via `4d4b83cc`. `chapter-beat.tsx` byte-for-byte identical to b9a97b23 state. No exit animation currently — beats just scroll up with the snap.
- 2026-06-04 — research landed (this note). Recommendation: **Lane 2 (Motion `useScroll` with `target` + `offset`)**.
- Pending: spike commit per recommendation, then evaluate.

## Effect we're chasing

When a beat scroll-snaps out (upward as the next beat snaps in), its content should **dissolve in place** — fade out + small scale/blur — rather than rigidly translating with the scroll. The snap animation is the timeline; the content's opacity should track the snap's scroll progress on the compositor thread.

## Why the previous arc failed

Every JS-polled approach we tried (`scroll` listener, `useMotionValueEvent` reading `getBoundingClientRect`, `useScroll({ container })` reading whole-container progress) was reading **layout values on the main thread** while the browser's smooth-scroll snap was running on the **compositor thread**. The two desynchronise during the snap animation.

Diagnostic data from the owner during the failed arc was the smoking gun: `transform: translateY(722.5px)` appearing only **after** content was already gone. The main-thread JS observed the snap as a single frame jump rather than the smooth interpolation the compositor was actually performing.

**The lesson:** read scroll progress on the same thread that drives the snap — i.e. via `ScrollTimeline` / `animation-timeline` — never via `getBoundingClientRect`. The current scroll-snap config (`scroll-snap-type: y mandatory` on `<main>`, `scroll-snap-stop: always` on each beat) is the right substrate; the snap interpolation drives the timeline for free.

## Browser support reality (June 2026)

| Engine | `animation-timeline: view()` | `ScrollTimeline` JS API |
|---|---|---|
| Chrome / Edge 115+ | ✓ since 2023 | ✓ |
| Safari 26+ | ✓ since Sept 2025 | ✓ |
| Firefox | ✗ behind `layout.css.scroll-driven-animations.enabled` flag | ✗ |

Owner uses Firefox primarily for dev. Any Chromium/Safari-only solution leaves the daily review browser without the effect.

## Lane 1 — Pure CSS `animation-timeline: view()`

**Mechanism.** Add a CSS animation to the beat's content wrapper that fades during the `exit` range of the beat.

```css
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    [data-beat-content] {
      animation: beat-exit-dissolve linear both;
      animation-timeline: view(block);
      animation-range: exit 0% exit 80%;
      animation-duration: 1ms;  /* Firefox flagged path requires non-zero */
    }
  }
}
@keyframes beat-exit-dissolve {
  from { opacity: 1; filter: blur(0); transform: scale(1); }
  to   { opacity: 0; filter: blur(6px); transform: scale(0.985); }
}
```

**Spike steps.**
1. Add the `@supports` block to a recap-scoped stylesheet (Tailwind arbitrary layer or `apps/web/src/home/recap/exit-dissolve.css`).
2. Wrap each beat's body in a `data-beat-content` div inside `ChapterBeat`.
3. Verify in Chrome DevTools that the animation runs on the compositor (Animations panel, no main-thread bars during snap).
4. Verify Safari snap traversal matches Chromium (snap may differ subtly per engine).
5. Confirm `prefers-reduced-motion: reduce` skips the animation entirely.

**Trade-offs.**
- ✓ Truly compositor-thread, frame-perfect, zero JS overhead.
- ✓ ~15 lines of CSS, no React/Motion plumbing.
- ✓ Co-exists cleanly with `scroll-snap-stop: always`.
- ✗ **Firefox sees nothing** — beats snap without dissolve.
- ✗ No per-beat curve control without per-beat animation names.

## Lane 2 — Motion `useScroll` with `target` + `offset` ⭐

**Critical finding.** Motion v12 (`motion@^12.38.0`, already installed) `useScroll` **auto-selects native `ScrollTimeline` where available** and **falls back to rAF-polled JS on Firefox** — single code path, engine-aware perf. Per [Motion docs](https://motion.dev/docs/react-scroll-animations): *"Motion is the only animation library that runs scroll-linked animations on the browser's native `ScrollTimeline` where possible."* The compositor path activates when the motion value is wired to `opacity` directly, or through `useTransform` to `transform` / `filter` / `clipPath`.

This is the primitive the previous arc almost-but-not-quite used. The earlier `useScroll({ container })` call read **whole-container progress** and then computed per-beat progress via `getBoundingClientRect` deltas — back to the stale-layout path. The correct primitive is `useScroll({ container, target, offset })` which reads scroll position only and never touches `getBoundingClientRect` after layout settles.

```tsx
// In ChapterBeat
const ref = useRef<HTMLElement | null>(null);
const { scrollYProgress } = useScroll({
  container: mainScrollRef as RefObject<HTMLElement>,
  target: ref,
  offset: ["start start", "end start"],
  // 0 when beat sits at top; 1 when beat fully past top
});
const opacity = useTransform(scrollYProgress, [0.6, 1], [1, 0]);
const blur    = useTransform(scrollYProgress, [0.6, 1], ["blur(0px)", "blur(6px)"]);
const scale   = useTransform(scrollYProgress, [0.6, 1], [1, 0.985]);

return (
  <m.section
    ref={ref}
    style={{ opacity, filter: blur, scale }}
    /* existing snap classes */
  >…</m.section>
);
```

**Spike steps.**
1. Wire `useScroll` into `ChapterBeat` (or a focused `<BeatExitDissolve>` wrapper that takes `children`).
2. Confirm Motion picks `ScrollTimeline` in Chrome — Performance panel should show no rAF callbacks during snap, Animations panel should show the timeline.
3. Verify Firefox JS fallback. Polling reads `scrollTop` (not `rect.top`), so the value is correct even on the JS path because the snap interpolation runs on Firefox's compositor and writes the interpolated `scrollTop` back to JS observables.
4. Honor `useReducedMotion` — pass-through styles (no transforms).
5. Test Safari — ScrollTimeline works there; snap matches Chromium.
6. Verify entrance `<ChapterReveal>` doesn't fight exit. Entrance writes `transform` / `opacity` inline on an inner `m.div`; exit `m.section` owns the parent. They should compose, but verify mid-cascade.
7. Add tests around the `BeatExitDissolve` wrapper following the patterns in `chapter-reveal.test.tsx`.

**Trade-offs.**
- ✓ Single code path, cross-engine.
- ✓ Compositor-thread on Chrome/Safari (ScrollTimeline); JS fallback on Firefox reads `scrollTop` not `rect.top`.
- ✓ Per-beat curves trivial — different transform interpolations per beat.
- ✓ Composable with `useReducedMotion`.
- ✗ Slight Firefox cost — rAF polling during snap. But writes opacity + filter + scale only (all compositor-friendly properties); the writes themselves don't pay main-thread layout.
- ✗ More Motion API surface in `ChapterBeat` → tests need to mock `useScroll`.

## Lane 3 — sticky restructure

**Mechanism.** Make each beat a 2× viewport-tall container with a sticky inner pinned for the first viewport-height, dissolving as the second half scrolls past.

**Spike steps.**
1. Refactor `ChapterBeat` to render `<section style={{ height: "200dvh" }}><div className="sticky top-0 h-dvh">…</div></section>`.
2. Drop `scroll-snap-stop: always` — sticky + mandatory snap interact poorly (snap caps at section start, sticky never enters the unpin region).
3. Re-implement snap at a different granularity (snap to the **next** beat's entrance, not the current beat's start).
4. Add exit animation via Lane 1 or 2 scoped to the sticky child.

**Trade-offs.**
- ✓ Genuinely gives a pin-then-release gesture distinct from snap.
- ✗ **Loses the carousel-page snap feel** shipped in commit `844b0739` ("native scroll-snap for chapter traversal in both directions").
- ✗ Big surgery — `ChapterBeat`, all chapter consumers, `useChapterNudge`, tests, scroll-restore.
- ✗ Sticky + mandatory snap interaction is historically browser-buggy (Safari especially).
- ✗ Touches the scroll-restore + nav-transition fragility documented in [safari-vt-snapshot-cost.md](./safari-vt-snapshot-cost.md).

## Library dependency assessment

**No new dependency needed.** We already have:
- `motion@^12.38.0` — `useScroll` with ScrollTimeline auto-selection
- Native CSS scroll-driven in Chrome/Safari for Lane 1

**Considered and rejected:**
- **Lenis** — KB `03-motion.md` §3 explicitly warns *"never as a substitute for `animation-timeline`."* We don't have a stiff-scroll problem; we have a thread-mismatch problem. Lenis would hijack native scroll, defeat the compositor path, and force scroll-jacking the owner would have to live with.
- **GSAP ScrollTrigger** — KB calls it out *"when you need scroll-driven animation with declarative pinning, scrubbing, snapping, *and* you must support browsers without scroll-driven CSS animations."* We need only the first half; Motion's `useScroll` covers Firefox via JS fallback. No need to add GSAP.

## Recommendation: Lane 2

**Why over Lane 1.** Owner uses Firefox primarily for review; Lane 1 leaves Firefox without the effect. Motion's auto-fallback gives compositor on Chrome/Safari *and* a working JS path on Firefox in one surface.

**Why over Lane 3.** Lane 3 trades away the carousel-snap feel we explicitly shipped in `844b0739`, and sticky+snap adds risk. The pin-then-release gesture isn't what we're after — we want the snap-out to be expressive, not the pin pattern.

**Why this isn't a hybrid Lane 1.5.** We could ship Lane 1 as a CSS progressive enhancement that gracefully no-ops on Firefox (no rAF cost on the primary browser, no extra JS bytes). Defensible if "Firefox sees no exit effect" is acceptable. Read: it isn't, because the page is meant to feel alive in the browser the owner reviews in, and Lane 2's cost is small (3 motion values, ~30 lines of code, all compositor-friendly writes).

**Fallback path.** If Firefox cost turns out to be visible after measuring (unlikely — opacity + transform + filter are all compositor-promoted), gate Lane 2 on `!isFirefox()` and ship Lane 1 to Chromium/Safari + nothing to Firefox. This composes with the engine-gate convention in [repo-conventions.md](../repo-conventions.md#gate-engine-specific-perf-cliffs-instead-of-chasing-css-parity).

## Spike commit checklist (Lane 2)

1. Add `useScroll` + transforms to `ChapterBeat` behind a `useReducedMotion()` guard (pass-through when reduced).
2. Cast `mainScrollRef` per the existing pattern in `atmosphere-layer.tsx` (`as unknown as React.RefObject<HTMLElement>` — Motion handles the null `.current` case at runtime).
3. Tests: extend `chapter-beat.test.tsx` to verify (a) opacity inline style is set on mount, (b) reduced-motion renders identity styles, (c) entrance `ChapterReveal` still mounts unaffected.
4. Verify in three browsers:
   - **Chrome** — Performance panel shows no rAF during snap; Animations panel lists the ScrollTimeline.
   - **Safari** — Snap interpolation drives the same path; no visible jank.
   - **Firefox** — rAF callbacks present (expected), per-frame cost ≤1 ms in Performance.
5. Validate `verify:cc` green before commit.

## Sources

- [Motion: useScroll](https://motion.dev/docs/react-use-scroll)
- [Motion: React scroll animations](https://motion.dev/docs/react-scroll-animations)
- [MDN: Scroll-driven animation timelines](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations/Timelines)
- [MDN: animation-timeline property](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline)
- [Codrops: A Practical Introduction to Scroll-Driven Animations with view()](https://tympanus.net/codrops/2024/01/17/a-practical-introduction-to-scroll-driven-animations-with-css-scroll-and-view/)
- [utilitybend: Scroll-driven animations + scroll-snap](https://utilitybend.com/blog/scroll-driven-animations-in-css-are-a-joy-to-play-around-with/)
- KB `~/.claude/knowledge/frontend-2026/03-motion.md` §4 (scroll-driven), §3 (Lenis & GSAP positioning)
- KB `~/.claude/knowledge/frontend-2026/01-css-and-styling.md` §scroll-driven row (engine support table)
