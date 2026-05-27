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
| [view-transitions-rollout](view-transitions-rollout.md) | Replace manual rect-morph (`ActiveMatchProvider`, `ActiveChampionProvider`) with native View Transitions API; cover champion + match + Steam library flows | ✅ Shipped 2026-05-24 (single-element morphs on champion + match + Steam library + Steam row hero/logo). LoL multi-element refinement closed as abandoned. Polish + telemetry remaining. |
| [section-shell-vt-migration](section-shell-vt-migration.md) | Remove SectionShell's `<AnimatePresence>` route-slide wrap in favour of VT-driven slides with CSS keyframes scoped by transition `types` | ✅ Shipped 2026-05-24 |
| [scroll-driven-shell](../archive/scroll-driven-shell.md) | Native CSS `animation-timeline: scroll()/view()` on nav compaction, section progress hairline, view-entry on tiles/cards. Splash decay attempted then reverted (made splash feel dull, surfaced Ken Burns against low-res art). `--theme-color` cascade lifted into `SplashProvider`. Firefox-stable JS fallback for the progress bar. | ✅ Shipped 2026-05-26 |
| [mount-and-overlay-motion](mount-and-overlay-motion.md) | Tile/list mount stagger + `@starting-style` + `transition-behavior: allow-discrete` for overlays (Select/Popover/Dropdown shadcn defaults) | Active 2026-05-27 |
| [accent-color-system](accent-color-system.md) | Per-route `--accent` token derived from splash/game dominant; propagate to focus rings, scrollbar, sparklines, `<meta name="theme-color">` | ✅ Shipped 2026-05-26 (`--theme-*` namespace, LoL + body gradient). Steam wiring + broader sweep deferred. |

### Tier 2 — Visible craft, modest effort

| Arc | What | Status |
|---|---|---|
| [editorial-typography](editorial-typography.md) | Variable-font weight + optical-size axis usage on hero numbers (KDA, win rate, LP delta); subdued label treatment | Planned |
| [data-viz-densification](data-viz-densification.md) | Inline `<svg>` sparklines on stat cells + `:has()` parent-aware affordances + match-outcome ambient hue drift | Planned |
| [anchor-positioned-overlays](anchor-positioned-overlays.md) | CSS Anchor Positioning for command-palette result peek + hover-card follow-on-scroll; feature-detect + Oddbird polyfill fallback | Planned |
| [reduced-motion-replacements](reduced-motion-replacements.md) | Audit + standardise replacement variants per animated surface (splash drift → cross-fade, orb mark → static constellation, tilt → flat scale-up) | Planned |
| [microtrailer-hover-preview](microtrailer-hover-preview.md) | Steam library tiles play official 6-second silent microtrailers on hover (singleton playback, cross-fade, reduced-motion poster); from the 2026-05-24 GetItems harvest | Planned |
| [nav-condensation-arc](nav-condensation-arc.md) | Condense three-layer chrome to two: merge identity strip + secondary tabs, drop "Home" from primary nav, avatar straddles the seam, restore section nav in detail pages, demote detail tabs to inline content. Suggested order: 1.1 (core nav rework, including active-tab `layoutId` morph) → 1.3a (bare identity block, ship-ready) → 1.3b (visual flair, gated on [pointer-parallax-splash](pointer-parallax-splash.md) or [editorial-typography](editorial-typography.md)) + 1.5 (picker dropdown showcase) in parallel → 1.2 (avatar rings, evaluated against real implementation experience once 1.1 has been in front of real eyes). | Planned |
| [cross-section-nav-arc](cross-section-nav-arc.md) | Cross-section navigation transition (LoL ↔ Steam ↔ `/` ↔ `/status`); composes the merged strip from nav-condensation-arc § 1.1 with the existing [section-shell-vt-migration](section-shell-vt-migration.md) pattern so the chrome no longer reads as a hard swap. Depends on 1.1 landing first. | Planned |

### Tier 3 — Bigger bets, portfolio payoff

