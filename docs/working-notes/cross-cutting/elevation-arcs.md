# Elevation arcs — index

**Status:** Active — index of "elevate past boring app" arcs surfaced on 2026-05-23. Each arc gets its own working note in this directory. Pick from here when scoping the next polish/wow pass; cross-reference [vnext-ideas.md](vnext-ideas.md) (which carries product-shaped vNext items) and [motion-backlog.md](motion-backlog.md) (which carries motion ideas already evaluated against existing motion guardrails).

The premise: the app is at a **high-craft baseline** today — Motion `layout`, splash drift, registered CSS properties, `color-mix()` in oklch, layered gradients, layoutId pills. The flat zones are **data surfaces** (stat lists, match tables), **form controls** (button/input/select shadcn defaults), and **tile-grid mounts** (no stagger). These arcs target those gaps with 2026-era web-platform primitives wherever possible — CSS first, Motion second, JS APIs only when CSS can't do it.

Hard guardrails inherited from [motion-backlog.md](motion-backlog.md):

- bold is allowed, loud is not
- no confetti, no slot-machine vibes, no tacky gradients
- calm aesthetic wins
- `prefers-reduced-motion`: **replace, don't disable** — every arc here documents its reduced-motion variant
- evidence-based perf claims; respect [perf-baseline.md](perf-baseline.md) before/after numbers

---

## Arc index

### Tier 1 — Highest leverage, lowest cost

| Arc | What | Status |
|---|---|---|
| [view-transitions-rollout](../archive/view-transitions-rollout.md) | Replace manual rect-morph (`ActiveMatchProvider`, `ActiveChampionProvider`) with native View Transitions API; cover champion + match + Steam library flows | ✅ Shipped 2026-05-24/25 (single-element morphs on champion + match + Steam library + Steam row hero/logo + screenshot lightbox + patches reflow + Steam library/LoL champion-table reorder). LoL multi-element refinement + LoL match-list queue-filter reorder closed as abandoned. Arc archived 2026-06-06. |
| [section-shell-vt-migration](section-shell-vt-migration.md) | Remove SectionShell's `<AnimatePresence>` route-slide wrap in favour of VT-driven slides with CSS keyframes scoped by transition `types` | ✅ Shipped 2026-05-24 |
| [scroll-driven-shell](../archive/scroll-driven-shell.md) | Native CSS `animation-timeline: scroll()/view()` on nav compaction, section progress hairline, view-entry on tiles/cards. Splash decay attempted then reverted (made splash feel dull, surfaced Ken Burns against low-res art). `--theme-color` cascade lifted into `SplashProvider`. Firefox-stable JS fallback for the progress bar. | ✅ Shipped 2026-05-26 |
| [mount-and-overlay-motion](../archive/mount-and-overlay-motion.md) | Tile/list mount stagger + `@starting-style` + `transition-behavior: allow-discrete` for overlays (Select/Popover/Dropdown shadcn defaults) | ✅ Shipped 2026-05-27 (bento `.stagger-children`, Steam library `data-mount-stagger`, Radix popper `@starting-style`; sweep found no Motion wrappers to remove) |
| [accent-color-system](accent-color-system.md) | Per-route `--accent` token derived from splash/game dominant; propagate to focus rings, scrollbar, sparklines, `<meta name="theme-color">` | ✅ Shipped 2026-05-26 (core cascade, LoL). Steam Chunk 6 shipped 2026-05-28 (`dominantHex` pipeline + game-detail + nav theming). Chunk 5 second wave shipped 2026-05-28 (LoL nav + match-detail + Steam nav active-tab indicators with pulse halo + glint sweep, section progress hairline, fetch progress bar, top-nav wordmark + orb body + halo). Remaining: scrollbar tint, focus ring, hover sheen — per-site judgement calls. |

### Tier 2 — Visible craft, modest effort

