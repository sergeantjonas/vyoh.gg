# Ambient generative hero on `/`

**Status:** Active 2026-05-31 — picked up as the hero chunks (2–6) of [landing-showcase-arc.md](landing-showcase-arc.md). Chunks 1–4 landed; remaining: optional Chunk 5 cursor parallax (subtle), Chunk 6 composition pass with bento. Canvas2D-first, WebGPU dropped from scope (visual gain for gradient meshes ≈ zero per § Canvas2D vs WebGPU). Reacts to **time of day in Europe/Brussels** and **recent activity intensity** across LoL + Steam. Composes with (not replaces) the existing `OrbMark`, which sits inside `LandingHeading` above the hero strip.

Read this when picking up the home-page hero pass. **Bold per the guardrails — but specifically the "calm bold" the project endorses; not particles-everywhere noise.**

KB anchors: [16-web-platform-apis.md §WebGPU](~/.claude/knowledge/frontend-2026/16-web-platform-apis.md), [03-motion.md §6 motion DX](~/.claude/knowledge/frontend-2026/03-motion.md), [06-performance.md §third-party scripts and main-thread budgets](~/.claude/knowledge/frontend-2026/06-performance.md).

---

## Why

`/` is the synthesis surface per [repo-conventions.md §Per-stream routes; `/` is synthesis-only](../../repo-conventions.md). It needs a marquee moment — what reviewers see in the first 4 seconds.

Today, `/` has:
- `OrbMark` (orbits + wisps + pulse) — sophisticated, restrained, but small-scale.
- A bento grid of tiles.

A generative ambient layer behind the bento — reactive to time-of-day + activity intensity — would:
- Communicate "this is a personal app, alive to its owner" without copy.
- Establish a portfolio anchor that recruiters/clients screenshot.
- Sit clearly in the calm-but-bold register the project endorses.

It also pays off the [self-portrait-surfaces.md](self-portrait-surfaces.md) framing: the hero *is* a synthesis of life signals, not decoration.

---

## What this is NOT

- **Not particles.** Particles read as noise. We're doing slow-moving gradient meshes or low-amplitude flow fields, not confetti.
- **Not interactive game.** No mouse-reactive playable element. At most, very subtle cursor influence (parallax-ish pull, opt-out via reduced-motion).
- **Not a video.** Video is heavy and inflexible. Procedural canvas/WebGPU is portfolio-bait specifically *because* it's a few hundred lines of code, not a megabyte of media.
- **Not the whole `/` page.** A 60vh hero strip; the bento grid sits beneath/in-front of it with backdrop-blur as the connecting layer.

---

## Design directions to pick between

Pick one before implementation; do not try to ship "all three and toggle." The point is a single recognisable visual.

### Direction A — Time-of-day gradient mesh
- Two or three radial gradients drifting slowly across the canvas. Colors derived from time-of-day in Europe/Brussels.
- **Dawn (5–8)**: warm peach + steel blue, low contrast.
- **Day (8–18)**: cool sky blue + soft cream, mid contrast.
- **Dusk (18–22)**: deep magenta + amber, high contrast.
- **Night (22–5)**: indigo + violet + faint accent, low contrast.
- Activity intensity (matches played in the last 24h, Steam playtime today) shifts the **chroma** — busy day = more saturated; quiet day = more muted.
- Implementation: Canvas2D with `globalCompositeOperation: 'screen'` and three radial gradient draws per frame; ~30fps is plenty.
- Cost: ~150 lines.
- Risk: looks too generic if colors aren't tuned well.

### Direction B — Animated flow field
- Low-density (~80) particles tracing curl-noise paths over the canvas, fading and respawning.
- One color per stream; particles representing each stream stay clustered in their lane.
- Time-of-day affects path turbulence (calmer at night).
- Implementation: Canvas2D, simplex noise (~3kB lib), ~250 lines.
- Risk: still reads as "tech demo particles" if not heavily restrained.

