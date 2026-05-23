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

## State / realtime / forms — evaluated, no library added (2026-05-23)

Surfaced from a `15-realtime-state-forms.md` KB refresh pass tracked in [frontend-2026-kb-refresh-queue.md](frontend-2026-kb-refresh-queue.md). Every library below was considered against the project's actual surfaces and parked with explicit triggers. The default state of the project is: **TanStack Query for server state, React state + Context for client state, SSE for one-way realtime push, no client form library, no sync engine.** This section exists so the same evaluation doesn't get re-run.

### Client-state libraries — Zustand / Jotai / Valtio / Legend-State

Status: parked

What they cover: small client UI state with slices, persistence, derived/dependent state, selector-driven re-renders. KB §2.7 decision table.

Why parked: The app has two app-level providers ([SplashProvider](../../../apps/web/src/lol/_shared/splash-backdrop.tsx), [CommandPaletteProvider](../../../apps/web/src/components/command-palette-provider.tsx)) — both small, low-rerender-rate, and well-served by Context. No surface today needs persisted + cross-component + selector-shaped state.

When to reconsider:

- A single surface needs **persisted + cross-component + selector-shaped state** — the canonical Zustand fit. Most likely candidate today: the daily-changing accent-color from [self-portrait-surfaces.md § Ambient / aesthetic responses](self-portrait-surfaces.md#ambient--aesthetic-responses-2026-05-14), if it persists client-side rather than nightly server-side. (It will likely persist server-side — Context still wins.)
- A list-virtualization site needs **per-row atoms** to avoid re-rendering siblings on single-row updates — the canonical Jotai `splitAtom` fit. Match list currently uses `@tanstack/react-virtual` against derived data; no `splitAtom`-shaped need.
- Game-loop-style mutation frequency where proxy ergonomics matter — Valtio's niche. Not in scope.
- A direct preference for signals-as-the-programming-model — Legend-State v3 or Solid migration. Not on the table; project bet is React Compiler (per [frontend-2026-gaps.md Gap #2](frontend-2026-gaps.md)).

Pick when triggered: **Zustand** for persistence + slices (smallest API, immer + persist cover 95%); **Jotai** for atom composition + suspense-native async; both per KB §2.7.

### Form libraries — react-hook-form / Conform / TanStack Form

Status: parked

What they cover: client-side form validation, error display, server-action integration, multi-step wizards. KB §4.7 decision table.

Why parked: No client forms exist. The cmdk command palette ([apps/web/src/components/command-palette-dialog.tsx](../../../apps/web/src/components/command-palette-dialog.tsx)) is the only "input" surface today. Upcoming form-shaped surfaces are single-button or OAuth-redirect, not form-library territory:

- Status-page admin POST actions ([open-work.md § Status page admin surface](../open-work.md)) — single buttons with toast feedback, no form library.
- Owner-auth GitHub OAuth flow ([owner-auth.md](../ops/owner-auth.md)) — redirect, no form.
- API `ValidationPipe V3` ([open-work.md](../open-work.md)) — server-side, NestJS `class-validator` continues to be the right pick.

When to reconsider:

- A single surface lands with **≥3 validated fields** (match annotations, custom champion tags, multi-step admin action). Pick is then **react-hook-form + zod** — KB §4.7 row for "Large existing React app, Pages Router or non-Next" applies. Conform is rejected because there are no server actions in this stack (NestJS API + Vite SPA, not Next App Router / Remix).
- **TanStack Form** is tempting because the rest of the stack is TanStack-everything (Router, Query, Virtual) — defer until **2+ surfaces** would benefit. Single-library inertia + ecosystem alignment isn't worth a new dep for one form.

### Sync engines — Convex / Zero / Triplit / Jazz / InstantDB / ElectricSQL / TanStack DB

Status: parked

What they cover: local-first databases with sync, optimistic mutations, conflict resolution, multi-device + offline. KB §3 decision table.

Why parked: vyoh.gg is **server-truth** — Riot API and Steam API are the authoritative data sources, and the app is read-only-portfolio framing. No offline-first stakes. Single-user. The "local DB on the device, sync in the background" pitch doesn't apply.

When to reconsider — concrete triggers:

- **Offline-first becomes a hard requirement.** Won't happen for the portfolio framing; would happen if a mobile companion app ships and needs to work on poor mobile networks.
- **A multi-user shared-state surface lands.** Most plausible candidate: spectator viewing rooms (multiple users watching a single live game with shared annotations). Currently not in scope; flagged in [self-portrait-surfaces.md § What this is NOT — multi-user](self-portrait-surfaces.md) as out of scope.
- **Collaborative annotations on matches** — owner + viewer comments on a match detail. Would require a sync model. Not on any current roadmap.

Pick when triggered, per KB §3.10:

- **Postgres backend already in place, want typed queries** (the project's shape if a sync engine ever lands) → **Zero** (Rocicorp, 1.0+ as of 2026) — query-based sync, lowest friction.
- **Convex** if also willing to migrate domain logic — Convex is a full backend, not a client lib; it would replace NestJS, not augment it. Off the table.
- **ElectricSQL** as alternative to Zero — shape-based sync, HTTP delivery, more mature ecosystem but currently in a reliability sprint.
- **Yjs** for any rich-text editing slot (none today).

### `persistQueryClient` (TanStack Query localStorage/IndexedDB hydration)

Status: parked — superseded by Start migration loaders

What it covers: hydrate the TanStack Query cache from localStorage/IndexedDB on boot, so cold loads show last-seen data immediately rather than shell-then-data.

Why tempting: the app is CSR; cold loads currently show the SPA shell before any data. `persistQueryClient` is ~30 lines of wire-up and would give "instant last-seen profile" on revisit.

Why parked: [tanstack-start-migration.md](tanstack-start-migration.md) (parked structural arc) ships server-side loaders that prime the cache on first render — strictly better than client-side hydration (no cache-key version-drift, no localStorage 5MB quota, no flash of stale data). Adding `persistQueryClient` now would be replaced when Start lands.

When to reconsider:

- The Start migration is descoped or deferred indefinitely. Then `persistQueryClient` becomes the right call (the IndexedDB persister, not localStorage — the cache will exceed 5MB).

### EventSource (Web API, not a library) — auth gotcha for post-owner-auth

Status: ship as planned in [live-presence-chip.md](live-presence-chip.md)

Note for post-owner-auth: the native `EventSource` constructor doesn't support custom headers. Once [owner-auth.md](../ops/owner-auth.md) lands, the SSE consumer either continues to rely on cookie auth (same-origin, works as-is) or switches to the `fetch + ReadableStream + Last-Event-ID` pattern (KB §1.2 "this is what most production SSE clients do"). The chip plan already pairs with same-origin cookie auth; this only becomes a gotcha if the SSE endpoint ever moves cross-origin or needs a header-based bearer token. Documented in [live-presence-chip.md § Risks](live-presence-chip.md) for Chunk 5.

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

## Framework — evaluated alternatives, kept TanStack Router SPA (2026-05-23)

Surfaced during the §05-frameworks sweep. The structural migration question (CSR → SSR) is owned by [tanstack-start-migration.md](tanstack-start-migration.md); this section catalogues the **alternative frameworks** that were considered and rejected during that sweep, so the decision doesn't get re-litigated next quarter.

### TanStack Start 1.x

Status: parked-active, decision pending (see [tanstack-start-migration.md](tanstack-start-migration.md))

What it is: The SSR/full-stack layer over TanStack Router. Same router APIs as today's SPA setup, with server-rendered HTML, route loaders running on the server, streaming SSR, and direct server-function support.

Why parked, not rejected: The migration is forward-compatible — typed search params, route definitions, head exports, and (after Round 5 Gap 15 lands) route loaders all work unchanged. The KB §05 rubric scores Start 5/5 for "type safety end-to-end" and "complex search-params state", both exact-fit. Gate: post-launch, after the first ~30 days of CSR analytics so the SEO/perf delta is measurable, not hypothetical.

### Next.js 16

Status: evaluated, **rejected** for this project

What it is: The dominant React meta-framework in 2026. App Router, RSC, explicit caching (`unstable_cache` → `cacheLife`), PPR via Cache Components in 16.x.

Why rejected:

- Cuts against the freelance-positioning angle in [CLAUDE.md](../../../CLAUDE.md) — "Stack and architectural choices are often made deliberately to surface a freelance profile". A vyoh.gg-on-Next.js portfolio reads as another React dashboard; vyoh.gg-on-TanStack-Start tells a TanStack/perf/migration story.
- Vendor lock-in to Vercel for the best DX (caching primitives, ISR, image optimization). The hosting plan in auto-memory targets a self-host or Cloudflare deploy.
- The router idioms vyoh.gg leans on hardest (typed search params, `validateSearch`, search-params-as-state) are weaker in Next App Router than in TanStack Router — a regression on the project's strongest framework win.

When to reconsider: Building a client project where the team knows Next and the freelance-portfolio angle isn't in play. Not for this codebase.

### React Router 7 (Framework Mode, formerly Remix)

Status: evaluated, **rejected** for this project

What it is: The Remix lineage now merged into React Router 7's framework mode. Deploy-anywhere story (Workers, Node, Bun), nested routes + loaders + actions, no RSC.

Why rejected:

- Same architectural slot as TanStack Start (loaders, nested routing, deploy-anywhere) but without the TanStack Router type-safety story. Switching would lose the strongest framework win (typed search params) and gain little — the deploy-anywhere advantage applies equally to Start with the right adapter.
- The migration cost is comparable to Start (both are full router-API rewrites for vyoh.gg) but the destination is strictly worse on the typed-search-params axis.

When to reconsider: If TanStack Start's Cloudflare/edge adapter story regresses meaningfully relative to React Router 7's. As of 2026 there's no such signal.

### Astro 5 (Server Islands)

Status: evaluated, **rejected** for this project

What it is: Content-first framework with Server Islands for partial dynamic content inside otherwise-static pages. Strong story for content sites with sparse interactivity.

Why rejected:

- vyoh.gg is not content-shaped. Every route has live interactivity (search, filters, command palette, route-keyed scroll, motion-driven transitions, splash provider) — there are no genuinely-static pages where Server Islands would shine.
- Switching means rewriting the entire React component tree as Astro components or accepting a per-island React runtime cost on every route. Neither makes sense for a single-app codebase already deeply invested in React idioms.

When to reconsider: A future content surface gets added (long-form case-study posts, devlog, public docs site) — that surface could be an Astro sibling, not a replacement.

### Waku

Status: evaluated, **rejected** for this project

What it is: Minimal RSC-first framework by Daishi Kato (Jotai/Zustand author). Pure RSC posture, no App Router compatibility baggage.

Why rejected:

- Too early — RSC posture is still settling in 2026, and Waku is a 1-person research project with no production track record on portfolio-scale sites.
- The freelance-positioning angle prefers TanStack/perf-specialist signals over RSC-research signals. Waku-on-portfolio reads as "I follow Twitter trends", not "I migrate Angular apps to React".

When to reconsider: Waku hits 1.0 with a measurable production user base, and an RSC-first arc lands on [elevation-arcs.md](elevation-arcs.md).

### SvelteKit 2 / Nuxt 4 / SolidStart / Qwik 2 / Fresh 2 / HonoX

Status: evaluated, **rejected** for this project

What they are: Non-React meta-frameworks (SvelteKit, Nuxt for Vue, SolidStart, Qwik 2, Fresh for Deno, HonoX for Hono). All scored in KB §05.

Why rejected:

- Switching off React forfeits every React-ecosystem investment in this codebase: Radix (103 import sites), Motion, Recharts, shadcn registry, React Compiler, every custom hook. The migration cost is "rewrite the app".
- The freelance-positioning angle is React-competent + Angular-deep + perf/build/migration specialist — none of these frameworks reinforce that profile.

When to reconsider: A future project where React isn't already chosen. Never for vyoh.gg.

### Million.js

Status: evaluated, **rejected**

What it is: React-compatible virtual-DOM accelerator via compile-time block extraction. Promise: drop-in perf wins for React render hot paths.

Why rejected:

- React Compiler 1.0 (shipped, wired per Round 1 Gap 2) covers the same slot via the official path. Stacking Million.js on top is duplicative and adds a second compile-time layer with overlapping concerns.
- vyoh.gg is not render-bound — there are no profiler-flagged render hot paths. Speculative perf libraries without a profiled bottleneck are anti-pattern per the project's "don't add abstractions beyond what the task requires" stance.

When to reconsider: A profiler flags a specific render hot path that React Compiler's auto-memoization doesn't address, AND React's own renderer can't be re-architected to fix it. Both conditions must hold.

### RedwoodSDK / Redwood Smith

Status: parked, **not yet rated by KB §05**

What it is: Cloudflare-first meta-framework spun out from RedwoodJS, targeting Workers + D1 + R2 as the primary deploy target. Surfaced in the §05-frameworks queue as something to evaluate, but the KB entry hasn't been updated yet.

Why parked, not rejected: The Cloudflare-deploy story is genuinely interesting for the post-launch hosting question (see auto-memory `hosting.md`). But the framework-choice question is already gated on the Start migration, and adding a second framework-evaluation axis would deadlock the decision.

When to reconsider: Phase 2 KB refresh for §05 lands and rates RedwoodSDK explicitly. Re-open the hosting question at that point.

---

## Build tooling — evaluated alternatives, kept Vite 8 + pnpm + Biome + SWC (2026-05-23)

Surfaced during the §07-build-tooling sweep. The current bundler choice (Vite 8 + Rolldown, with `@rolldown/plugin-babel` for the React Compiler) is best-in-class for 2026 and not in question — this section catalogues the **alternative tools** that were considered and rejected or parked across the bundler / lint / runtime / installer / task-runner / versioning axes, so the decisions don't get re-litigated next quarter.

### Rolldown standalone

Status: not needed (already using Rolldown via Vite 8)

What it is: Rolldown's standalone CLI (separate from Vite). 1.0.2 is on npm as of this audit. Rust replacement for Rollup with Rollup plugin API compatibility.

Why not needed today: vyoh.gg consumes Rolldown **through Vite 8** ([apps/web/vite.config.ts](../../../apps/web/vite.config.ts)) — the integration is already shipped. The standalone CLI is for library publishing, and `packages/shared` is a workspace-private package consumed as source `.ts` files (no build step). No library shape in the repo benefits from standalone Rolldown.

When to reconsider: A package gets extracted to public npm and needs a real build step. Until then, the Vite-embedded path is what's load-bearing.

### Rspack / Rsbuild 2.0

Status: evaluated, **rejected** for this project

What it is: ByteDance's Rust bundler with webpack loader/plugin compat as its defining feature. Rsbuild 2.0 is the opinionated app preset on top.

Why rejected:

- The KB §1.5 trigger ("you have a large existing webpack config / many custom webpack plugins, and migrating to Vite would mean rewriting half of them") doesn't fire here — there is no webpack legacy in this repo, and Vite has been the bundler since project init.
- Vite 8's plugin ecosystem is genuinely wider in practice for the libraries vyoh leans on (TanStack Router plugin, Tailwind 4 Vite plugin, React Compiler via `@rolldown/plugin-babel`). Migration would lose plugin polish, not gain it.

When to reconsider: A future project arrives with a webpack 5 config too large to rewrite. Never for vyoh.gg.

### Turbopack

Status: evaluated, **rejected** for this project

What it is: Vercel's Rust bundler. Stable and default in Next.js 16 for both `next dev` and `next build`.

Why rejected:

- KB §1.4: "It is effectively Next-exclusive. There is no general-purpose `turbopack build` CLI; if your app isn't a Next app, this isn't a choice." vyoh runs on TanStack Router / Vite, not Next.
- The framework-choice question (Next vs TanStack Start vs status quo) is already owned by [tanstack-start-migration.md](tanstack-start-migration.md) and the Next rejection rationale above. Turbopack inherits that rejection by transitivity.

When to reconsider: Never for this codebase. Re-evaluated only if a hypothetical Next migration becomes the choice, which is itself rejected above.

### Bun runtime

Status: parked — deferred-by-default with explicit triggers

What it is: All-in-one JS runtime + package manager + bundler + test runner. Bun 1.2.x bundler is production-usable; runtime has ~92% npm-API compat. KB §1.6.

Why parked: The integration story (one binary for runtime + installer + bundler + tests) is genuinely compelling for greenfield apps, but vyoh is already wired to Node 22 + pnpm + Vite + Vitest with no friction in that chain. Swapping in Bun would mean re-validating Nest 11's compatibility (decorator metadata, SWC integration), Prisma 7's compatibility (its postinstall script + `@prisma/adapter-pg` + native bindings), and `sharp`'s native binary path. The cost is large; the marginal speed win over Node 22 + pnpm doesn't justify it for a personal portfolio site.

Triggers to reconsider:

1. **Edge runtime requirement.** A route (most likely `/og/*` for OG image generation, currently Satori + resvg in-process) needs to move to a Cloudflare Workers / Bun-on-edge deploy target where Bun's runtime is materially faster and the npm-API edge cases don't matter because the surface is small.
2. **Cold-start regression in CI.** Node 22's CI startup cost becomes a measurable bottleneck on `pnpm verify:cc` wall time (currently a non-issue; flag if `setup-node` + `pnpm install` ever crosses 30s consistently).
3. **First-party Bun-only library lands.** A library vyoh needs ships Bun-first or Bun-only (e.g. a Riot/Steam SDK rewrite that uses `Bun.serve` primitives). Today there are no such libraries in any of the project's dep trees.

Aesthetic + commercial caveat: KB §13 notes Bun's 2026 Anthropic acquisition — "long-term commercial direction is unclear." Don't bet a multi-year strategy on Bun-only tooling without contingency. For a personal-portfolio project, this matters less than for a client project, but it argues against speculative adoption.

### Bun installer (just for `bun install`, not the runtime)

Status: parked

Why parked: Faster installs than pnpm in benchmarks, but pnpm catalogs (once adopted per Gap 18) close most of the actual install-time pain points (lockfile size, version-drift conflicts). Pure install-speed isn't a bottleneck on a 3-package repo. If Bun runtime ever lands per the triggers above, Bun installer comes with it; until then, pnpm 11 + catalogs is the right slot.

When to reconsider: Same triggers as Bun runtime above.

### Deno 2

Status: evaluated, **rejected** for app code

What it is: Deno 2 (Oct 2024) added Node-compat (`node:` specifier import, npm package support via `npm:` specifier), workspaces, JSR registry support. Aims at the "secure-by-default + TS-native + Node-compatible" niche.

Why rejected for app code:

- Same migration cost as Bun (Nest, Prisma, sharp all need re-validation), worse ecosystem alignment than Bun (Deno's npm-compat is permission-prompt-heavy and breaks postinstall scripts more often than Bun's).
- The freelance-positioning angle in [CLAUDE.md](../../../CLAUDE.md) is React-competent + Angular-deep + perf/build/migration specialist — Deno doesn't reinforce that profile the way TanStack/Vite/Rolldown does. Deno-on-portfolio reads as "I follow Twitter trends" rather than "I migrate large apps."

When narrowly reusable: A one-off script (e.g. a static-asset transform, a docs generator) where Deno's no-install / permission-scoped invocation beats writing a `tools/` package. No current pull.

### Turborepo / Nx / Moon (task runners)

Status: evaluated, **rejected** for this project

What they are:

- **Turborepo 2.7** — Vercel's Rust task runner with local + remote cache, no first-party distribution.
- **Nx 21** — TS+Rust runner with sophisticated project graph + Nx Cloud distributed task execution (DTE).
- **Moon** — Rust polyglot-first runner.

Why all three rejected:

- 3-package monorepo with a single owner — the bottleneck for `pnpm verify:cc` is the tests themselves, not orchestration. KB §5.2 frames Turborepo's strength as "warm-cache 5-10× speedups on CI" — at this scale, the cold-cache CI run **is** the run, and a 90-second CI is already cheap. Adding a task runner introduces config burden, vendor-lock-in risk (Turborepo's remote cache is the load-bearing feature and lives on Vercel by default), and a new failure surface for marginal wall-time win.
- KB §10 "Recommendation grid" only puts Turborepo in the picker for **monorepos**; the row that fits vyoh is "Greenfield SPA → Vite 8, Turborepo if monorepo, **none if single**." The "if monorepo" branch is the live one here, but the cost-benefit at 3 packages is below threshold.

Trigger to reconsider: **CI typecheck+test wall time crosses 5 minutes consistently** AND a fourth/fifth workspace package lands (TFT integration, owner-auth, a separate worker). Both conditions must hold. Either one alone doesn't justify the wire-up.

Pick when triggered: **Turborepo** for the simplicity-first profile vyoh has (no module-boundary enforcement need, no DTE need, no polyglot need). Nx is over-engineered for this shape; Moon's polyglot story doesn't apply.

### Oxlint

Status: parked — evaluate after Biome 2.x migration lands

What it is: Oxc-based JS/TS linter, ~50-100× faster than ESLint per Oxc benchmarks. Stable at 1.66.0. Targets the "linter" slot specifically — not a formatter, not a bundler. Can coexist with Biome (formatter) or Prettier (formatter).

Why parked, not picked up today: vyoh uses Biome for **both** lint and format. Migrating to oxlint-for-lint + Biome-for-format (or oxlint + Prettier) is a slot split, not a swap. The KB §1.2 note that Vite 8 is built on Oxc means the project is already-Oxc-based under the bundler, so the toolchain alignment story is real, but Biome 2.x closes most of the historical "oxlint is faster" gap with its own multi-file analysis + parallelism overhaul (per Gap 17).

Triggers to reconsider:

1. **Biome 2 migration (Gap 17) introduces friction** — specifically, if Biome 2's domains/multi-file analysis produces enough false positives to warrant suppressions across the repo, oxlint's narrower-but-faster rule set may be the cleaner cut.
2. **`pnpm check:cc` wall time crosses 8 seconds consistently.** Today it's sub-2s on this repo; oxlint's speedup is invisible until lint is on the critical path.
3. **A specific Oxc-exclusive lint becomes desirable** — e.g. an oxlint plugin lands that catches a vyoh-specific anti-pattern (clickable-without-`cursor-pointer`, tooltip-without-`TooltipPrimitive`) better than Biome's GritQL plugin API can.

### Changesets

Status: parked — not needed today

What it is: Per-PR markdown changesets, semver-resolved on release. KB §5.3 calls this the 2026 default for OSS libraries and most monorepos.

Why parked: vyoh.gg has no published packages. The repo is private; `packages/shared` is workspace-only (`"private": true`); apps deploy via build artifacts, not npm publish. Versioning hygiene is irrelevant until something gets published.

When to reconsider: Any package gets extracted to public npm — most plausibly a `@vyoh/lol-match-mapper` or `@vyoh/riot-rate-limiter` extraction as a freelance-signal moment (per [case-study-topics.md](case-study-topics.md)). At that point Changesets is the default pick.

### `tsup` (library-publishing bundler)

Status: not needed today

What it is: esbuild-powered library bundler with dual CJS/ESM + .d.ts output in one command. KB §10 puts it in the "OSS library" row.

Why not needed: Same reason as Changesets — no library publishing today. The "source-as-published" pattern for `packages/shared` (consumed as `.ts` files via the `exports` field) is the correct workspace-internal approach; tsup would be needed only on a public-publish path.

When to reconsider: Same trigger as Changesets — any package extracted to public npm. Pair-pick with Changesets at that point. **Or Rolldown standalone** if Rolldown 1.0.x stabilizes its standalone CLI to a point where it beats tsup on dual-format output (KB §12 flags this as a 2026 transition to watch).

### Webpack 5 / Rollup / Parcel / esbuild as primary

Status: rejected (covered for completeness)

Not picked because Vite 8 + Rolldown is the correct slot per KB §10 for "greenfield SPA (React/Vue/Svelte)". esbuild lives inside Vitest and other tools transitively; not a primary choice for this app shape.

---

## Testing — evaluated alternatives, kept Vitest 4 + jest-axe; visual-regression slot opened (2026-05-24)

Surfaced during the §10-testing sweep. The unit + component tiers (Vitest 4.1 + happy-dom + @testing-library/react + jest-axe) are correctly modern and not in question. This section catalogues the **visual-regression entrants** the audit ranked, plus the related test-tier entrants (MSW, Playwright, Storybook 9, user-event, fast-check, Stryker) so future sessions inherit the project-shape reasoning.

The headline visual-regression decision: vyoh has a **hard-rule project requirement** that splash-art swaps need side-by-side visual proof ([feedback_splash_visual_parity](../../../home/node/.claude/projects/-workspaces-vyoh-gg/memory/feedback_splash_visual_parity.md)), and 12 image families with the same wiki-primary-plus-fallback shape ([project_unified_image_fallback](../../../home/node/.claude/projects/-workspaces-vyoh-gg/memory/project_unified_image_fallback.md)). For a single-owner personal-portfolio repo with high visual stakes but no designer-in-loop, the SaaS-with-PR-UI tools (Chromatic, Argos, Percy) over-pay for their differentiator. Picked: **Playwright `toHaveScreenshot()`** for full-route + **Vitest 4 `toMatchScreenshot()`** for component-level; baselines in git.

### Playwright `toHaveScreenshot()` (full-route snapshots)

Status: **picked** — primary visual-regression path (gated on Gap 22 Playwright adoption)

What it is: Playwright 1.59's built-in screenshot matcher. PNG baselines live alongside the test (in `__screenshots__/` by default; configurable). Diff via pixelmatch; threshold per-test via `maxDiffPixels` or `maxDiffPixelRatio`. `--update-snapshots` regenerates; git tracks the PNGs as part of the change.

Why it fits vyoh:

- **Free.** No SaaS subscription. The portfolio project doesn't want recurring cost for a feature the owner can review themselves.
- **Baselines in git ARE the audit trail.** For a freelance-positioning portfolio, the PR diff showing the PNG change is exactly the visible artefact the owner wants — a future reviewer clicking through PR history sees the visual evolution of the splash backdrop as commits, which is a clearer story than a SaaS dashboard hidden behind login.
- **Already pairs with the Playwright adoption** in Gap 22. Adopting both at once is one toolchain, not two.
- **Self-contained per-test.** No service to authenticate against, no API token to manage, no CI secret. The infra surface is one screenshot per test, one PNG per surface in git.

When right (per KB `10-testing.md` §7): personal projects, small visual surfaces (~under 50 baselines), willing to git-track PNGs, no designer-in-loop for accept/reject UI.

When wrong: team scales past one engineer + one designer; baseline count crosses ~100 (git diffs of PNGs become unreadable in PR review); cross-browser matrix needed (chromium + firefox + webkit triples the baseline count).

Hard rule: gate it on Gap 22 landing first. Standalone Playwright-just-for-screenshots is the wrong sequence — set up Playwright for E2E once, then add screenshots on top.

### Vitest 4 `toMatchScreenshot()` (component-level snapshots)

Status: **picked** — secondary visual-regression path, component-level (paired with Playwright)

What it is: Vitest 4.0's browser-mode snapshot matcher. Runs in a real browser via the Playwright provider; baselines live next to the component test. Same baseline-in-git model as Playwright's matcher.

Why it fits vyoh: complements the Playwright route-level coverage with **component-fixture-level** screenshots. The splash backdrop, the champion card, the match-card asset row are exactly the kind of design-system primitives that change in ways a route-level screenshot wouldn't isolate (the splash might look fine on `/lol/$accountSlug` because the surrounding content masks a backdrop regression). Component-level baselines isolate the primitive.

When right: design-system primitives with variant matrices; components where the wrapper context matters less than the component itself (a card with 5 visual states is 5 baselines, not 5 page navigations).

When wrong: components whose visual behaviour depends on layout the parent provides (sticky positioning, container queries, scroll-driven). Route-level is the right tier for those.

Hard rule: needs the browser-mode project in vitest config (per Gap 25). Don't try to make this work in happy-dom — it requires real layout.

### Chromatic

Status: **rejected** for vyoh; reconsider only if a designer joins or Storybook (Gap 23) lands and the team grows

What it is: SaaS visual regression by Chromatic Inc. (now part of Storybook Inc.), per-snapshot cost with a free tier. Best-in-class Storybook integration: every story becomes a snapshot automatically; branch-aware UI lets reviewers accept/reject diffs per snapshot with audit history. PR comments link directly to the diff viewer.

Why rejected:

- **Differentiator is the design-review PR UI.** That UI matters when a designer reviews diffs separately from engineering — they need to click through "approve this 1px shift, reject this color drift" per snapshot without engineering involvement. vyoh has no designer in the loop. The differentiator pays for nothing.
- **Per-snapshot pricing** at the splash-art surface scale (12 image families × multiple champions × multiple variants per family) becomes meaningful fast. For a personal portfolio the cost is hard to justify.
- **No Storybook today** (Gap 23). Chromatic's Storybook integration depth would matter only after Storybook lands; pre-Storybook, the integration story is identical to any other tool.

Triggers to reconsider:

1. **Designer joins the project** (most plausibly a freelance collaborator) and explicitly needs the per-snapshot accept/reject UI without writing PR comments.
2. **Storybook 9 (Gap 23) lands** AND the story count crosses ~30 such that Chromatic's "every story is a snapshot" automation becomes a meaningful labour-saver over Playwright/Vitest screenshot tests.
3. **vyoh.gg becomes a team product** with regular non-engineering review of visual changes.

Aesthetic + commercial note: Chromatic's Storybook acquisition means betting on it ties the visual-regression story to Storybook's continued direction. That's mild — Storybook is itself well-funded — but worth flagging.

### Argos

Status: **rejected** for vyoh; the closest "if not Chromatic, then" alternative — reconsider for the same triggers as Chromatic

What it is: SaaS visual regression with a generous free tier for OSS, focused on monorepos. PR UI for accept/reject per snapshot, branch-aware approval. Modern alternative to Chromatic; teams sometimes prefer its PR-comment UX.

Why rejected for vyoh: same logic as Chromatic — the differentiator is the PR-bound accept/reject UI, which presupposes a non-engineering reviewer. No designer in the loop means the differentiator is wasted. The free OSS tier softens the cost angle vs Chromatic but doesn't change the fit.

When right (per `10-testing.md` §7): OSS Storybook users, modern Chromatic alternative for teams that prefer Argos's PR UX.

Triggers to reconsider: same as Chromatic (designer joins, Storybook + ~30 stories, team product). If those triggers fire, prefer Argos over Chromatic when:

- Repo is OSS (Argos's free OSS tier is more generous).
- Team prefers the PR-comment-style UX over Chromatic's dashboard-first UX.
- Storybook is *not* the primary surface (Argos is more bundler-agnostic; Chromatic shines hardest on pure-Storybook flows).

### Percy (BrowserStack)

Status: **rejected** for vyoh

What it is: SaaS visual regression, owned by BrowserStack. Generic — works with Cypress, Playwright, Storybook, Selenium. Per-snapshot cost.

Why rejected:

- All of Chromatic's rejection reasons apply (PR UI is the differentiator, no designer-in-loop, per-snapshot cost).
- Percy's specific edge is **cross-tool** support — useful when a team has a Cypress E2E suite, a Playwright suite, and a Storybook all needing visual diffs in one dashboard. vyoh has none of that ecosystem split; it would adopt one of Playwright or Vitest browser-mode and stick with it.
- BrowserStack ownership adds a vendor-stack dependency that doesn't pay off for a single-tool project.

When right: a team with multiple test runners that needs one visual-regression dashboard across all of them.

Trigger to reconsider: never plausibly fires for vyoh's shape. If the project ever grew into a Cypress + Playwright + Storybook stack (unlikely), Percy is the unification path — but at that point Chromatic or Argos with their better-PR-UX would still be preferred for the specifically-visual-regression slot.

### Lost Pixel

Status: **rejected** for vyoh

What it is: OSS-core visual regression with self-hosted and SaaS options. The "own your baselines in-tree" pitch is its differentiator from Chromatic/Argos.

Why rejected:

- **vyoh already owns its baselines in-tree** via the Playwright/Vitest screenshot path. Lost Pixel's pitch IS the path vyoh picked — but Lost Pixel adds an extra service to install/run, while Playwright `toHaveScreenshot()` is built-in and same-baseline-shape.
- Self-hosted infra is a non-zero burden. For a 3-package personal project the engineering cost is unjustifiable when the equivalent capability ships in Playwright.
- The SaaS tier exists but offers no clear win over Chromatic/Argos at that point — once it's SaaS, the in-tree-baselines pitch is moot.

When right: OSS project that wants in-tree baselines but doesn't already use Playwright or Vitest browser mode (e.g. a Cypress-only stack). vyoh isn't that.

Trigger to reconsider: never plausibly fires.

### Storybook 9 + Vitest addon

Status: parked — defer until next UI-arc pickup; cross-reference Gap 23

What it is: Storybook 9 (July 2025 GA) + `@storybook/addon-vitest`. Each `.stories.tsx` file becomes a Vitest test file run in headless browser mode (Playwright provider). The `play` function runs as an interaction test. Combined with `@storybook/addon-a11y` and `msw-storybook-addon`, one story drives docs + interaction tests + axe scans + (optionally) visual regression baselines.

Why parked, not picked up today: gated on a UI-arc that creates new components to write stories for. A retrofit pass on the existing ~80-component tree without a current build context would be expensive and produce stories nobody reads. The right pickup point is the **next** elevation-arc that creates new design-system components — write stories alongside, and let Storybook earn its keep on real new work.

Triggers to reconsider:

1. **Next UI-arc starts** ([elevation-arcs.md](elevation-arcs.md) — accent system, editorial type, data viz densification, ambient home hero are all candidates). When arc work begins, the Storybook pilot pairs with it naturally; new components get stories in the same commit as the component.
2. **A `/storybook` deploy becomes a freelance-pitch surface.** Per [CLAUDE.md](../../../CLAUDE.md) the project is explicitly freelance-positioning; a component catalogue at `/storybook` reads as "I think about components as a system" — a portfolio signal currently unavailable from the app surface. If a specific freelance opportunity surfaces where a component catalogue would help, this trigger fires early.
3. **Visual regression scales past ~30 component baselines** AND the per-baseline accept/reject burden becomes painful. At that point Chromatic or Argos's PR UI becomes the right swap, and Storybook is the necessary precondition.

### MSW (Mock Service Worker)

Status: **picked** — primary network-mocking path (cross-reference Gap 20)

What it is: MSW 2.14.x. One handler set runs in jsdom/happy-dom (via `@mswjs/interceptors`), in browser (via Service Worker), and in Node. Replaces the `vi.stubGlobal('fetch', ...)` ad-hoc pattern that's currently reinvented across 22 test files in [apps/web/src](../../../apps/web/src/).

Why picked: handler reuse across test tiers (Vitest, Playwright, Storybook), contract-validation hook point, single source of truth for "what the api returns" in test mode. KB `10-testing.md` §6 covers it in depth.

When right: any project with >5 test files that hand-stub `fetch`. vyoh has 22+ such files.

Hard rule: `onUnhandledRequest: 'error'` in test setup. A test calling an un-mocked endpoint should fail loudly at the network boundary, not silently downstream.

### Playwright 1.59

Status: **picked** — primary E2E + visual-regression runtime (cross-reference Gap 22 + Gap 21)

What it is: Playwright 1.59 (April 2026). Fixture system, locator priority (`getByRole` > `getByLabel` > `getByPlaceholder` > `getByText` > `getByTestId`), storage-state reuse, parallel/shard model. KB `10-testing.md` §4.

Why picked: scroll restoration, view transitions, prefetch-on-intent, and real-browser-keyboard flows can't be tested in happy-dom. Playwright closes that tier with the canonical 2026 tool.

When wrong: Component-only test coverage — Playwright Component Testing is awkward (per `10-testing.md` §4); use Vitest browser mode or Storybook 9's Vitest addon instead.

Hard rules: chromium-only at the start (don't fan out to firefox/webkit until a real cross-browser bug demands it); `--retries=2` for genuine flake only — retried-but-passed is a code-review failure; trace on first retry, not always (keeps CI artifacts small).

### @testing-library/user-event

Status: **picked** — to add to apps/web devDeps (cross-reference Gap 26)

What it is: Realistic-interaction primitive paired with @testing-library/react. Dispatches the full event sequence (keydown → beforeinput → input → keyup for a typed character) that `fireEvent` skips.

Why picked: tests should resemble real user interaction; `fireEvent` skips intermediate events that real browsers fire. The command palette keyboard flow is the canonical case — `fireEvent.keyDown(document, { key: 'k', metaKey: true })` passes today, while real `cmd+k` exercises focus + IME paths that diverge.

When right: any project with interactive components (vyoh has many).

Hard rule: use `userEvent.setup()` per test (creates a fresh instance with its own clock/clipboard state) — the older `userEvent.click(...)` static API is deprecated.

### fast-check

Status: parked — soft recommendation, not numbered as a gap

What it is: Property-based testing library, integrates with Vitest. Generates random inputs against an invariant; shrinks failing cases to minimal reproducers. KB `10-testing.md` §11.

Why parked: vyoh has classic property-test candidates (`parse-palette-verb` for parser round-trip, `sanitize-rich-html` for idempotency, `strip-wikitext` for "no HTML survives"), but the existing unit tests on those modules are strong. The marginal catch rate of adding properties is unknown without running it, and the existing test surface is already an audit-finding for "owner ran a multi-day sweep."

Triggers to reconsider:

1. **A bug ships in `parse-palette-verb` / `sanitize-rich-html` / `strip-wikitext` that an example test missed but a property test would have caught.** Use that bug as the seed property; add fast-check at that point.
2. **One of those modules gets extracted to public npm** (per [case-study-topics.md](case-study-topics.md)). Public-consumption code warrants property coverage on round-trip invariants.

Hard rule: don't use fast-check for rendering — a "render `<Foo prop=X />` property test" is just a slow component test (per `10-testing.md` §11 "where it doesn't").

### Stryker (mutation testing)

Status: parked — wrong scale for vyoh today

What it is: Mutation testing for JS — mutates source, runs the suite, reports the percentage of mutants killed. KB `10-testing.md` §9.

Why parked:

- Mutation testing pays off on pure-logic packages with rich branching. `@vyoh/shared` has some of this profile but is small (8 test files); the cost-vs-signal is below threshold.
- Component tests don't benefit (mutations land in JSX/event-handler glue where killing requires a full integration test).
- The owner-ran multi-day coverage sweep means tests are already well-asserted; mutation testing's value is highest when coverage is high but assertion quality is suspect, which is not vyoh's state.

Triggers to reconsider: same as fast-check's #2 — a `@vyoh/shared` module gets extracted to public npm. At that point the consumer surface warrants the assertion-quality ratchet.

### Fishery / @anatine/zod-mock (test data factories)

Status: not needed today — handwritten fixtures are still small enough

What they are: typed factory libraries for test data. Fishery is FactoryBot-inspired (define factories with overrides). zod-mock generates data from Zod schemas.

Why not needed: current test fixtures are mostly inline literals (10-30 line `MatchSummary` / `SteamGame` objects) duplicated across files. Painful at scale, fine at 22 files. The MSW handler set (Gap 20) is the right place to consolidate, and once that lands, factories become an obvious follow-up if duplication persists.

Trigger to reconsider: after MSW lands, audit how much duplication remains in the handler set. If the handler set carries >5 hand-rolled `MatchSummary` variants, adopt Fishery (project has no Zod schemas in `@vyoh/shared` today — uses raw TypeScript types — so Fishery is the better-fit option than zod-mock).

---

## SEO — evaluated alternatives, kept hand-rolled head + static sitemap (2026-05-24)

Phase 1 of the SEO sweep (Round 8 in [frontend-2026-gaps.md](frontend-2026-gaps.md)) confirmed that the SEO surface here is small enough that no library is warranted at this size. The shape of "things that need libraries" looks different in 2026 from what it did in 2020 — most of the SEO work is config + JSON-LD authoring, not framework adoption.

### `react-helmet-async`

Status: rejected — TanStack Router's first-party `head()` covers the same surface

What it is: the legacy React metadata library; was the standard for SPA `<head>` management before framework metadata APIs (Next `generateMetadata`, React Router 7 `meta`, TanStack Router `head()`) shipped.

Why not: TanStack Router 1.x exports a `head:` field on `createFileRoute` that runs the same merge-into-`<head>` pattern. Match-detail already uses it. Adding `react-helmet-async` would fork the per-route metadata story and confuse the next maintainer. The trigger to reconsider would be migrating away from TanStack Router entirely (not on the roadmap).

### `next-seo`

Status: not applicable — Next-coupled

What it is: prebuilt `<NextSeo>` and `<ArticleJsonLd>` / `<BreadcrumbJsonLd>` components for Next App Router metadata + JSON-LD.

Why not: project is on Vite + TanStack Router, not Next. The mental model is portable (typed helpers for each schema type) and worth borrowing as a pattern when implementing Gap 29 — see the absolute-URL helper note below.

### `schema-dts`

Status: parked — useful only if Gap 29's JSON-LD scales beyond ~3 schema types

What it is: TypeScript types for `schema.org` generated from the JSON-LD vocabulary. Gives autocomplete on `@type`, `sameAs`, `BreadcrumbList.itemListElement[*].position`, etc.

Why parked: Gap 29 ships `Person` + `BreadcrumbList` + (optionally) `WebSite` — three schema types max. Hand-typed objects are still legible. Reconsider when the project ships a fourth schema type (`SoftwareApplication` if a public SDK lands, `Article` if a blog ever ships) — at that point the autocomplete pays off and the bundle cost is irrelevant (types only).

Trigger to reconsider: shipping a fourth distinct JSON-LD `@type` in production HTML.

### `next-sitemap`, `astro-sitemap`, framework-coupled generators

Status: rejected — framework-coupled, doesn't fit Vite+TanStack Router

What they are: build-time sitemap generators that crawl the framework's route manifest.

Why not: TanStack Router's file-based route manifest at [apps/web/src/routeTree.gen.ts](../../../apps/web/src/routeTree.gen.ts) is already structured data; a 50-line Vite postbuild script can walk it without adding a dep. Gap 30's dynamic-sitemap arc would be a custom postbuild generator. Adding a third-party tool would mean teaching it to enumerate dynamic routes (`accountSlug`, `matchId`, `championAlias`, `appid`) — which is exactly the code we'd write ourselves anyway.

Trigger to reconsider: never as currently scoped; would only matter on a framework switch.

### `@vercel/og` revisited for default OG

Status: shipped as Satori + Resvg already (see "Performance / observability" section above)

Why mentioned here too: the deferred Gap 1 follow-up (site-wide default OG image) and per-route OG (Gap 31) both consume this pipeline. The existing `apps/api/src/og` module already serves `/og/match/$accountSlug/$matchId.png`; extending it to `/og/champion/$alias.png` and `/og/steam/$appid.png` is the natural shape — no second library needed.

### `gray-matter` / `front-matter` for blog post frontmatter

Status: not applicable today — no blog

What they are: YAML frontmatter parsers, used by every "blog from markdown" pipeline.

Why noted: if a case-study write-up ever lands as an MDX-driven blog (per [case-study-topics.md](case-study-topics.md)), frontmatter is the canonical place to author per-post title/description/og-image/datePublished/dateModified for SEO. Mentioning here so a future blog-arc planning session doesn't reinvent the convention.

Trigger to reconsider: when a blog/case-study route ships.

### llms.txt tooling (`llms-txt`, `llmstxt` generators)

Status: rejected — KB §10 explicit "no major AI vendor commits to consuming llms.txt as of May 2026"

What they are: build-time generators that produce `/llms.txt` (curated index) and `/llms-full.txt` (full content) from the site's content tree.

Why not: per the frontend-2026 KB, adoption sits at ~10% of measured domains by mid-2026; GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, and Google-Extended overwhelmingly skip the file. KB calls it "high-ROI for developer-tool docs, optional for marketing sites." This project is portfolio-shaped, not docs-shaped.

Trigger to reconsider: shipping a public API surface or SDK that would have its own docs site; or a major AI vendor announcing first-class llms.txt support.

### Absolute-URL helper (build-our-own, not a library)

Status: planned for Gap 31 (Bundle AC)

What this is: a `packages/shared/src/seo/` module exporting `absoluteUrl(path)`, `canonicalFor(routeParams)`, `ogImageFor(routeKind, params)`. The match-detail localhost bug (Round 5 Gap 16) is the load-bearing reason — every per-route `head()` will need to build absolute URLs the same way, and inlining `import.meta.env.VITE_API_URL` at each site reinvents the problem.

Why not a library: this is 20 lines of code; the project shape (single canonical host, single API origin, predictable route grammar) is too small to justify a dep, and the helper is the kind of thing every SEO library bakes in opinionated form anyway. Build, don't pull.

Cross-reference: `packages/shared/src/<domain>/` convention in [docs/repo-conventions.md § "Cross-package utilities belong in `packages/shared/src/`"](../repo-conventions.md).

---

## How to use this section

Future sessions should consult this file in two directions:

1. **"Should we add X?"** — search this file first. If X has a "rejected" or "evaluated, kept Y" entry, the decision has been made; surface the prior reasoning and only re-litigate if a documented trigger has fired.
2. **"What's the right tool for this arc?"** — when an [elevation-arcs.md](elevation-arcs.md) entry is being picked up, search this file for cross-references back to the arc name. Multiple library entries point at each arc (Lenis → scroll-driven-shell, Rive/OGL/leva → ambient-home-hero, etc.) and listing them in the arc's working note at pickup time is part of arc planning.

The triggers documented in each entry are the gate. Adding a library without a documented trigger is a defect, not initiative.