| Arc | What | Status |
|---|---|---|
| [editorial-typography](../archive/editorial-typography.md) | Variable-font weight axis (Geist `wght` 100–900) on hero numbers (KDA, win rate, LP delta); subdued label treatment | ✅ Shipped 2026-05-27 — all chunks landed, cross-app extension sweep, AND primitive bifurcation same day. Final state: `SectionTitle` (prominent — ~23 page-zone dividers) + `CardTitle` (quieter — 4 sites inside card chrome) per industry-standard slot pattern; convention codified in [repo-conventions.md](../repo-conventions.md). Tile captions across both apps intentionally untouched; formatter call-sites swept KDA + LP delta + ~25 clean-display percent sites. |
| [page-composition](../archive/page-composition.md) | Decide section-structure (IA — when to group cards under dividers vs flat list) and container convention (chrome around section bodies vs bare) per surface. Sweep ~10 product surfaces with per-surface decisions; codify ruleset alongside the typography arc's CardTitle/SectionTitle rule. | ✅ Mostly shipped 2026-05-27 — Chunks 1, 2, 4, 5 all landed same day. Compositional rule codified in [repo-conventions.md](../repo-conventions.md) § "Page composition": chrome belongs at the lowest level that visually groups heterogeneous content; don't nest chrome. Steam game-detail + LoL Your Game promoted to reference surfaces; 3 LoL profile span headers swept to `SectionTitle`. Chunk 3 (owner-run visual capture) deferred, non-blocking. Secondary surfaces remain in backlog. |
| [data-viz-densification](../archive/data-viz-densification.md) | Inline `<svg>` sparklines on stat cells + `:has()` parent-aware affordances + match-outcome ambient hue drift | ✅ Shipped 2026-05-27 — all three parts. Part 1: sparkline primitive + 5 surfaces (`8816e18`, `cad0b6e`, `20b1511`, `c216457`, `3fabfed`, `a0b6729`) plus opt-in tooltip with axe pass (`6f68a2c`). Part 2: parent-aware sibling-dim across match, champion table, and Steam library lists (`7ee822d`). Part 3: ambient OKLCH hue drift on match-list rows (`d1f190b`). |
| [anchor-positioned-overlays](anchor-positioned-overlays.md) | CSS Anchor Positioning for command-palette result peek + hover-card follow-on-scroll; feature-detect + Oddbird polyfill fallback | ✅ Closed 2026-05-28 — all chunks shipped (3c/3d, 4) or descoped (5 polyfill loader kept as future hook, 6 already correct via Radix HoverCard/Floating UI, 7 fetch-on-hover cost not worth it). Pivoted from CSS Anchor Positioning to rAF + direct DOM mutation for cross-browser correctness. |
| [reduced-motion-replacements](reduced-motion-replacements.md) | Audit + standardise replacement variants per animated surface (splash drift → cross-fade, orb mark → static constellation, tilt → flat scale-up) | ✅ Shipped 2026-05-28 — global `MotionConfig reducedMotion="user"` in [main.tsx](../../../apps/web/src/main.tsx) covers 30 Motion consumers in one switch; sheen sweep on Steam tile/row/hall silenced via `[data-sheen]` colocated CSS block; full keyframe inventory verified colocated rm blocks exist for every CSS animation; regression test in [main.test.tsx](../../../apps/web/src/main.test.tsx) walks captured JSX to assert wrapper. Standard rewritten to mandate colocated rm overrides (was: "single consolidated block"). **Note**: doc stays live as a standing reference (other arc notes link in for their rm sections), not archived. |
| [microtrailer-hover-preview](microtrailer-hover-preview.md) | Steam library hovercard's media slot plays the game's 6-second silent microtrailer in place of the screenshot rotation + game-detail Preview pill (in-place crossfade) + Steam-style trailers-in-the-screenshot-carousel with a unified Shaka-driven lightbox modal (browse trailers AND screenshots continuously, audio + adaptive streaming, volume persistence). From the 2026-05-24 GetItems harvest; redesigned 2026-05-28 from tile-level reveal → hovercard slot. | ✅ Shipped end-to-end 2026-05-28/29 (both rungs). Microtrailer rung Chunks 1-4: b242811, a6462e9, c336c36, 007021f. Full-trailer modal rung: a56acfa (trailers Json + projection), e32a896 (shared types + direct-CDN URLs), a5db76d (carousel integration + RE3 crash fix), f1c1601 (unified lightbox + volume persistence + autoplay veto), b53f59f → 80cdcc7 (hover-pause stationary-cursor fix), cae4137 (volume-at-mount via callback ref). See the working note for the full per-rung breakdown. |
| [nav-condensation-arc](../archive/nav-condensation-arc.md) | Condense three-layer chrome to two: merge identity strip + secondary tabs, avatar straddles the seam, restore section nav in detail pages, demote detail tabs to inline content. (Home **stays** in primary nav — sizing pass showed the gain was in the unconstrained nav, not the strip.) Suggested order: 1.1 (core nav rework, including active-tab `layoutId` morph) → 1.3a (bare identity block, ship-ready) → 1.3b (visual flair, gated on [pointer-parallax-splash](pointer-parallax-splash.md) or [editorial-typography](../archive/editorial-typography.md)) + 1.5 (picker dropdown showcase) in parallel → 1.2 (avatar rings, evaluated against real implementation experience once 1.1 has been in front of real eyes). | ✅ Shipped 2026-05-31 — every chunk landed or has its right home elsewhere. End-state: three-layer chrome → two; Model 3 master→detail with breadcrumb section-switcher; cinematic hero on Profile that morphs into the section strip on scroll AND on Profile↔tab nav (M2 + M2b, LoL + Steam); hero-avatar activity ring (1.2); topbar `AccountRow` showcase (1.5 LoL); narrow-viewport polish pass; 1.3b moves 2 + 3 (display headline + animated rank crest). Trailing items homed elsewhere: Steam single-card 1.5 variant → [steam-lol-parity.md](steam-lol-parity.md); 1.3b Move 1 avatar hover parallax → [pointer-parallax-splash.md](pointer-parallax-splash.md). |
| [cross-section-nav-arc](cross-section-nav-arc.md) | Cross-section navigation transition (LoL ↔ Steam ↔ `/` ↔ `/status`); composes the merged strip from nav-condensation-arc § 1.1 with the existing [section-shell-vt-migration](section-shell-vt-migration.md) pattern so the chrome no longer reads as a hard swap. | ✅ Closed 2026-05-31 — no code. On inspection, the existing `cross-section` router-VT type already fades both `vt-main` and `root` (which the unnamed strip falls into) over 200ms, and the accent cascade retints in parallel; baseline judged sufficient. Reopen triggers + contingent options recorded in the arc note. |