### Direction C — Slow geometric morph
- A single large abstract shape (Voronoi cell, lissajous curve, fluid blob) morphing over very long timescales (60s+). High craft, low motion.
- Inspired by Linear's, Stripe's, Vercel's marketing-page heroes.
- Implementation: Canvas2D with SDF (signed distance field) for the blob, or pure SVG `<animate>` for an even simpler version.
- Cost: ~200 lines.
- Risk: looks "designed" or "looks like every YC app" depending on execution.

**Default recommendation: Direction A** — time-of-day gradient mesh. It carries information (time, activity) rather than just decoration, which is the most honest framing for the synthesis surface. It's also the simplest to ship and the easiest to tune calmly. If after a prototype it feels too plain, layer one slow-moving flow-field element on top.

---

## Performance budget

Per [06-performance.md](~/.claude/knowledge/frontend-2026/06-performance.md):

- **Initial bundle impact**: ~~must lazy-load~~ → direct import. The canvas component is ~5 KB minified; splitting introduces a static→canvas handoff that proved impossible to make seamless (see Chunk 2 landing notes). Single-path render trades 5 KB for zero swap-flicker.
- **Main thread**: must stay below 5ms per frame at 60fps target on a mid-range laptop. Profile in DevTools Performance tab.
- **Battery**: pause when document is hidden (`document.visibilityState !== 'visible'`).
- **Reduced motion**: replace with static snapshot at the current time-of-day (rendered once on mount, no `requestAnimationFrame` loop). See [reduced-motion-replacements.md](reduced-motion-replacements.md).
- **Mobile**: cap to 30fps (the visual is calm enough that 30 is indistinguishable from 60). Use `setTimeout(rAF, 33)` instead of bare `requestAnimationFrame`. Or skip frames in the loop.
- **Low-power**: feature-detect `navigator.deviceMemory < 4` or `(navigator as any).connection?.saveData` — fall through to the static reduced-motion variant.

Set an explicit perf cell in [perf-baseline.md](perf-baseline.md) for `/` LCP + INP after this lands; the hero must not regress LCP.

---

## Canvas2D vs WebGPU

**Start with Canvas2D.** WebGPU is the stretch:
- WebGPU adds an "I touched it" portfolio badge.
- But WebGPU is significantly more code, support is uneven across our 2025-09 floor (Chrome/Edge default-on, Safari default-on from 18.4, Firefox still flagged on most channels — verify against [elevation-arcs.md § Browser-support floor](elevation-arcs.md) at pickup time), and the visual gain for *gradient meshes* is approximately zero.
- WebGPU pays off when shaders are genuinely doing GPU-friendly work (raymarching, fluid sim, post-processing). Gradient meshes are not that.

If WebGPU appeals later, refactor in place; the data flow (time-of-day → palette → uniform-equivalent → draw call) is identical.

---

## Chunked plan

### Chunk 1 — Static prototype (no animation, no canvas) — ✅ Landed 2026-05-31

- New file `apps/web/src/home/ambient-hero.tsx`.
- Render a CSS-only static version: three large radial gradients composited via `background-blend-mode: screen` (single layered `background-image`, not three children with `mix-blend-mode`, which gives the same visual at one DOM node).
- Tune colors at four time-of-day points statically; pick the right palette based on current `Europe/Brussels` hour on mount via `Intl.DateTimeFormat({ timeZone: "Europe/Brussels", hour: "numeric", hour12: false })`.
- Composes under (or behind, with backdrop-blur in front) the bento grid.
- Visual verification: does this alone read as "elevated"? If yes, the canvas version is just a refinement; if no, retune palettes before adding motion.

This chunk alone is shippable as the floor — even without canvas, the visual will be markedly better than today.

**Landed:** `AmbientHero` component (`hour` prop for tests, falls through to live Brussels clock at runtime), `paletteForHour` + `timeOfDayForHour` pure helpers, dawn/day/dusk/night palettes in oklch with gaming-chromatic saturation, mounted as an `aria-hidden` `absolute inset-x-0 top-0 -z-10 h-[60vh]` decorative layer with a bottom fade-to-background mask, sits behind `LandingHeading` + bento in `routes/index.tsx`. Same-commit test covers boundary-hour palette branching, three-layer composite, and live-clock fallthrough.

