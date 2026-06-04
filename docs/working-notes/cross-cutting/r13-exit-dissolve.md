# R-13 beat exit-dissolve — three lanes & spike plans

Sub-note of [self-portrait-recap-arc.md](./self-portrait-recap-arc.md) R-13. Captures the research, the diagnosed root cause of the prior thrashing arc, and three concrete lanes for the next attempt with a recommendation.

## Status

- 2026-06-02 — thrashing arc (8 commits chasing an in-place dissolve via JS counter-translate) reverted via `4d4b83cc`. `chapter-beat.tsx` byte-for-byte identical to b9a97b23 state. No exit animation currently — beats just scroll up with the snap.
- 2026-06-04 — research landed (this note). Recommendation: **Lane 2 (Motion `useScroll` with `target` + `offset`)**.
- 2026-06-04 — Lane 2 attempted, found insufficient. Resolution shipped on **Lane 3 (sticky restructure)**, the lane this note originally rejected. See "Resolution 2026-06-04" section below for the audit trail.

## Resolution v2 2026-06-04 (final)

After shipping the sticky-based scroll-coupled approach below, the architecture was scrapped one more time in favor of the much simpler **IntersectionObserver-triggered Motion `animate()`** pattern. Owner's question that triggered the rethink: *"Is there a reason you are tying the opacity to the actual scrolling position? Why do you not consider just firing an actual animation once we hit a certain threshold?"* — and they were right. For a snap-paginated page-turn UX, scroll-coupling buys nothing visible while costing significant cross-engine complexity.

**Final architecture:**

```tsx
const isInView = useInView(ref, { amount: 0.5, root: mainScrollRef });
useEffect(() => {
  if (reducedMotion) return;
  if (isInView) {
    if (hasBeenInViewRef.current) animate(opacity, 1, ...);  // re-entry
    hasBeenInViewRef.current = true;
  } else if (hasBeenInViewRef.current) {
    animate(opacity, 0, ...);                                // exit
    animate(blur, "blur(8px)", ...);
    animate(scale, 0.985, ...);
  }
}, [isInView, ...]);
```

That's the whole exit-dissolve. No `useScroll`, no `useTransform`, no view-timeline, no CSS animation-timeline, no sticky, no counter-translate, no engine gate, no `containerReady` state, no `WRAPPER_DVH` constant, no `exit-dissolve.css`. Just IntersectionObserver + Motion's WAAPI-backed `animate()`.

**Why this is correct where everything else wasn't:**

- **Scroll-snap untouched.** `scroll-snap-align: start` + `scroll-snap-stop: always` works cleanly — there's nothing competing with the browser's snap algorithm. No transforms during scroll-snap to be optimized-away by Chrome/Safari's compositor; no sticky to flicker; no per-scroll-event JS to lag against Firefox.
- **Cross-engine uniform.** IntersectionObserver and Motion `animate()` are universal. No `@supports`, no JS feature detection, no Firefox-vs-Chrome split.
- **The "in-place" feel is visual, not structural.** With a 400ms fade running concurrent to the browser's ~300ms snap motion, content fades to invisible *during* the snap. The eye perceives it as a page-turn dissolve, not a scroll-off. Trying to literally pin content via sticky or counter-translate was solving a problem that wasn't actually a problem.
- **Reversibility is free.** Motion's `animate()` cancels prior animations on the same value when a new one starts. Scrolling back into a previously-exited beat fires `animate(opacity, 1, ...)` and the value smoothly interpolates back regardless of where the prior animation was in its run.

**Tuning knobs (single number each):**

- `FADE_DURATION` (0.4s) — how long the fade takes
- `FADE_AMOUNT` (0.5) — IO intersection threshold for "in view"; lower fires earlier
- `FADE_EASE` ("easeOut") — curve

**What's archived below in "Resolution v1":** the sticky-based architecture that came one step before this. Kept for the audit trail because the lessons from that attempt (Firefox lies about `CSS.supports("animation-timeline: view()")`, Chrome composites scroll-snap units and ignores per-descendant transforms, sticky+scroll-snap-stop:always interactions) are non-obvious and worth remembering.

## Resolution v1 (archived) 2026-06-04

