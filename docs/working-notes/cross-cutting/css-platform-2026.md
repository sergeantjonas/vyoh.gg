# CSS platform 2026 arc — unexplored frontier features

**Status:** Active — first wave in progress. **C2 + C3 shipped 2026-06-13** (palette match-highlighting via the Custom Highlight API; `text-box-trim` on the editorial type primitives). C1 is the remaining first-wave chunk; C4–C6 need a paint-budget probe before/after; C7–C9 are smaller polish riders. Indexed in [elevation-arcs.md](elevation-arcs.md).

Parent index: [audit-2026-06-11.md](audit-2026-06-11.md). This arc collects modern CSS/JS platform features the app has **not** touched, filtered against what's already shipped (VT, scroll-driven timelines, `@property`, `:has()`, `@starting-style`, oklch/`color-mix()`, `linear()`, `interpolate-size`, `field-sizing`, Canvas2D hero, Web Audio, CV-auto) and what's parked/rejected (Houdini paint worklets, anchor positioning for overlays — closed arc, rAF pivot; Rive/tilt/magnetic hover; Lenis). Inherits all guardrails from [elevation-arcs.md](elevation-arcs.md): bold not loud, reduced-motion replace-don't-disable, evidence-based perf claims against [perf-baseline.md](perf-baseline.md) and the paint-budget table in [repo-conventions.md](../../repo-conventions.md).

Browser floor reminder: baseline target is Safari 26 / Chrome 120 / Firefox 128. Several items below are Chromium-ahead — each declares its progressive-enhancement story; none may regress the floor.

## Candidates

### C1 — Scroll-state container queries (`container-type: scroll-state`)

CSS-only detection of `stuck` / `snapped` / `scrollable` states (Chrome 133+). Apply to surfaces that currently can't style their pinned state declaratively: `champion-sticky-strip`, editorial chapter chrome, scroll-to-top button. `@container scroll-state(stuck: top) { … }` adds a shadow/compaction when actually stuck. Pure progressive enhancement — non-supporting engines keep today's static treatment, no JS fallback needed. Compositor-friendly, on-doctrine. **Caution:** `container-type` creates containment; verify no interaction with the panel-compositor rules before applying to anything inside a panel ([panel-compositor-load.md](panel-compositor-load.md)).

### C2 — CSS Custom Highlight API for palette match-highlighting *(shipped 2026-06-13)*

`CSS.highlights` + `::highlight()` (Baseline 2023 — inside floor) to highlight matched substrings in ⌘K palette results without wrapping `<span>`s. Zero DOM churn during type-ahead — the perf-meets-polish detail the palette deserves.

**Shipped shape:** [lib/highlight-matches.ts](../../../apps/web/src/lib/highlight-matches.ts) owns the API surface — `supportsHighlightApi()` (feature-detect), `paintMatchHighlights(root, needle)` (rebuilds `Range`s over every case-insensitive hit inside `[cmdk-item]` rows under `root`, registered as the named `"palette-match"` highlight), and `clearMatchHighlights()`. [command-palette-dialog.tsx](../../../apps/web/src/components/command-palette-dialog.tsx) drives it from a `useEffect` keyed on `[open, parsed.freeText]`: the needle is the free-text residual (so structured verbs like `win` / `with:Jax` never paint stray hits), and a `MutationObserver` on the list element catches async row arrival (infinite-loaded matches, champion/Steam data) while the needle is stable. Scoped to `[cmdk-item]` so group headings and the empty-state never tint. The `::highlight(palette-match)` rule lives in [index.css](../../../apps/web/src/index.css) next to `::selection`, theme-tinted via `color-mix(... var(--theme-fg) ...)`. Tested in [highlight-matches.test.ts](../../../apps/web/src/lib/highlight-matches.test.ts): happy-dom lacks the API so `supportsHighlightApi()` is `false` and `paintMatchHighlights` is a verified no-op; the range-recompute / clear-on-empty / clear-on-no-match / heading-exclusion paths run against a stubbed registry.

### C3 — `text-box-trim` on editorial type *(shipped 2026-06-13)*

Cap-height/alphabetic trimming (Baseline 2025 — inside floor) for `SectionTitle` / `CardTitle` / recap display numerals. Kills the invisible half-leading that makes optical alignment with chips and borders approximate today.

