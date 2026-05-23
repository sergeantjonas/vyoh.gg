# Pointer-aware splash parallax

**Status:** Planned. Part of [elevation-arcs.md](elevation-arcs.md) Tier 3. Cursor-aware multi-plane parallax on the splash backdrop — character foreground at one offset, background-art at another offset, both lagging the cursor with spring damping. Composes with the existing Ken Burns drift; doesn't replace it.

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

### Chunk 1 — `usePointerParallax` hook + test

- Implement per pattern above.
- Test: pointermove events update target; rAF tick moves motion values toward target; cleanup cancels rAF.

### Chunk 2 — Splash backdrop integration (Option A)

- Modify [splash-backdrop.tsx](../../../apps/web/src/lol/_shared/assets/splash-backdrop.tsx) to render two planes.
- Bind both to `usePointerParallax` with different `maxOffset`.
- Apply mask-image fade on the foreground plane.
- Visual verification: does this read as "two planes" or "doubled image"?

### Chunk 3 — Tune offsets + damping per visual feedback

- Pull the constants into props/defaults.
- Iterate on a small set of champions (one with simple bg, one with busy bg, one dark, one bright).
- Target: when stationary, the cursor offset is invisible. When sweeping the cursor, the response is subliminal but present.

### Chunk 4 — Reduced-motion + touch-device disabled

- Reduced-motion: render single plane, no offset.
- Touch devices (no fine pointer): disable via `window.matchMedia("(pointer: fine)").matches` — `false` means no parallax.

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