### Tier 3 — Bigger bets, portfolio payoff

| Arc | What | Status |
|---|---|---|
| [ambient-home-hero](ambient-home-hero.md) | Canvas2D generative ambient piece on `/` synthesis surface; time-of-day reactive in Europe/Brussels TZ, chroma reactive to LoL+Steam activity. Consumed as the hero rungs of [landing-showcase-arc](landing-showcase-arc.md); WebGPU dropped from scope. | 🟢 Mostly shipped 2026-05-31 — Chunks 1 (static CSS palette) + 2/3 (Canvas2D rAF, single-path dispatcher) + 4 (activity-intensity → chroma 0.7×–1.3× via `/home/activity-intensity` endpoint) + 5 (cursor parallax via `usePointerParallax({ maxOffset: 14 })`, landed under [landing-showcase-arc](landing-showcase-arc.md) D4-cursor-parallax) + 6 (bento composition pass: opacity tuning to mute high-intensity bleed-through, no `backdrop-filter` for Safari) shipped. Remaining: optional Chunk 7 WebGPU stretch — deferred. |
| [landing-showcase-arc](landing-showcase-arc.md) | Elevate `/` synthesis surface into a deliberate first-impression portfolio showcase. Resolves the "showcase behind a Profile-tab click" gap by giving recruiters / scanners a strong landing moment without violating the synthesis-only convention. Originally consumed [ambient-home-hero](ambient-home-hero.md) and pulled from [editorial-typography](../archive/editorial-typography.md), [accent-color-system](accent-color-system.md), [self-portrait-surfaces](self-portrait-surfaces.md). | ✅ Closed 2026-05-31. Original five chunks shipped (editorial display headline, static CSS ambient hero, Canvas2D rAF + dispatcher, activity-intensity reactivity, bento composition pass). D4 reopening (full-viewport hero, Steam editorial band, cursor parallax) also closed. During D4-2 the per-band-backdrop pattern was rejected for an irreducible seam-between-bands problem; D4-3 through D4-6 superseded by [atmosphere-arc](atmosphere-arc.md) (data-driven shared-atmosphere-layer model) with foundation work in [motion-choreography-arc](motion-choreography-arc.md) sequenced first. Future work tracked there; [landing-live-hero.md](landing-live-hero.md) parked separately. Host-Chrome LCP/INP/APCA capture pending → [perf-baseline.md § Landing surface](perf-baseline.md). |
| [motion-choreography-arc](motion-choreography-arc.md) | App-wide editorial motion vocabulary (Linear/Resend register) — `<EditorialHeading>` primitive, section stagger variants, `whileInView` adoption, reduced-motion contract. Foundation arc that [atmosphere-arc](atmosphere-arc.md) consumes; both succeed [landing-showcase-arc](landing-showcase-arc.md). | Active 2026-05-31. M-1 through M-6 planned; landing-page-first scope. Sequenced before atmosphere-arc so bands inherit the vocabulary automatically. |
| [atmosphere-arc](atmosphere-arc.md) | Continuous shared atmosphere layer on `/` with bands as editorial moments on top; atmosphere morphs as user scrolls, band ordering driven by recent activity (LoL vs Steam dominance). Replaces the per-band-backdrop direction rejected during [landing-showcase-arc](landing-showcase-arc.md) D4-2. Pure-JS scroll-driven via motion's `useScroll`/`useTransform` (CSS `animation-timeline` rejected — Firefox `timeline-scope` unimplemented). | ✅ Substrate shipped 2026-06-01 (A-1 / A-2 / A-2a). A-3 onward superseded by [self-portrait-recap-arc](self-portrait-recap-arc.md). |
| [self-portrait-recap-arc](self-portrait-recap-arc.md) | Always-on Wrapped: `/` becomes a scroll-paced editorial recap of recent activity. Multi-band **chapters** (subject = Ahri + Steam games; moment = RANK_UP, OFF_META, MARATHON, etc.) over the shipped atmosphere substrate. Apple-style pin + progressive reveal per chapter; recency-decayed scoring with no fixed window. Retires ADR-2 (no-recognizable-imagery); ships hard-coded curation, deferred-trailer ADRs. | Active 2026-06-01. R-1 through R-12 planned; depends on atmosphere arc substrate (shipped). |
| [speculation-rules-prefetch](speculation-rules-prefetch.md) | TanStack Query `prefetchQuery` on hover/touchstart for match rows, champion grid, Steam tiles/rows, and nav links; Speculation Rules `<script>` block gated on TanStack Start migration | ✅ Chunks 1–5 shipped 2026-05-28 (cheap manual-prefetch path). Chunk 6 (Speculation Rules API) stays gated on Start migration. |
| [og-image-pipeline](og-image-pipeline.md) | Per-route OG images (Satori or Canvas at edge) for shareable match/champion deep-links; SEO + share-delight win | Planned |
| [live-presence-chip](live-presence-chip.md) | "Currently playing Jinx" / "Last seen 2h ago" chip in nav; SSE-pushed from Riot spectator endpoint + Steam presence | Planned |
| [personal-record-moments](personal-record-moments.md) | Subtle one-time visual moment when a stat hits a new PB (highest KDA on champion, longest win streak); replaces "loud" celebration vocabulary | Planned |
| [optional-ui-audio](optional-ui-audio.md) | Opt-in Web Audio toggle: subtle tick on palette open, soft chime on match-win render; off by default with persistent preference | Planned |
| [pointer-parallax-splash](pointer-parallax-splash.md) | Cursor-aware parallax layer on splash backdrop (multi-plane: bg + character at different offsets); composes with existing Ken Burns | Planned |
| [detail-panel-arc](detail-panel-arc.md) | Detail pages (match / champion / Steam game detail) become full-width slide-over panels with URL-as-state via TanStack parallel routes; list stays mounted, row→panel VT morph for click-from-list, virtualizer-scroll-to-row for cold deep-link arrivals | Planned |