**Lane 2 (Motion `useScroll` with counter-translate) failed in practice.** Worked on Firefox with minor bouncing (JS path lag against scroll events); on Chrome/Safari the transform was reported by `getComputedStyle` as the expected counter-translate value but had **zero visual effect** — the painted box still moved with the scroll. Diagnosed as a scroll-snap compositor optimization: Chrome/Safari composite the snap-aligned section + its descendants as a single unit during the snap interpolation, ignoring per-descendant transforms. Owner confirmed via direct DevTools inspection (transform value present in styles, element visually scrolling normally).

**Final architecture: sticky-based pinning + scroll-driven CSS animation for the fade.**

```
<section h-[130dvh] snap-align:start snap-stop:always>    ← wrapper / snap unit
  <div position:sticky top:0 h-dvh .beat-exit-dissolve>   ← pinned content
    {body}
  </div>
</section>
```

- **Pinning is `position: sticky`** — universal browser support (Chrome 56+ / Safari 13+ / Firefox 32+), compositor-friendly, can't be optimized away by scroll-snap because it's layout, not transform. The "in place" comes from the browser's native sticky algorithm, not from any JS or transform.
- **Fade is scroll-driven animation** on the sticky inner. CSS `animation-timeline: view()` on Chrome 115+ / Safari 26+ (compositor-thread, zero JS), Motion `useScroll` JS path on Firefox (no counter-translate, so no bouncing — Motion only drives `opacity`/`filter`/`scale` which compose cleanly with the sticky's pin).
- **Snap feel preserved** — wrapper is snap-aligned, so PageDown / wheel-scroll still land on each beat boundary. Beat takes 130dvh of scroll instead of 100dvh; the extra 30dvh is the "scroll runway" during which sticky pins and the dissolve runs.

### Why Lane 3 was wrongly rejected initially

This note's original Lane 3 evaluation dismissed sticky restructure citing:

1. **"Loses the carousel-page snap feel shipped in `844b0739`"** — *wrong assumption*. Snap-align on the **wrapper** preserves the feel; only the scroll runway changes (130dvh vs 100dvh per beat). PageDown still lands on each beat in turn.
2. **"Sticky + mandatory snap interact poorly (Safari especially)"** — *outdated*. That was a pre-2022 Safari bug; current Safari 17+ handles `position: sticky` inside `scroll-snap-type: mandatory` containers cleanly. Carried-forward stale folklore.
3. **"Big surgery — `ChapterBeat`, all chapter consumers, `useChapterNudge`, tests, scroll-restore"** — *true but overstated*. The refactor was contained to `ChapterBeat` + `chapter-beat.test.tsx` + adding `exit-dissolve.css`. Consumers (e.g. `steam-chapter.tsx`) didn't change because `className` now applies to the inner sticky instead of the outer wrapper — same semantic for layout/padding classes.

The deeper mistake in this note: it framed the central problem as "compositor-thread scroll tracking" and built lane analysis around that. The actual central problem was **how to pin content during scroll**. Sticky is the native answer to pinning; compositor-thread tracking is secondary and only matters because Lane 2 picked a non-native pinning mechanism (transform). Once pinning is native, the fade animation has a much smaller risk surface (just opacity/filter, no counter-translate gymnastics).

### Implementation links

- [apps/web/src/home/recap/chapter-beat.tsx](../../apps/web/src/home/recap/chapter-beat.tsx) — sticky-based component
- [apps/web/src/home/recap/exit-dissolve.css](../../apps/web/src/home/recap/exit-dissolve.css) — CSS animation-timeline keyframes + named view-timeline
- [apps/web/src/home/recap/chapter-beat.test.tsx](../../apps/web/src/home/recap/chapter-beat.test.tsx) — tests adapted to inner-sticky structure

### Lessons (carry forward)

- **When debugging cross-engine perf issues, distinguish "tracking" from "pinning"**. They're different problems with different solutions. Tracking is "what scroll position are we at"; pinning is "where does content render". Don't conflate.
- **`position: sticky` is the standard for in-place scroll effects.** Apple product pages, Linear, most editorial scroll storytelling sites use sticky. If you're considering counter-translate via JS, you're probably picking the wrong tool.
- **`getComputedStyle` reporting a transform is not proof that the transform renders.** Scroll-snap composites may silently ignore per-descendant transforms. Verify with `getBoundingClientRect` (the rendered position) when the perception/computed-style mismatch is suspicious.
- **Carry-forward folklore decays fast.** "Sticky + mandatory snap interacts poorly in Safari" was true in 2022. Re-validate browser-bug claims against current versions before architectural decisions hinge on them.

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
