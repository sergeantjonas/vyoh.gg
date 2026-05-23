# Ambient generative hero on `/`

**Status:** Planned. Part of [elevation-arcs.md](elevation-arcs.md) Tier 3. A calm generative ambient piece on the `/` synthesis route — Canvas2D first, WebGPU stretch — that reacts to **time of day in Europe/Brussels** and **recent activity intensity** across LoL + Steam. Replaces (or composes with) the existing `OrbMark`.

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
- But WebGPU is significantly more code, has narrower support (Chrome/Edge default-on, Safari behind flag in 18.0 → default in 18.4, Firefox flagged), and the visual gain for *gradient meshes* is approximately zero.
- WebGPU pays off when shaders are genuinely doing GPU-friendly work (raymarching, fluid sim, post-processing). Gradient meshes are not that.

If WebGPU appeals later, refactor in place; the data flow (time-of-day → palette → uniform-equivalent → draw call) is identical.

---

## Chunked plan

### Chunk 1 — Static prototype (no animation, no canvas)

- New file `apps/web/src/home/ambient-hero.tsx`.
- Render a CSS-only static version: three large radial gradients via `background-image: radial-gradient(...), radial-gradient(...), radial-gradient(...)` with `mix-blend-mode: screen`.
- Tune colors at four time-of-day points statically; pick the right palette based on current `Europe/Brussels` hour on mount.
- Composes under (or behind, with backdrop-blur in front) the bento grid.
- Visual verification: does this alone read as "elevated"? If yes, the canvas version is just a refinement; if no, retune palettes before adding motion.

This chunk alone is shippable as the floor — even without canvas, the visual will be markedly better than today.

### Chunk 2 — Canvas2D with rAF + activity intensity

- Promote `ambient-hero.tsx` to a Canvas2D render.
- Three radial-gradient draws per frame at slowly-drifting centers (Perlin noise drives the centers).
- Pause on `visibilitychange`.
- Read activity intensity (count of LoL matches in last 24h + Steam playtime today) via existing queries; pass as a `0–1` saturation modifier.
- Tests: snapshot of the component renders the canvas element; perf-overlay snapshot (existing [perf-overlay.tsx](../../../apps/web/src/components/perf-overlay.tsx)) shows frame budget stays under target.

### Chunk 3 — Reduced-motion + low-power fallback

- Branch: if reduced-motion or low-power, render the Chunk 1 static CSS version inline; do not boot the canvas.
- Test: reduced-motion media query mock returns static; rAF is never called.

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
