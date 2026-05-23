# vyoh.gg — library shortlist

**Status:** Reference — shipped/rejected/parked library decisions. Consult only when planning a feature or polish arc; never add a library just because it appears here.

This file preserves shipped, rejected, and parked library ideas.

Use this only when planning a feature/polish arc. Do not add libraries just because they are listed here.

## Performance / observability

### `web-vitals`

Status: shipped

Implemented as:

- multi-subscriber bus
- console reporter
- `?perf=1` overlay

### `sonner`

Status: shipped

Toast feedback wired into TanStack Query mutation/query caches.

### `@vercel/og` idea

Status: shipped via direct `satori` + `@resvg/resvg-js`

Direct Satori/Resvg gave more flexibility than the Next-coupled `@vercel/og` package.

### `react-hotkeys-hook`

Status: parked

Potential uses:

- `j` / `k` between matches
- Esc to close detail
- `?` for shortcut help

Still relevant.

## Visual / animation — high leverage

### `@number-flow/react`

Status: rejected

Reason:

Slot-machine animation did not fit the calm aesthetic.

### `@formkit/auto-animate`

Status: parked

Potential use:

- drop-in list mutation animations
- useful when match-list filters land
- candidate primitive for the list-mutation slot of [elevation-arcs.md → mount-and-overlay-motion](mount-and-overlay-motion.md); evaluate alongside View Transitions `match-element` once that arc lands

### `@vibrant/core`

Status: shipped

Implemented through the `tools/champion-assets` precompute pipeline.

### `react-blurhash`

Status: shipped

Used for splash backdrop placeholders while the real image decodes.

### `react-circular-progressbar`

Status: parked

Potential use:

- animated gauges

Note:

Recharts can already cover most current needs.

### `embla-carousel-react`

Status: parked

Potential use:

- homepage "recent highlights" reel when home gets real content

### `lenis`

Status: parked — evaluate alongside [scroll-driven-shell.md](scroll-driven-shell.md)

Potential use:

- smooth-scroll engine (~3 KB) that drives the scroll position; CSS `animation-timeline: scroll()` reads it. Awwwards-circuit standard in 2026.
- the pairing is the point: CSS-first scroll-driven animations work without Lenis, but the easing feels native-default rather than "designed." Lenis remaps the scroll curve once, and every `animation-timeline: scroll()` consumer downstream inherits the smoothing for free.

When to reach for it:

- The first time someone says "the scroll feels stiff" after `scroll-driven-shell` ships. Not before — the CSS-only baseline must be measured first so we know whether the perceived stiffness is the easing or the choreography.
- Specifically NOT a substitute for `animation-timeline`. If you find yourself writing JS scroll listeners, the answer is CSS scroll-driven animations, not Lenis.

Caveat:

Hijacks native scroll. Mobile inertia can feel off if not tuned. Respect `prefers-reduced-motion` — Lenis must short-circuit to native scroll in that case (see [reduced-motion-replacements.md](reduced-motion-replacements.md)). Test with keyboard PageDown/PageUp and screen-reader virtual-cursor navigation before merging.

## Visual / animation — bigger commitments

### `gsap` + ScrollTrigger`

Status: parked

Potential use:

- scroll-driven animations
- reserved for scrollytelling case-study pages once those exist (per [elevation-arcs.md](elevation-arcs.md) §"When CSS, when Motion, when View Transitions"); not for product UI — that slot is owned by CSS-first `animation-timeline` ([scroll-driven-shell.md](scroll-driven-shell.md))

Caveat:

Overlap with Motion. Lower priority. Note: GSAP is fully free (incl. previously-paid plugins) since April 2025.

### Motion+ (paid tier of `motion`)

Status: parked — explicitly deferred 2026-05-23, do not re-litigate without a new trigger

What it is:

One-time license (~$150) on top of the OSS Motion library. Bundles **Motion Studio** (visual timeline editor for keyframes / sequences), premium hooks (cursor follower, scroll-progress variants), and premium components (Cursor, Ticker, animated counters, etc.).

Why it's deferred:

- Current Motion usage is `layout`, `AnimatePresence`, simple springs, and a few `useScroll` reads. None of that benefits from a visual editor.
- Premium components are 20–80 lines of OSS-Motion code apiece. `@number-flow/react` already covers the ticker use case better than Motion+'s equivalent (and we rejected it for fit reasons — same reasoning applies to Motion+ Ticker).
- For a single-developer portfolio, paid-tier tooling reads as "indulgent" rather than "investment in craft" — recruiters can't visually distinguish which components are licensed. Signal is in the OSS work.

When to reconsider:

1. **Ambient hero (`ambient-home-hero`) commits to a complex multi-track timeline.** Motion Studio's visual editor would meaningfully cut iteration time vs. hand-tuning keyframes in code.
2. **A real scrollytelling case-study page lands.** Then the GSAP-vs-Motion+ Studio comparison becomes worth doing for the timeline-editor slot.
3. **Owner moves toward studio work** (multiple client sites per quarter). At studio cadence the license pays for itself in a single project.

Until one of those triggers fires, do not propose Motion+. The OSS Motion library covers every current need.

### `@theatre/core` + `@theatre/studio`

Status: parked

Potential use:

- visual timeline editor for complex animation sequences; competitor to Motion Studio in the same slot.
- candidate for scrollytelling case-study pages where keyframes need fine-tuning without rebuild cycles.

When to reach for it:

- A real case-study page exists with a complex animated sequence (e.g. an annotated walkthrough of how the LoL backfill pipeline works). At that point, evaluate **Theatre vs. GSAP-only vs. Motion+** in a single sitting — picking two timeline tools is a footgun.
- The Studio runtime ships at ~150 KB; only acceptable in production-stripped mode (`@theatre/studio` is dev-only by design; `@theatre/core` consumes the exported JSON at runtime).

Caveat:

If chosen, the workflow is "design in Studio, export JSON, ship Core only." Forgetting to strip Studio bloats the bundle dramatically.

### `ogl`

Status: parked — candidate runtime for [ambient-home-hero.md](ambient-home-hero.md)

Potential use:

- ~8 KB minimal WebGL library; alternative to three.js + drei (~600 KB combined) for shader-driven ambient surfaces where the three.js scene-graph abstractions are overkill.
- Slots cleanly into the ambient hero arc if it goes "fragment shader on a fullscreen quad" rather than "3D scene with geometry."

When to reach for it:

- Ambient hero scope settles on shader-only (no meshes, no scene graph). If meshes enter the picture, react-three-fiber wins on ergonomics.
- WebGPU is the stretch target per [elevation-arcs.md → ambient-home-hero](ambient-home-hero.md); OGL has experimental WebGPU support but Canvas2D may still be the right baseline. Decide at arc-pickup time, not now.

Caveat:

Smaller community than three.js; fewer Stack Overflow answers. Pay this cost only when the bundle delta matters (it does for a portfolio).

### `leva`

Status: parked — dev-only tool

Potential use:

- in-page GUI for tweaking shader uniforms, animation parameters, or visual constants live without code reloads. Effectively a `<dat.gui>` modernization.
- Paired with [ambient-home-hero](ambient-home-hero.md) iteration: tune the noise scale, color stops, drift speed, etc. via sliders, copy the final values into source, strip leva before ship.

When to reach for it:

- During development of any surface with 3+ hand-tuned numeric constants where the right values are visual-judgment calls (not data-driven). Examples: ambient hero, [pointer-parallax-splash](pointer-parallax-splash.md), shader noise overlays.
- NEVER ships to production. Use Vite's `import.meta.env.DEV` guard or remove the import in the same commit that locks the final values.

Caveat:

Easy to forget to strip. If leva ends up in the prod bundle, it's a 30 KB embarrassment. Treat it like a `debugger;` statement — useful in flight, never committed-to-main with the GUI mounted.

### `@rive-app/react-canvas`

Status: parked

Potential use:

- interactive Rive animations
- empty states
- mascots
- candidate runtime for [elevation-arcs.md → ambient-home-hero](ambient-home-hero.md) if the generative piece moves toward state-machine-driven motion rather than pure Canvas2D/WebGPU

Caveat:

Can become gimmicky quickly. Hard guardrail from elevation-arcs: "bold is allowed, loud is not" — Rive should drive at most one surface, not become a global motion vocabulary.

### `react-three-fiber` + drei

Status: parked

Potential use:

- hero 3D scene

Caveat:

High gimmick risk on a stats dashboard.

### `@xyflow/react`

Status: parked

Potential use:

- item-build recipes
- match-event timelines
- item component → final item graphs

Real value once build-path visualization exists.

### `@visx/visx`

Status: shipped 2026-05-11

Installed packages: `@visx/scale`, `@visx/group`, `@visx/responsive`, `@visx/heatmap`, `@visx/chord`, `@visx/brush`, `@visx/axis`, `@visx/shape`. Used across four surfaces in one session:

