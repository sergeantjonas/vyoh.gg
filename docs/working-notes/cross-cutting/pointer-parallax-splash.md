# Pointer-aware splash parallax

**Status:** Shipped 2026-05-31 (Chunks 1, 2, 4). Chunk 3 (constant-tuning iteration) not needed — defaults read as one cohesive image at rest; revisit only if in-motion feel says otherwise. Chunk 5 (background-removed plane separation) stays deferred per the recommendation in §Plane separation.

Shipped commits:
- `9308dd0` — `usePointerParallax` hook + 5 tests
- `ceb338d` — Two-plane integration in `champion-splash-layer.tsx` (Option A: single splash rendered twice, foreground plane at scale 1.05 / opacity 0.14 with elliptical radial mask)
- `0c7a11a` — `(pointer: fine)` gate skips the rAF + listeners on touch-only devices

Cursor-aware multi-plane parallax on the splash backdrop — character foreground at one offset, background-art at another offset, both lagging the cursor with spring damping. Composes with the existing Ken Burns drift; doesn't replace it.

Small but distinctive. Can ship any time after [accent-color-system.md](accent-color-system.md) lands.

KB anchors: [03-motion.md §motion DX](~/.claude/knowledge/frontend-2026/03-motion.md), [03-motion.md §6 reduced motion](~/.claude/knowledge/frontend-2026/03-motion.md).

---

## Why

The splash backdrop is the strongest piece of motion the app has — Ken Burns drift, hash-seeded variation per champion, blurhash preload. But it's purely time-driven; the cursor has no relationship to it.

A subtle cursor-aware parallax adds **presence**: when you move your mouse across the page, the backdrop responds. Done correctly (small offsets, heavy damping), it doesn't read as a "parallax effect" — it reads as the image being *aware* of the viewer. That's a markedly different aesthetic register and exactly the kind of moment that recruiters mention by name.

The trick is restraint:
- Max offset: ±10px on each axis (vs the typical 40px+ parallax range).
- Damping: critical-damped (no overshoot), 1.5s settle time.
- Composes additively with Ken Burns — Ken Burns owns the long-cycle drift; parallax owns the cursor response.
- Two planes: character foreground (more offset) + background art (less offset). Single splash image doesn't give us this for free — see "Plane separation" below.

---

## What this is NOT

- **Not vertical-translation scroll parallax.** That was reverted in commit `4c60951` ([motion-backlog.md "Ambient backdrop polish"](motion-backlog.md)) and stays out.
- **Not a tilt effect.** No 3D rotation; pure 2D translation.
- **Not gyroscope-driven on mobile.** Cursor-only. Mobile devices have no equivalent; on touch devices the parallax is simply disabled.
- **Not aggressive.** ±10px max, no exception.

---

## Plane separation

Champion splash art from Riot is a single image — character + background composited. To get two planes we have two options:

### Option A — Single-image fake separation (simplest)

- Render the splash twice into the backdrop container.
- Outer copy at 100% scale, full opacity (the "background plane").
- Inner copy at 105% scale, ~70% opacity, slightly more cursor offset (the "character plane").
- Inner copy gets a CSS mask (radial-gradient fading to transparent at edges) so it doesn't read as a doubled image.
- Cost: cheap. Effect: subtle and good-enough.

### Option B — Background-removal preprocessing (proper but heavy)