---

## Pick order suggestion

Curated 2026-05-28 to remaining picks only — the original 1–15 ranking from 2026-05-23 covered seven arcs that have since shipped. When updating after the next shipping wave, drop completed items rather than annotating around them.

1. **motion-choreography-arc** / **atmosphere-arc** — the bold next move after landing-showcase-arc closed. Motion arc sequenced first (every atmosphere band inherits its vocabulary); atmosphere arc then lands the continuous shared-atmosphere-layer model that replaces the rejected per-band-backdrop direction.
2. **og-image-pipeline** — once shareable URLs exist, OG cards convert; pairs with [self-portrait-surfaces.md](self-portrait-surfaces.md).
3. **personal-record-moments** — emotional payoff; depends on PB detection landing first.
4. **live-presence-chip** — depends on Riot spectator endpoint + Steam presence API plumbing.
5. **pointer-parallax-splash** — small but distinctive; can ship any time on top of the shipped accent-color cascade.
6. **detail-panel-arc** — biggest structural lift on this list; defer until the simpler arcs have absorbed their feedback.
7. **optional-ui-audio** — bold; consider after the visual baseline lands so the audio doesn't carry the whole "wow".

---

## Cross-cutting decisions to settle once

These come up in multiple arcs; deciding them up-front avoids per-arc relitigation.