**Shipped shape:** one Tailwind v4 `@utility trim-cap { text-box-trim: trim-both; text-box-edge: cap alphabetic; }` in [index.css](../../../apps/web/src/index.css), applied at the primitive level in [section-title.tsx](../../../apps/web/src/components/ui/section-title.tsx), [card-title.tsx](../../../apps/web/src/components/ui/card-title.tsx), and [hero-number.tsx](../../../apps/web/src/components/ui/hero-number.tsx) (the single-change-point principle from the header-primitive migration — `HeroNumber` propagates to every recap numeral via `HeroPair`). Verified in a `vite preview` build via Playwright (Chromium 148): computed `text-box-trim: trim-both` / `text-box-edge: cap alphabetic` resolve and the `SectionTitle` layout box drops 18 px → 10 px, pulling headers optically flush. Pure progressive enhancement — Firefox (no `text-box-*` support today) silently keeps the prior spacing, no fallback needed.

**Gotcha that cost a build cycle — do not name a custom Tailwind utility `text-*`.** The utility was first named `text-trim-cap`; `cn()` (tailwind-merge) classifies any `text-…` token as the colour/size group and silently dropped it when it sat beside `text-foreground` / `text-sm` in the same `className`. The class was present in the built JS but absent from the rendered DOM (computed `text-box-trim: none`). Renaming to `trim-cap` fixed it. Any future custom utility that must coexist with `text-*` classes in a merged className needs a non-`text-` name (or a tailwind-merge config extension).

### C4 — `mask-image` for edge fades + editorial reveals

Completely unused today. Two applications, ordered:
1. **Gradient masks on scroll-overflow edges** (screenshot strip, sticky strips) replacing overlay-div fades — fewer stacked elements, real transparency over the backdrop.
2. **Scroll-driven mask wipes on chapter imagery** — `animation-timeline: view()` driving `mask-position`/`mask-size` so a splash "develops" on scroll. Fits the recap's editorial language better than opacity fades, and avoids the [[ancestor-opacity-suppresses-backdrop-filter]] trap by not touching `opacity` at all.

Mask layers can affect compositing — probe before/after per the paint-budget workflow on any route in the budget table.

### C5 — `mix-blend-mode` duotone grade on splash art

Unused today. Per-chapter accent-tinted duotone: grayscale splash + accent overlay with `mix-blend-mode: color` (driven by the existing `--atmosphere-tint-h`) gives chapters a unified magazine-style grade instead of raw game assets. **Hard gate:** blend modes create stacking contexts and add compositing cost — run the recap perf-probe scenario before/after, and check the splash-visual-parity constraint ([[feedback_splash_visual_parity]]) with side-by-side proof before merge. If the probe pushes the recap budget row, this candidate dies rather than widening the budget — it's a grade, not a feature.

### C6 — `offset-path` on the match map overlay

[match-map-overlay.tsx](../../../apps/web/src/lol/matches/match-map-overlay.tsx) already has kill/death coordinates. Animate a marker along a death-walk / roam path with CSS motion path (`offset-path: path(…)` built from the coordinate series). Pure CSS, compositor-friendly, and a data-viz flourish no LoL dashboard has — strong case-study material. Reduced-motion variant: static dotted path, no marker travel.

### C7 — OffscreenCanvas worker for the ambient hero

Move the Canvas2D generative hero ([ambient-home-hero.md](ambient-home-hero.md)) draw loop into a worker via OffscreenCanvas — main thread sheds the rAF work entirely. Directly serves the paint-budget story on `/`; measure long-task delta with the recap probe scenario. Fallback: feature-detect, keep the on-thread path (it's the current shipped state, not a regression). Note the activity-intensity reactivity and cursor parallax inputs must be posted to the worker — design the message shape before starting.

### C8 — `corner-shape: squircle`

Superellipse corners (Chromium 139+) on hero cards / panels — one-line progressive enhancement over `border-radius`, reads as subliminal iOS-grade polish. Apply at the panel/hero tier only, not every tile (bold not loud). No fallback work needed — non-supporting engines render today's radius.

### C9 — Variable-font axis on a scroll timeline

The editorial type arc shipped the Geist `wght` axis statically. Animate weight (and optical size if the font carries it) on chapter headlines via `animation-timeline: view()` — deepens the editorial motion language with no Motion involvement. Firefox lacks `animation-timeline` on some shapes — reuse the scroll-driven-shell arc's Firefox fallback pattern (static end-state, no JS shim).

## Pick order

C1 + C2 + C3 as one quick-wins wave (independent, floor-safe or progressive-enhancement) — **C2 + C3 done**, C1 remains. Then C4.1 (edge masks, low risk) → C6 (map paths, showcase value) → C7 (perf story). C4.2 / C5 / C9 ride the next recap-chapter touch so the probe cost is shared. C8 anytime as a one-liner.