- Pre-process each splash with a background-removal model (e.g. `rembg`, MODNet) to produce a `champion-bg.jpg` + `champion-char.png`.
- Two-plane rendering with the actual separation.
- Cost: significant prep pipeline, additional CDN assets per champion.
- Effect: visibly better separation, especially on champions with busy backgrounds (Bel'Veth, Aurelion Sol, Xerath).

**Recommendation: ship Option A first.** Validate the parallax pattern works aesthetically with the cheap version. Promote to Option B only if A reads as "doubled image artifact" rather than "two planes."

---

## Implementation

### Hook

`apps/web/src/lib/use-pointer-parallax.ts`:

```ts
export function usePointerParallax({ damping = 0.08, maxOffset = 10 } = {}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const targetX = useRef(0);
  const targetY = useRef(0);

  useEffect(() => {
    const handle = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      targetX.current = nx * maxOffset;
      targetY.current = ny * maxOffset;
    };
    window.addEventListener("pointermove", handle, { passive: true });
    return () => window.removeEventListener("pointermove", handle);
  }, [maxOffset]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      x.set(x.get() + (targetX.current - x.get()) * damping);
      y.set(y.get() + (targetY.current - y.get()) * damping);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [damping, x, y]);

  return { x, y };
}
```

Returns Motion values for direct binding to `<m.div style={{ x, y }}>`.

### Component integration

In [splash-backdrop.tsx](../../../apps/web/src/lol/_shared/assets/splash-backdrop.tsx):

```tsx
const reduced = useReducedMotion();
const { x: bgX, y: bgY } = usePointerParallax({ maxOffset: 6 });
const { x: chX, y: chY } = usePointerParallax({ maxOffset: 12 });

// Background plane
<m.div style={reduced ? {} : { x: bgX, y: bgY }}>
  <img src={splashUrl} ... />
</m.div>

// Foreground plane (slightly cropped, soft mask)
<m.div
  className="mask-radial-fade"
  style={reduced ? {} : { x: chX, y: chY, scale: 1.05 }}
>
  <img src={splashUrl} ... />
</m.div>
```

Reduced-motion path: render only the background plane, no offset, no mask. Single splash as today.

---

## Chunked plan

### Chunk 1 — `usePointerParallax` hook + test ✅ shipped (`9308dd0`)

- Implement per pattern above.
- Test: pointermove events update target; rAF tick moves motion values toward target; cleanup cancels rAF.

### Chunk 2 — Splash backdrop integration (Option A) ✅ shipped (`ceb338d`)

- Modified [champion-splash-layer.tsx](../../../apps/web/src/lol/_shared/assets/champion-splash-layer.tsx) (NOT `splash-backdrop.tsx` — the actual splash render lives in the lazy-loaded layer component) to render two planes inside the existing Ken Burns inner motion div so the parallax wrapper doesn't shift the bottom gradient overlay or fight the scale/drift transform stack.
- Both planes bound to `usePointerParallax` with different `maxOffset` (6 / 12).
- Foreground plane uses `radial-gradient(ellipse 70% 80% at 50% 45%, black 40%, transparent 92%)` mask + scale 1.05 + opacity 0.14.
- Visual verification (screenshot review, 2026-05-31): reads as one cohesive backdrop at rest — no doubled-silhouette artifact at the radial mask edge.

### Chunk 3 — Tune offsets + damping per visual feedback (skipped)

- Defaults landed cleanly per screenshot review: bg 6px / fg 12px / damping 0.08 / fg opacity 0.14 / fg scale 1.05.
- Constants live at the call sites in `champion-splash-layer.tsx`; promote to props or a tuning store if a future need to vary per-champion emerges. Don't pre-emptively abstract.

### Chunk 4 — Reduced-motion + touch-device disabled ✅ shipped (`ceb338d` + `0c7a11a`)

- Reduced-motion: foreground plane gated on `!reduced` in `champion-splash-layer.tsx`; background plane renders without parallax offsets (shipped in `ceb338d`).
- Touch devices: `usePointerParallax` internally gates on `window.matchMedia("(pointer: fine)").matches` via `useHasFinePointer()`; when false, the rAF loop and pointer listeners don't attach and the motion values stay at 0 (shipped in `0c7a11a`).

### Chunk 5 — (Optional, deferred) Background-removed plane separation

- Only if Chunk 3 visual feedback says Option A doesn't land.
- Pre-process all champion splashes through `rembg` or equivalent.
- Add `champion-char.png` (transparent bg) + reuse `champion-bg.jpg` (or just the original) for the background plane.
- Pipeline addition to [lol-image-pipeline.md](../lol/lol-image-pipeline.md).

---

## Files in scope

New:
- `apps/web/src/lib/use-pointer-parallax.ts` + test

Modified:
- `apps/web/src/lol/_shared/assets/splash-backdrop.tsx` + test
- Possibly `apps/web/src/styles/globals.css` (mask-radial-fade utility)

---

## Risks / open questions

- **Composition with Ken Burns drift.** Ken Burns animates `transform: scale + translate` over 18s. Parallax animates `transform: translate` on a wrapper around the Ken Burns element. Should compose cleanly (different transform contexts) but verify — could conflict if Ken Burns is on the same element as parallax.
- **Performance on weak hardware.** rAF + pointermove on every frame for two planes. Profile on a low-end device; if jank, fall back to CSS transitions on `transform: translate(var(--parallax-x), var(--parallax-y))` updated via JS at lower throttle.
- **Cursor not tracked when leaving viewport.** When the cursor leaves the window, parallax doesn't reset gradually. Damp-back to (0,0) when `pointerleave` on the window — feels more intentional.
- **Mask edge artifacts.** Foreground plane mask must be subtle; harsh fade looks like a vignette. Iterate on the radial-gradient stops.

---

## Reduced motion

- **Disabled entirely.** Single-plane splash with no offset (as today).
- Acceptable per the "replace, don't disable" principle because parallax carries no information — only ambient response. Removing it is removing decoration, not communication.

See [reduced-motion-replacements.md](reduced-motion-replacements.md) §6 for the broader splash backdrop reduced-motion contract.