### Browser-support floor

Baseline target = **2025-09 Safari 26 / Chrome 120 / Firefox 128** (the platform floor where most of the 2026 primitives land). Anything that requires a polyfill must declare it in its arc note with bundle-size + feature-detect strategy. Don't ship the Oddbird anchor-positioning polyfill blindly — see [01-css-and-styling.md §anchor positioning](~/.claude/knowledge/frontend-2026/01-css-and-styling.md).

### Where new motion CSS lives

- Global keyframes + `@property` declarations → `apps/web/src/styles/motion.css` (new file), imported once at root.
- Per-component motion (tilt, sheen, breathe) → colocated with the component, as today.
- Tailwind v4 `@theme` extensions for accent variables and motion tokens → existing `apps/web/src/styles/globals.css`.

### When CSS, when Motion, when View Transitions

Per [03-motion.md](~/.claude/knowledge/frontend-2026/03-motion.md):

1. **CSS first** — compositor-only properties, deterministic state machines, scroll-driven, `@starting-style` entry/exit.
2. **Motion** — layout animations, gesture (drag/whileTap/whileHover), orchestration across many elements, MotionValues feeding non-CSS sinks.
3. **View Transitions API** — substantial DOM mutations from one user action (route change, modal open, filter applied, list reorder).
4. **GSAP** — only for scrollytelling case-study pages once those exist; not for product UI.

This is the same stacking order [vnext-ideas.md](vnext-ideas.md) §"Animation stack" already endorses. Each arc cites which slot it occupies.

### Standing rule on tests

Per `~/.claude/CLAUDE.md` and [repo-conventions.md §Testing](../../repo-conventions.md): **tests in the same commit as code**, including for these arcs. Each arc note lists the test files to land in scope. Axe scan added for any new interactive surface.

---

## Promotion to open-work

When an arc is picked up:

1. Move its entry from this index to [open-work.md](../open-work.md) under the appropriate phase.
2. Add its working note to the `## Active arcs` section of [open-work.md](../open-work.md).
3. When shipped, the arc note flips to `Status: shipped <date>`; the line here flips to ✅ with the ship date; the open-work entry moves to "Shipped" or is removed.

Same lifecycle as [post-static-metadata-roadmap.md](../lol/post-static-metadata-roadmap.md) etc.