- **Death matchup heatmap** (`apps/web/src/lol/trends/trend-death-matchup-heatmap.tsx`) — `scaleBand` / `scaleLinear`, on Champion detail. Minute × matchup grid.
- **Champion synergy chord** (`apps/web/src/lol/profile/profile-synergy.tsx`) — `Chord` + `Ribbon`, on Profile. Bipartite layout (your champs / teammates' picks) via symmetric matrix.
- **LP history brush** (`apps/web/src/lol/profile/profile-lp-history.tsx`) — `Brush` + `LinePath`, hybrid with existing Recharts main chart. Custom `renderBrushHandle` for visible drag affordance; remount-keyed reset.
- **Build-order Sankey** (`apps/web/src/lol/champions/champion-build-sankey.tsx`) — uses `d3-sankey` directly (no `@visx/sankey` exists). visx provides `ParentSize`. Lift-vs-baseline color encoding.

Peer-dep warnings on install (declares React 16–18, we're on 19) are cosmetic; runtime is fine.

Stock Recharts call sites (LineChart / BarChart / RadarChart with reference primitives) remain on Recharts per the parked-decision rationale below.

### `d3-sankey`

Status: shipped 2026-05-11

Used by the build-order Sankey above. No `@visx/sankey` package exists in the ecosystem; visx itself uses d3 under the hood, so this is a natural extension.

## Visual / animation — small delights

### `canvas-confetti`

Status: rejected

Reason:

Too tacky for the calm dashboard aesthetic.

### `react-rough-notation`

Status: parked

Likely off-brand for calm dashboard.

### `@nivo/calendar` / `react-calendar-heatmap`

Status: shipped as `react-calendar-heatmap`

Used for the 365-day activity grid on Trends.

### `react-photo-view`

Status: parked

Potential use:

- Apple-Photos-style fullscreen splash viewer

### `react-fast-marquee`

Status: parked

Likely off-brand for calm dashboard.

### `react-resizable-panels`

Status: parked

Potential use:

- split-pane compare-two-accounts view

Real value once comparison surfaces exist.

### `tailwindcss-motion`

Status: parked

Likely redundant with Motion.

### `vaul`

Status: parked

Potential use:

- mobile drawer for match detail
- pairs with a future mobile arc

## Mobile / interaction

### `@use-gesture/react`

Status: parked

Potential use:

- improve existing card tilt
- swipe gestures
- mobile-first interactions

## Newer ideas

### Virtualization

Status: shipped

`@tanstack/react-virtual` powers the match list. Migrated from `useWindowVirtualizer` to `useVirtualizer` against the `<main>` scroll container in the 2026-05-08 sticky-nav arc. Backs scroll-restoration on detail → list nav and the SSE-new-rows insert animation. `react-virtuoso` not adopted.

### Live-match tracker

Status: shipped 2026-05-10

`LiveGamePollerService` polls Spectator-V5 server-side every 60s for whitelisted accounts; cached in-memory per `(puuid, gameId)`. Emits `game-started` / `game-ended` SSE through the existing `MatchEventsService`. Opportunistic enrichment per detected game (rank + mastery for all 10 players, last-5 form pips for whitelisted players, bans, queue/map/mode badges, compositional radar). Full route at `/lol/$accountSlug/live` plus a "Live now" chip in the account header. See match-depth-roadmap Phase C.

### Achievements / Highlights

Status: parked

Idea:

Pattern-match existing match data for:

- pentas
- streaks
- perfect games
- standout performances

Why:

Pure derived analytics, no new dependencies. Could become a Highlights tab.

### Type-safe runtime validation with Zod

Status: parked

Idea:

Use Zod schemas for:

- Riot responses
- internal DTOs
- API/web boundary validation

Why:

`@vyoh/shared` defines TypeScript types, but runtime validation would harden boundaries.

### Item-build graphs with `@xyflow/react`

Status: parked

Idea:

Render match item builds as a flow graph:

```text
recipe components → final item
```

Why:

Visually striking and uses data already available.

### `react-virtuoso` + scroll-restoration polish

Status: parked

Idea:

Match-detail revisits should preserve scroll position. Current TanStack Router navigation resets scroll.

### `cobe`

Status: parked

Idea:

Interactive globe for account regions.

Caveat:

Probably gimmicky.

### `@lottiefiles/dotlottie-react`

Status: parked

Idea:

Lottie animations for empty states.

Could fit calm aesthetic if used subtly. Overlaps with Rive (`@rive-app/react-canvas`) for the empty-state slot — pick one, not both; Rive wins if any interactivity is wanted, dotLottie wins for pure playback. Cross-reference [elevation-arcs.md → ambient-home-hero](ambient-home-hero.md).

### `shiki`

Status: parked

Potential use:

- API explorer surface
- inline code in case-study pages

### `comlink`

Status: parked

Potential use:

- web workers for heavy compute

Caveat:

Overkill for current load. Relevant if client-side timeline parsing arrives.

## Evaluated alternatives — kept current stack (2026-05-23)

These libraries surfaced during a "what's popular in 2026 web dev" sweep. None should be added; this section exists so the same evaluation doesn't get re-run next quarter.

### `react-aria-components` (Adobe)

Status: evaluated, **kept Radix**

What it is: Adobe's headless component primitives. The real competitor to Radix in 2026, with better internationalization (RTL, locale-aware date handling) and stronger a11y defaults out of the box.

Why we kept Radix:

- 103 files import Radix in this codebase (per Gap 9 in [frontend-2026-gaps.md](frontend-2026-gaps.md)). A swap is a multi-day refactor for marginal UX gain.
- Radix covers every primitive we use (Dialog, Tooltip, Popover, Select, Checkbox, etc.) and ships first-class shadcn integration. The shadcn ecosystem is Radix-native.
- Adobe's strengths (i18n, RTL) are not on the roadmap for this project — it's a single-locale (`en`) portfolio.

When to reconsider:

- Building a new app from scratch where i18n/RTL matters from day one.
- Radix abandonware risk materializes (currently no signal — Radix is actively maintained as of 2026).

### `@base-ui/react` (MUI team)

Status: evaluated, **kept Radix**

What it is: MUI's headless rewrite, spun out from `@mui/base`. Same shape as react-aria-components: headless, accessible, framework-agnostic primitives.

Why we kept Radix: Same reasoning as above. Base UI is newer (less battle-tested), and the migration cost is identical.

When to reconsider: Same triggers as react-aria-components.

### `@ark-ui/react` (Chakra team)

Status: evaluated, **kept Radix**

What it is: Framework-agnostic headless components from the Chakra team, built on top of Zag state machines. Strong state-machine model is the differentiator.

Why we kept Radix: Same migration cost; state-machine ergonomics are valuable in larger codebases but overkill for this surface area.

### Animated-component registries — Magic UI, Aceternity UI, react-bits, Cult UI, OriginUI

Status: evaluated, **rejected as systems; cherry-pick individual components only with explicit aesthetic review**

What they are: Copy-paste registries of animated React/Tailwind components (border-beam, marquee, particles, animated-cursor, hero-highlight, etc.). The shadcn pattern applied to motion-heavy components.

Why rejected wholesale:

- The dominant aesthetic across these registries is **loud** — gradients, particles, shimmer, glow. Direct collision with the [elevation-arcs.md](elevation-arcs.md) hard guardrail: "bold is allowed, loud is not." Adopting them as a system would pull the whole UI in that direction.
- The components are unbranded and recognizable — using more than ~2 from any one registry makes the site look like a template assembly.

When a cherry-pick is allowed:

- Specifically Magic UI's **number-ticker** and **marquee** components are well-tuned and aesthetically neutral. If a future need maps exactly to one of those, lift the code (don't add the package) and document why in this file.
- Anything from these registries needs a "passes the calm-aesthetic test" review before merge. The test: does it draw attention to *the data* or to *itself*? If itself, reject.

### `react-tilt` / `react-parallax-tilt`

Status: rejected

Reason:

Tilt effects on cards are a 2022-era pattern that aged badly. The [pointer-parallax-splash](pointer-parallax-splash.md) arc covers the pointer-aware-depth slot with a more sophisticated execution; per-card tilt would compete with it and read as derivative.

### `react-spring`

Status: evaluated, **kept Motion**

What it is: The other major spring-physics animation library; predates Motion (Framer Motion).

Why we kept Motion:

- Motion's layout animation API (`layout`, `layoutId`) has no equivalent in react-spring. We rely on it heavily.
- LazyMotion's `domMax` mode keeps the bundle reasonable while preserving all features (see [CLAUDE.md](../../../CLAUDE.md) — "do not downgrade to `domAnimation`").
- Motion's recent rebrand (Framer Motion → Motion) consolidated the React + JS APIs; react-spring's API has not converged with the platform the same way.

When to reconsider: If Motion's licensing changes adversely (currently MIT). Not a real risk as of 2026.

### `swiper`

Status: rejected

Reason:

Heavy (~150 KB), kitchen-sink API. Embla covers the slot at a fraction of the bundle ([embla-carousel-react](#embla-carousel-react)).

---

## How to use this section

Future sessions should consult this file in two directions:

1. **"Should we add X?"** — search this file first. If X has a "rejected" or "evaluated, kept Y" entry, the decision has been made; surface the prior reasoning and only re-litigate if a documented trigger has fired.
2. **"What's the right tool for this arc?"** — when an [elevation-arcs.md](elevation-arcs.md) entry is being picked up, search this file for cross-references back to the arc name. Multiple library entries point at each arc (Lenis → scroll-driven-shell, Rive/OGL/leva → ambient-home-hero, etc.) and listing them in the arc's working note at pickup time is part of arc planning.

The triggers documented in each entry are the gate. Adding a library without a documented trigger is a defect, not initiative.