| Arc | What | Status |
|---|---|---|
| [ambient-home-hero](ambient-home-hero.md) | Canvas2D (or WebGPU stretch) generative ambient piece on `/` synthesis surface; time-of-day reactive in Europe/Brussels TZ. Likely consumed as a chunk of [landing-showcase-arc](landing-showcase-arc.md). | Planned |
| [landing-showcase-arc](landing-showcase-arc.md) | Elevate `/` synthesis surface into a deliberate first-impression portfolio showcase. Resolves the "showcase behind a Profile-tab click" gap by giving recruiters / scanners a strong landing moment without violating the synthesis-only convention. Consumes [ambient-home-hero](ambient-home-hero.md) and pulls from [editorial-typography](editorial-typography.md), [accent-color-system](accent-color-system.md), [self-portrait-surfaces](self-portrait-surfaces.md). | Planned |
| [speculation-rules-prefetch](speculation-rules-prefetch.md) | `<script type="speculationrules">` for instant nav on match-row/champion-grid/Steam-tile hover; gated to same-origin | Planned |
| [og-image-pipeline](og-image-pipeline.md) | Per-route OG images (Satori or Canvas at edge) for shareable match/champion deep-links; SEO + share-delight win | Planned |
| [live-presence-chip](live-presence-chip.md) | "Currently playing Jinx" / "Last seen 2h ago" chip in nav; SSE-pushed from Riot spectator endpoint + Steam presence | Planned |
| [personal-record-moments](personal-record-moments.md) | Subtle one-time visual moment when a stat hits a new PB (highest KDA on champion, longest win streak); replaces "loud" celebration vocabulary | Planned |
| [optional-ui-audio](optional-ui-audio.md) | Opt-in Web Audio toggle: subtle tick on palette open, soft chime on match-win render; off by default with persistent preference | Planned |
| [pointer-parallax-splash](pointer-parallax-splash.md) | Cursor-aware parallax layer on splash backdrop (multi-plane: bg + character at different offsets); composes with existing Ken Burns | Planned |
| [detail-panel-arc](detail-panel-arc.md) | Detail pages (match / champion / Steam game detail) become full-width slide-over panels with URL-as-state via TanStack parallel routes; list stays mounted, row→panel VT morph for click-from-list, virtualizer-scroll-to-row for cold deep-link arrivals | Planned |

---

## Pick order suggestion

Picked roughly for "biggest perceived delta per session" given the current state:

1. **view-transitions-rollout** — replaces ~200 lines of manual rect plumbing with the platform primitive; portfolio-resonant ("uses the 2026 default, not the legacy approach")
2. **accent-color-system** — single token cascade unlocks #5/#6/#7 below; cheap if done early, expensive if retrofitted
3. **scroll-driven-shell** — zero-JS shell choreography, instant "depth as a system" signal
4. **mount-and-overlay-motion** — quietly lifts the whole UI; first thing reviewers feel without naming
5. **editorial-typography** — recruiter-scan signal in 4 seconds
6. **data-viz-densification** — turns the flattest part of the app (stat lists) into the most-information-per-pixel
7. **anchor-positioned-overlays** — palette peek pays off the "single find-anything surface" framing
8. **reduced-motion-replacements** — audit before more motion lands; one pass covers all prior arcs
9. **speculation-rules-prefetch** — perceived perf win, near-zero code; cheap last-mile
10. **ambient-home-hero** — `/` synthesis surface; bold, recruiter-bait, needs the most design judgment
11. **og-image-pipeline** — once shareable URLs exist, OG cards convert; pairs with [self-portrait-surfaces.md](self-portrait-surfaces.md)
12. **personal-record-moments** — emotional payoff; depends on PB detection landing first
13. **live-presence-chip** — depends on Riot spectator endpoint + Steam presence API plumbing
14. **pointer-parallax-splash** — small but distinctive; can ship any time after accent-color lands
15. **optional-ui-audio** — bold; consider after the visual baseline lands so the audio doesn't carry the whole "wow"

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
