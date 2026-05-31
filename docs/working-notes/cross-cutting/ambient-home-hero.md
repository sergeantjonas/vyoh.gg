# Ambient generative hero on `/`

**Status:** Active 2026-05-31 — picked up as the hero chunks (2–5) of [landing-showcase-arc.md](landing-showcase-arc.md). Canvas2D-first, WebGPU dropped from scope (visual gain for gradient meshes ≈ zero per § Canvas2D vs WebGPU). Reacts to **time of day in Europe/Brussels** and **recent activity intensity** across LoL + Steam. Composes with (not replaces) the existing `OrbMark`, which sits inside `LandingHeading` above the hero strip.

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

- **Initial bundle impact**: must lazy-load. The canvas + draw logic ship as a separate chunk loaded after FCP.
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

- Promoted `ambient-hero.tsx` to a dispatcher that always paints the static CSS layer (SSR-safe, also the reduced-motion replacement) and conditionally mounts a lazy-loaded `ambient-hero-canvas.tsx` on top when motion is allowed.
- New `ambient-hero-canvas.tsx`: Canvas2D with three radial-gradient draws per frame via `globalCompositeOperation = "screen"`, drifting centers via dual-sine (period 60s, amplitude ±5%, distinct phase per layer) — Perlin replaced by sine since the visual is pure ambient drift and sine carries it without a noise dependency. 33ms frame cap (~30fps). DPR-aware sizing via `ResizeObserver` and `setTransform`. `visibilitychange` listener pauses + resumes rAF.
- Branch combines reduced-motion AND low-power gates (already covers Chunk 3's scope): `useReducedMotion() === false && !isLowPower()`. `isLowPower()` checks `navigator.connection.saveData` and `navigator.deviceMemory < 4`. Either flag → canvas never mounts; static layer alone carries the visual.
- Palette refactored into a single numeric source (`GradientLayer[]` with `cx`, `cy`, `radius`, `lch: [L, C, H]`, `alpha`, `phase`) used by both static (via `layerToCssGradient` helper) and canvas. No duplication.
- Tests: 17 in `ambient-hero.test.tsx` + `ambient-hero-canvas.test.tsx`. New: reduced-motion mocked-true → no canvas; reduced-motion null (SSR/pre-resolve) → no canvas; reduced-motion false → canvas mounts via lazy/Suspense (awaited with `waitFor`); canvas component standalone smoke + cleanup. Full suite 2003/2003 ✅.
- **Deferred to follow-up:** activity-intensity reactivity — moved to Chunk 4 (Chunks 2 + 3 collapsed since the reduced-motion branch is the same control flow as the canvas-mount gate).

### Chunk 3 — Reduced-motion + low-power fallback — ✅ Landed 2026-05-31 (collapsed into Chunk 2)

The dispatcher branch ships the static layer when either gate trips. Already covered above; this chunk had no separable scope once the canvas was lazy + behind a flag.

### Chunk 4 — Cursor parallax (subtle)

- Optional. The canvas reads `mousemove` (throttled to 60Hz) and shifts the radial-gradient centers by `±4%` of canvas size in the cursor direction.
- Decay-back when mouse leaves.
- Disabled under reduced-motion.

### Chunk 5 — Composition pass with bento

- Verify visual rhythm: hero strip + bento + footer.
- Adjust bento backdrop-blur intensity to read against the hero.
- Adjust hero strip height (`60vh → ?`) based on what makes the bento "land" below the hero on first paint without scrolling.

### Chunk 6 — (Stretch) WebGPU port

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