**Decision gate before Chunk 2** (per § Risks "Show owner the Chunk 1 static prototype before Chunk 2"): owner visual review of the palette tuning across all four time-of-day buckets. If the static read doesn't feel right, retune palettes before promoting to canvas — the Brussels-hour resolver and palette structure stay the same.

### Chunk 2 — Canvas2D with rAF + reduced-motion / low-power dispatcher — ✅ Landed 2026-05-31

- Promoted `ambient-hero.tsx` to a **single-path dispatcher**: `shouldAnimate ? <AmbientHeroCanvas/> : <StaticLayer/>` — exactly one layer in the DOM at any time. Direct (non-lazy) import of the canvas component.
- New `ambient-hero-canvas.tsx`: Canvas2D with three radial-gradient draws per frame via `globalCompositeOperation = "screen"`, drifting centers via dual-sine (period 60s, amplitude ±5%, distinct phase per layer) — Perlin replaced by sine since the visual is pure ambient drift. 33ms frame cap (~30fps). DPR-aware sizing via `ResizeObserver` and `setTransform`. `visibilitychange` listener pauses + resumes rAF. **`useLayoutEffect`** for the first frame so frame 1 lands in the backbuffer before the browser paints the freshly-mounted tree — no blank-canvas frame between mount and first rAF.
- Drift at t=0 cancels to zero per layer via the `(sin(cycle+phase) - sin(phase))` substitution, and canvas radius matches the static CSS `radial-gradient(circle Xpx ...)` exactly (no viewport scaling) — so when the dispatcher swaps static → canvas (after `useReducedMotion()` resolves `null → false`), the canvas's frame 1 paints at the same gradient centers/sizes as the static layer did. Swap is invisible.
- Branch combines reduced-motion AND low-power gates (already covers Chunk 3's scope): `useReducedMotion() === false && !isLowPower()`. `isLowPower()` checks `navigator.connection.saveData` and `navigator.deviceMemory < 4`. Either flag → only the static layer ever mounts.
- Palette refactored into a single numeric source (`GradientLayer[]` with `cx`, `cy`, `radius`, `lch: [L, C, H]`, `alpha`, `phase`) used by both static (via `layerToCssGradient` helper) and canvas. No duplication.
- Tests: 17 in `ambient-hero.test.tsx` + `ambient-hero-canvas.test.tsx`. Dispatcher branches: reduced-motion → only static; reduced-motion null → only static; reduced-motion false → only canvas. Each branch asserts exactly one of `[data-ambient-canvas]` / `[data-ambient-static]` is mounted. Full suite green.
- **Deferred to follow-up:** activity-intensity reactivity — moved to Chunk 4 (Chunks 2 + 3 collapsed since the reduced-motion branch is the same control flow as the canvas-mount gate).
- **Reverted experiment:** an earlier lazy-load + Suspense + `onFirstFrame` dispatcher was tried for bundle-split savings (~4 KB). It introduced a visible flicker on initial load — the static→canvas handoff exposed either an additive-bright frame (both layers stacked between canvas first paint and React commit) or a dark gap (when React removed static before the canvas backbuffer was promoted to the compositor), depending on per-frame timing. Neither was closable without per-frame coordination tricks. Single-path is the right tradeoff: trivial bundle cost, zero UX cost.

### Chunk 3 — Reduced-motion + low-power fallback — ✅ Landed 2026-05-31 (collapsed into Chunk 2)

The dispatcher branch renders the static layer when either gate trips. Already covered above; this chunk had no separable scope once the canvas was direct-imported behind the gate.

### Chunk 4 — Activity-intensity reactivity — ✅ Landed 2026-05-31

- New `GET /home/activity-intensity` returns `{ lolMatches24h, steamMinutesToday, intensity, asOf, timeZone }`. `lolMatches24h` is the non-remake match count over a rolling 24h; `steamMinutesToday` is closed-session minutes clipped to the Brussels calendar day (`startOfLocalDay` + per-interval clip, DST-safe via the same `Intl.DateTimeFormat` offset trick as the day-split service). Intensity is `max(lolMatches24h/6, steamMinutesToday/120)` clamped to `[0, 1]` — six matches OR two hours of Steam saturate the scalar.
- Shared `HomeActivityIntensity` type and `useHomeActivityIntensity()` query hook on the web side (5-min `staleTime` so an in-session play swing surfaces within an hour without polling).
- `intensityToChromaMultiplier(intensity)` maps `[0, 1] → [0.7, 1.3]` (baseline `0.5 → 1.0×`). `layerToCssGradient(layer, intensity)` and `layerColor(layer, alpha, chromaMul)` both apply the multiplier directly to `lch[1]`, so the static CSS gradients and the canvas's per-frame radial gradients move in lockstep.
- `AmbientHero` accepts an optional `intensity` prop (`routes/index.tsx` reads the query and forwards `activity?.intensity`). Undefined ⇒ baseline 0.5, matching the pre-reactivity palette exactly while the query is still loading.
- Reduced-motion / low-power path clamps to baseline 0.5 unconditionally per the arc note's reduced-motion contract — the static fallback never reflects activity, only time-of-day.
- The canvas threads `intensity` through a ref (`intensityRef`) so refetches don't restart the rAF loop; the next frame just picks up the new chroma multiplier mid-drift.
- Tests: pure helpers (`computeIntensity`, `startOfLocalDay`, `clipSessionMinutes`, `intensityToChromaMultiplier`, `layerToCssGradient` with intensity), service rollup, controller wiring, web hook fetch/error paths, dispatcher chroma identity under reduced-motion. Full suite green.

### Chunk 5 — Cursor parallax (subtle)

- Optional. The canvas reads `mousemove` (throttled to 60Hz) and shifts the radial-gradient centers by `±4%` of canvas size in the cursor direction.
- Decay-back when mouse leaves.
- Disabled under reduced-motion.

### Chunk 6 — Composition pass with bento

- Verify visual rhythm: hero strip + bento + footer.
- Adjust bento backdrop-blur intensity to read against the hero.
- Adjust hero strip height (`60vh → ?`) based on what makes the bento "land" below the hero on first paint without scrolling.

### Chunk 7 — (Stretch) WebGPU port

- Defer until visual is settled. Port the canvas code to a fragment shader.
- Feature-detect; canvas remains the fallback.
- Document the WebGPU port in [vnext-ideas.md](vnext-ideas.md) §"Animation stack" if a follow-up arc.

---

## Files in scope

New:
- `apps/web/src/home/ambient-hero.tsx` + test

Modified:
- `apps/web/src/routes/index.tsx` (mount the hero)
- Possibly `apps/web/src/components/bento/*` (backdrop-blur tuning)

---

## Risks / open questions

- **"Generic SaaS marketing hero" risk.** The biggest risk is the visual landing in the same register as every YC startup landing page (drifting gradient meshes are a 2024-era cliché). Mitigation: tune palettes to feel specifically *gaming* — warmer, more chromatic than typical SaaS softness. Reference: League's loading-screen palette, not Stripe's homepage.
- **Activity-intensity feedback latency.** Activity data updates on query refetch; the hero should reflect it within a session. Don't poll just for the hero — piggyback on existing query invalidation.
- **Bento legibility.** A vibrant hero behind translucent bento tiles can wash out tile content. Test against worst-case (dusk palette × high activity = high chroma) and confirm tile contrast stays above APCA threshold per [09-accessibility.md](~/.claude/knowledge/frontend-2026/09-accessibility.md).
- **Server-side rendering.** When the Start migration lands ([tanstack-start-migration.md](tanstack-start-migration.md)), the canvas can't render server-side. Confirm the component is leaf-only client (`"use client"` boundary at the leaf, not the page).
- **Owner aesthetic gut-check.** Hero is the most subjective surface in the project. **Show owner the Chunk 1 static prototype before Chunk 2.** If the static version doesn't land, no point investing in canvas.

---

## Reduced motion

- **Animated canvas → static CSS gradient.** Rendered once on mount at the current time-of-day's palette; never updates within the session.
- **Cursor parallax → disabled.**
- **Activity-intensity reactivity → static.** Always render at the "average" intensity.

The static version is information-equivalent for time-of-day (the palette still communicates morning vs night) but drops activity-reactivity, which is acceptable per the "replace, don't disable" rule because the information lives in the bento tiles anyway.
