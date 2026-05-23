# Frontend-2026 KB gaps

**Status:** Active — five small gaps surfaced by the 2026-05-22 evaluation against `~/.claude/knowledge/frontend-2026/`. Most ship as sub-session each; one defers to post-launch; one folds into the parked [tanstack-start-migration.md](tanstack-start-migration.md).

Companion to [tanstack-start-migration.md](tanstack-start-migration.md). That note covers the structural gap (CSR vs SSR for a public portfolio). This note covers the smaller, mostly-independent items that don't need to wait for the migration.

Sister file: [frontend-2026-sweep-queue.md](frontend-2026-sweep-queue.md) — tracks the **two-phase domain sweeps** across frontend-2026. This file ([frontend-2026-gaps.md](frontend-2026-gaps.md)) is one of the **Phase 1 outputs**: project-side adoption gaps surfaced by auditing this project against the KB. When a sweep also reveals that the KB recommendation itself is stale or missing newer alternatives, that goes into Phase 2 of the sweep (KB refresh), tracked in the sweep queue, not here.

---

## Gap 1 — Static `<head>` baseline — SHIPPED 2026-05-23

Shipped in `chore: add static head baseline, robots.txt, sitemap.xml` (c6c3720). Added description, OG title/description/url, theme-color, canonical, twitter:card to [index.html](../../../apps/web/index.html); created `apps/web/public/robots.txt` (with sitemap pointer) and `apps/web/public/sitemap.xml` (4 routes). OG image deferred until a marquee surface exists — placeholder would have been worse than absence.

**Follow-up — OG image (~10 min):** When a marquee surface is ready to screenshot (e.g. a polished `/` synthesis card, or a finished match-detail recap), capture a 1200×630 PNG to `apps/web/public/og.png` and add `<meta property="og:image" content="https://vyoh.gg/og.png" />` (plus `og:image:width`, `og:image:height`) to [index.html](../../../apps/web/index.html). Tracked in [open-work.md](../open-work.md) under Cross-cutting.

**Current state:** [apps/web/index.html](../../../apps/web/index.html) carries charset + viewport + favicon + `<title>vyoh.gg</title>`. Nothing else. No description, no OG tags, no theme-color, no canonical, no `robots.txt`, no `sitemap.xml`.

**KB floor:** `13-seo.md` §1 — every public page ships with description, OG title/description/image, theme-color, canonical. `robots.txt` + `sitemap.xml` for indexable sites.

**Why it matters now even though Start is parked:** AI crawlers (ChatGPT-Search, Perplexity, ClaudeBot) lag JS rendering by 3–5 years per `13-seo.md` §8. Page-agnostic head fields are read from `index.html` directly on first crawl — they don't need SSR. The portfolio framing depends on these crawlers being able to read *something* the moment the site goes live.

**What changes after Start:** Per-route `<title>` and description come from each route's `head()` function. The static baseline (OG image URL, theme-color, default description) stays in the root document either way.

**How to apply:** One commit. Add the missing tags to [index.html](../../../apps/web/index.html). Create `apps/web/public/robots.txt` and `apps/web/public/sitemap.xml`. Generate an OG image (1200×630, can be a screenshot of `/` once a marquee surface exists; placeholder for now).

**Effort:** ~1h including OG image. Sub-session.

---

## Gap 2 — React Compiler on Vite — SHIPPED 2026-05-23

Shipped in `build: enable react compiler on the web build` (0e8800c). Note for future reference: `@vitejs/plugin-react` v6 dropped the inline `babel.plugins` option — wiring now uses `reactCompilerPreset()` from the plugin alongside `@rolldown/plugin-babel`. KB `04-react-internals.md` §10 still describes the v4/v5 API; flag this if the section is touched in the next sweep.

**Current state:** [apps/web/vite.config.ts](../../../apps/web/vite.config.ts) configures `@vitejs/plugin-react` without `babel.plugins`. React 19.2.5 is installed, so the runtime supports Compiler memoization primitives.

**KB floor:** `04-react-internals.md` §10 — React Compiler 1.0 is GA. On Vite, enable via `babel.plugins: ['babel-plugin-react-compiler']` inside the react plugin config.

**Why it matters now:** Owner is actively building MR2–MR4 and PN1–PN4 (per [open-work.md](../open-work.md)). Compiler removes the need to hand-write `useMemo`/`useCallback`/`memo` in those surfaces. Flipping it later still works but loses the leverage on everything written between now and then.

**Tension with Start:** None. Compiler config sits on the vite-plugin-react instance, which Start keeps.

**How to apply:** Add `babel-plugin-react-compiler` to `apps/web/package.json`, wire it into vite.config.ts, run `pnpm verify:cc`, spot-check one heavily-memoized surface (e.g. `MatchWindowProvider`) to confirm no regressions.

**Effort:** ~30 min + verify pass. Sub-session.

**Alternative considered and rejected (2026-05-23):** `@preact/signals-react` as a fine-grained re-render path. Rejected for the same reason `15-realtime-state-forms.md` §2.6 cites — the React adapter uses `useSyncExternalStore` + proxies and runs outside the React Compiler optimization path. Compiler is the project's bet; signals would compete with it, not complement it.

---

## Gap 3 — Web-vitals → backend RUM

**Current state:** [apps/web/src/lib/web-vitals.ts](../../../apps/web/src/lib/web-vitals.ts) has pub/sub plumbing wired in [apps/web/src/main.tsx](../../../apps/web/src/main.tsx). Only `consoleReporter` subscribes. No POST, no persistence, no alerting.

**KB floor:** `14-observability.md` §5.5 — web-vitals pub/sub → custom backend pattern. Persist LCP/INP/CLS per page, per session, with attribution.

**Why it doesn't matter yet:** No real users. Pre-launch validation is synthetic (Lighthouse, [perf-baseline.md](perf-baseline.md)). Building a `/rum` endpoint + Postgres table + retention policy now buys nothing measurable.

**Why it's cheap to add later:** The publisher hook is already there. Adding a subscriber that POSTs to NestJS is ~30 lines; the API side is one controller + one table.

**How to apply:** Defer until post-launch. Promote to open-work.md once the site has weekly visitor numbers worth analyzing.

**Effort when triggered:** ~2h end-to-end (frontend subscriber + NestJS endpoint + Prisma migration + minimal status-page surface).

---

## Gap 4 — Three-tier error boundaries

**Current state:** No React `ErrorBoundary` anywhere in the tree. TanStack Router's per-route `errorComponent` is mostly undefined. A crash inside Recharts, visx, or the splash backdrop today takes the entire app down to the SPA's blank fallback.

**KB floor:** `14-observability.md` §1.3 — three-tier boundaries: app-root (catches router itself), route-level (per section), widget-level (per fragile component, fails small).

**Tension with Start:** Route tier overlaps with Start's `RootDocument` and per-route boundaries. Rewriting `errorComponent` on 30+ routes now is wasted work because the route-tier API surface shifts when SSR lands.

**Recommendation: ship app-root + widget tier now; defer route tier into the Start migration chunks.**

- **App-root boundary** — wraps `<RouterProvider>` in [main.tsx](../../../apps/web/src/main.tsx). Catches router/provider crashes. Renders a static "something went wrong" with a reload button.
- **Widget tier** — small `<ErrorBoundary>` component used at fragile leaf sites: Recharts/visx wrappers, splash backdrop, command palette. Each falls back to a one-line "this section unavailable" without taking the page down.

Route tier folds into [tanstack-start-migration.md](tanstack-start-migration.md) chunks 2–4 (`errorComponent` per `_root`-style layout).

**Effort:** ~1h for the two-tier subset. Sub-session.

---

## Gap 5 — `fetchpriority="high"` on the *actual* LCP element (corrected 2026-05-22)

**Correction:** The original framing assumed the splash backdrop is the LCP hero. Reading [splash-backdrop.tsx:142](../../../apps/web/src/lol/_shared/assets/splash-backdrop.tsx#L142) shows it already carries `fetchPriority="low"` and renders at `opacity: 0.2` behind a blurhash placeholder. It is deliberately decorative — not the LCP candidate. Leaving it `low` is correct.

**Real gap:** No element in `apps/web/src` carries `fetchpriority="high"` (ugrep audit 2026-05-22). The actual LCP element on each top route hasn't been identified. Candidates per surface: profile name/headline strip on `/lol/$accountSlug`, the first match-card image on `/lol/$accountSlug/matches`, the home-page hero (TBD).

**KB floor:** `06-performance.md` §2 — biggest single LCP win on any image-heavy hero. Exactly one `fetchpriority="high"` per page; signals to the browser to deprioritize other resources.

**Tension with Start:** None. Image attribute survives the entry rewrite.

**How to apply:** Run Lighthouse on each of the marquee routes (`/`, `/lol/$accountSlug`, `/lol/$accountSlug/matches`, `/lol/$accountSlug/matches/$matchId`) to identify the LCP element. Add `fetchpriority="high"` to that element. Verify exactly one per page. This depends on the parked LCP re-measure in [perf-baseline.md](perf-baseline.md) running first.

**Effort:** ~30 min (identification + per-route changes + re-measure window). Slightly larger than originally estimated because the LCP elements are not yet known.

---

## Bundling and slotting

| Bundle | Gaps | Effort | Slot |
|---|---|---|---|
| **A — head baseline + LCP fetchpriority** | #1, #5 | ~1h | #1 SHIPPED 2026-05-23 (c6c3720); #5 still pending LCP re-measure |
| **B — React Compiler** | #2 | ~30min + verify | SHIPPED 2026-05-23 (0e8800c) |
| **C — App-root + widget error boundaries** | #4 (partial) | ~1h | Ship now, separate commit |
| **D — RUM backend** | #3 | ~2h | Post-launch trigger |
| **E — Route-tier error boundaries** | #4 (remainder) | folds in | Bundled into [tanstack-start-migration.md](tanstack-start-migration.md) chunks 2–4 |

Bundles A, B, C are independent and benefit the surfaces being built right now. None conflict with the parked Start migration.

## Triggers

- **A, B, C** — ready to land. No external gate. Pick up between other work.
- **D** — promote when the site has weekly visitor counts worth analyzing (post-launch; specific threshold TBD when launch happens).
- **E** — lands as part of `tanstack-start-migration.md` chunks. No separate tracking needed.

## Cross-references

- [tanstack-start-migration.md](tanstack-start-migration.md) — parent structural arc; E folds in here, A's per-route head story upgrades after this lands.
- [perf-baseline.md](perf-baseline.md) — owns the LCP re-measure that validates gap #5.
- [open-work.md](../open-work.md) — index entry under Adjacent maintenance / Cross-cutting.

---

## Round 2 — extended evaluation (2026-05-22)

Audit dimensions beyond the original 5 gaps: CSS modernization, library footprint, design-token wiring. Same recommendation shape (motivation / tension / effort / slot).

### Gap 6 — `color-scheme` declaration missing

**Current state:** [apps/web/src/index.css](../../../apps/web/src/index.css) sets `:root` and `.dark` design tokens in OKLCH but never declares `color-scheme`. Class-based dark mode (`@custom-variant dark (&:is(.dark *))`) handles the manual toggle.

**KB floor:** `01-css-and-styling.md` §3.4 and `02-design-systems.md` §4 — `color-scheme: light dark` on `:root` is the opt-in for native form-control dark variants (checkbox tinting, file inputs, native scrollbar) and the trigger for `light-dark()` to resolve correctly. Pattern C ("manual override beats prefers-color-scheme"): `color-scheme: light dark` on `html`, conditional override via `html[data-theme="dark"] { color-scheme: dark }`.

**Why it matters:** Native form controls render in light-mode styling regardless of `.dark` class. The custom scrollbar in [index.css:255](../../../apps/web/src/index.css#L255) already paints over the native scrollbar, but checkboxes (Radix `@radix-ui/react-checkbox` is in deps), date pickers, and any future native input will render mismatched.

**Tension with current setup:** None. `color-scheme` is additive — class-based dark mode keeps working.

**How to apply:** One line in [index.css](../../../apps/web/src/index.css) `@layer base` or in `:root`: `color-scheme: light dark;`. Optionally pair with `.dark { color-scheme: dark; }` for explicit override.

**Effort:** ~5 min. Folds into Bundle A or ships standalone.

### Gap 7 — Container queries unused (0 sites across 509 ts/tsx files)

**Current state:** `ugrep -r "@container|container-type|cqi"` returns zero hits. All responsive layout in the app is viewport-keyed via Tailwind breakpoint utilities (`md:`, `lg:`, etc.).

**KB floor:** `01-css-and-styling.md` §2.2 — container queries are Newly Available since Sept 2023, supported in Chrome 105+ / Safari 16+ / Firefox 110+ (~95% global). "Viewport breakpoints describe a page; container queries describe a component." For a component-heavy product where the same `MatchCard` or `ChampionCard` is dropped into varying parent widths (profile vs. account-list vs. modal), container queries are the architectural fit.

**Why it matters:** The component-driven shape of this codebase (match cards, chart panels, profile blocks reused across surfaces) is the exact case the feature exists for. Viewport breakpoints force the same component to "look right at 1280px" rather than "look right when the column I'm in is 28rem wide." This is the dominant cause of subtle layout breakage when a component is reused in a new context (e.g. a future TFT match card placed in a denser grid).

**Tension with Start:** None.

**How to apply:** Land on one concrete case first — proposed: match-card switching to single-column when the parent column is narrow (e.g. when shown in a future side-by-side compare view). Add `container-type: inline-size` + named container on the parent grid, write the @container rule. Don't bulk-convert; let it prove itself first.

**Effort:** ~1h for one demonstrable case + a working-note entry establishing the pattern. Sub-session.

### Gap 8 — Three charting stacks, no decision tree

**Current state:** Recharts in 12 files (e.g. `MatchGoldLead`, `TrendKda`, `MatchLanePhase`), `@visx/*` in 11 files (chord, brush, heatmap, sankey, hexbin scales), `d3-hexbin`/`d3-sankey` directly in 2 files. All three carry independent D3 dependency trees.

**KB floor:** No KB rule against multi-library charting — Recharts and visx serve different needs (Recharts: high-level declarative chart components; visx: low-level composable primitives where Recharts can't reach; d3-*: shape-specific layouts).

**Why it matters:** The library footprint is justified per-case, but there's no written rule for "when do I reach for which?" — meaning the next chart added uses whichever was top of mind. Over time this drifts toward inconsistent chart styling (axis treatment, tooltip behavior, color tokens) across the dashboard.

**Tension with Start:** None.

**How to apply:** Add a decision-tree section to [library-shortlist.md](library-shortlist.md): Recharts for standard chart shapes (line/bar/area/composed); visx when you need a primitive layout Recharts doesn't ship (chord, brush, heatmap, custom hexbin); d3-* only as visx auxiliary or for one-off layouts. Document one shared theming source (the OKLCH `--chart-1`..`--chart-5` tokens) and require new charts to pull from it.

**Effort:** ~30 min docs only, no code. Sub-session.

### Gap 9 — Mixed Radix import style (umbrella + scoped)

**Current state:** 103 files import via scoped packages (`@radix-ui/react-tooltip`, `@radix-ui/react-dialog`, etc.); 4 files import via the umbrella metapackage (`import { Slot } from "radix-ui"` in [button.tsx](../../../apps/web/src/components/ui/button.tsx#L2) and [breadcrumb.tsx](../../../apps/web/src/components/ui/breadcrumb.tsx#L1); similar in `separator.tsx`, `select.tsx`). Both `radix-ui` (umbrella) and 5 individual `@radix-ui/react-*` packages are in [package.json](../../../apps/web/package.json) dependencies.

**KB floor:** No direct KB rule, but `07-build-tooling.md` covers treeshaking ergonomics — duplicate dependency entries with overlapping graphs are the typical source of "why is this transitive in my bundle twice."

**Why it matters:** The umbrella `radix-ui` package re-exports the individual primitives; treeshaking generally avoids double-bundling, but having both makes the dependency graph harder to reason about and adds a Tier-2 indirection step (umbrella → individual). The 4 umbrella sites came from shadcn templates that ship with the umbrella pattern; new code in this repo standardized on scoped imports.

**Tension with Start:** None.

**How to apply:** Migrate the 4 umbrella sites to scoped imports — `@radix-ui/react-slot`, `@radix-ui/react-separator`, `@radix-ui/react-select` (already in package.json or add). Remove `radix-ui` from dependencies. Verify with `pnpm verify:cc`.

**Effort:** ~20 min. Sub-session.

### Round 2 bundling

| Bundle | Gaps | Effort | Slot |
|---|---|---|---|
| **F — `color-scheme` + container-query pilot** | #6, #7 | ~1h | Ship now, can fold into Bundle A commit |
| **G — Charting decision tree (docs)** | #8 | ~30 min | Ship anytime; docs-only |
| **H — Radix import consolidation** | #9 | ~20 min | Ship now, separate commit |

### Round 2 non-gaps (worth knowing, no action)

- **Test coverage** — 220 test files across 509 source files (~43%) with vitest threshold at 93% in [vite.config.ts:72](../../../apps/web/vite.config.ts#L72). KB §10 floor is met or exceeded.
- **`light-dark()` adoption** — current class-based dark mode works; switching would collapse the two `:root` blocks but loses nothing functional. Defer unless [color-scheme] gets revisited.
- **`tw-animate-css` + Motion coexistence** — 36 files use `animate-in`/`fade-in`/etc. classes from `tw-animate-css`; 159 use Motion. Clean split: tw-animate-css for dialog/popover enter-exit conventions shipped by shadcn; Motion for richer choreography. Worth a one-liner in [motion-backlog.md](motion-backlog.md) so contributors don't reach for the wrong one.

---

## Round 3 — CSS architecture + head/meta deep sweep (2026-05-23)

Audit focus: stylesheet structure ([apps/web/src/index.css](../../../apps/web/src/index.css)) and [apps/web/index.html](../../../apps/web/index.html) against `01-css-and-styling.md` §2 (cascade layers, subgrid, scope) and `13-seo.md` §2-3 (head baseline beyond OG). All five gaps below were missed by Rounds 1–2.

### Gap 10 — No `@layer` cascade layers; custom styles override Tailwind silently

**Current state:** `index.css` imports Tailwind, tw-animate-css, and shadcn at the top, then declares custom CSS (keyframes, `.item-tooltip-body` rules, scrollbar styling, root tokens) outside any `@layer`. Unlayered styles win over anything in a named layer, so handwritten CSS quietly beats Tailwind utilities at equal specificity.

**KB floor:** `01-css-and-styling.md` §2.1 — `@layer reset, base, components, utilities` is the 2026 default. Tailwind v4 already ships its styles inside named layers; user styles outside `@layer` are an implicit override the next contributor won't expect.

**Why it matters:** When `text-wrap: pretty` lands on `p` in globals (per [quick-wins.md](quick-wins.md)) and a Tailwind utility on a specific `<p>` should override it, the unlayered global wins. Same for `@keyframes` name collisions and any future component-scoped style.

**Tension with Start:** None.

**How to apply:** Wrap the existing custom declarations in `@layer base { ... }` (root tokens, keyframes, scrollbar styles) and `@layer components { ... }` (item-tooltip-body donut). One edit, mechanical.

**Effort:** ~20 min. Sub-session.

### Gap 11 — Subgrid unused (0 hits across the app)

**Current state:** `ugrep -r "subgrid"` returns zero hits. Card grids and stat rows use independent grids per row, which forces width gymnastics to align columns across cards.

**KB floor:** `01-css-and-styling.md` §2.3 — subgrid is Baseline 2023 (Safari 16, Chrome 117, Firefox 71). Inherits parent track sizing into a nested grid; lets a row of cards share column gutters with the page grid without duplicating the column definitions.

**Why it matters:** The match-card grid is the obvious case — the timestamp/champion/score/KDA columns currently rely on hard min-widths. With `grid-template-columns: subgrid` on the card, every card aligns to the outer page grid for free, and the columns collapse in lockstep on narrow viewports.

**Tension with Start:** None.

**How to apply:** Pilot on match-list card rows. Define the outer grid columns on the list container, set `grid-template-columns: subgrid` on each card's grid. Don't bulk-convert; demonstrate the pattern once and reference it from [repo-conventions.md](../../repo-conventions.md).

**Effort:** ~1h for the pilot + working-note entry. Sub-session.

### Gap 12 — `@scope` donut for `.item-tooltip-body` descendant rules

**Current state:** [index.css:78-118](../../../apps/web/src/index.css#L78) carries descendant rules (`.item-tooltip-body img`, `.item-tooltip-body strong`, `.item-tooltip-body em`, `.item-tooltip-body keyword`) — textbook descendant selector tooltip styling.

**KB floor:** `01-css-and-styling.md` §2.5 — `@scope (.item-tooltip-body)` scopes following rules to descendants of the root and clips the cascade. Same semantics as descendant selectors but lower specificity and explicit boundary; pair with `@scope (.x) to (.y)` for donut shapes.

**Why it matters:** The current descendant rules style any `<strong>` anywhere inside an item-tooltip-body, including nested tooltips or future rich-description embeds. `@scope` with a `to` boundary stops bleed at e.g. a nested `.tooltip-quote` block.

**Tension with Start:** None.

**How to apply:** Convert the four `.item-tooltip-body X` rules to one `@scope (.item-tooltip-body) { ... }` block. Add a `to (.tooltip-quote)` boundary if/when richer tooltips land.

**Effort:** ~15 min. Sub-session. Pair with Gap 10.

### Gap 13 — Head baseline extras beyond OG (preconnect, preload, font-size-adjust, JSON-LD)

**Current state:** Gap #1 covers description / OG / theme-color / robots / sitemap. Three further baseline items missed:

1. **`<link rel="preconnect">` for the API origin** — every page makes API calls; the TCP+TLS handshake fires on first request rather than at HTML parse time.
2. **`<link rel="preload" as="font">` for the Geist variable font** — `@fontsource-variable/geist` is loaded via CSS `@font-face` from `_imports`, so the browser discovers it after first paint. Preload moves it to the document head.
3. **JSON-LD `Person` schema in `index.html`** — `13-seo.md` §3 — recruiters' AI tooling reads structured data; for a personal portfolio, a single `<script type="application/ld+json">` with `Person`, `jobTitle`, `url`, `sameAs` is the highest-leverage SEO addition for a one-owner site.

`font-size-adjust: 0.5` on `html` is a fourth small win — prevents fallback-font-swap layout shift if the variable font load is slow.

**KB floor:** `13-seo.md` §2-3 and `06-performance.md` §1.3.

**Tension with Start:** None — all four ride in static `index.html`.

**How to apply:** Add to [index.html](../../../apps/web/index.html) at the same time as Gap #1's bundle.

**Effort:** ~20 min on top of Bundle A. Sub-session.

### Round 3 non-gap: weird-for-2026 patterns to clean opportunistically

These aren't blocking gaps — they work today — but they read as odd to a 2026 reviewer and are cheap to fix when the file is open for other reasons. Not worth a dedicated commit each; fold into the next edit touching the same file.

- **`@theme` declared twice** — [index.css:13](../../../apps/web/src/index.css#L13) and [index.css:137](../../../apps/web/src/index.css#L137). Consolidate to one block.
- **Doubled scrollbar styling** — both `scrollbar-color` / `scrollbar-width` (standard) and a full `*::-webkit-scrollbar` block ([index.css:255](../../../apps/web/src/index.css#L255)). All supported engines ship the standard properties in 2026; the webkit pseudo-elements are redundant. Drop the webkit block.
- **`shadcn` CLI in `dependencies`** — [package.json:50](../../../apps/web/package.json#L50). It's a CLI tool used at install/scaffold time only; belongs in `devDependencies`. Ships in the runtime bundle resolution graph as-is.
- **`@import "shadcn/tailwind.css"`** — non-standard import path. Confirm whether this resolves to anything used (shadcn CLI doesn't publish a `tailwind.css` export); if not, drop the import.

### Round 3 bundling

| Bundle | Gaps | Effort | Slot |
|---|---|---|---|
| **I — `@layer` + `@scope` cleanup** | #10, #12 | ~35 min | Ship now, single commit |
| **J — Subgrid pilot on match-list** | #11 | ~1h | Ship now, separate commit |
| **K — Head baseline extras** | #13 | folds into A | Ship with Bundle A |
| **L — Weird-for-2026 cleanups** | (non-gap) | opportunistic | Fold into next edit touching index.css / package.json |

---

## Round 4 — realtime / state / forms pass (2026-05-23)

Audit focus: `15-realtime-state-forms.md` against the project's current state-management, realtime, and forms usage. Surfaced from the KB refresh session tracked in [frontend-2026-kb-refresh-queue.md](frontend-2026-kb-refresh-queue.md). Most §15 slots map to "no change, document the rationale" — captured in [library-shortlist.md § State / realtime / forms](library-shortlist.md) — but one ship-now item:

### Gap 14 — TanStack Query `staleTime` per-query overrides for static patch-keyed metadata — SHIPPED 2026-05-23

Largely already in place from the LoL static-metadata arc (2026-05-21); the audit's "zero per-query overrides exist" assertion was wrong. Most patch-keyed hooks (`useLolStatic` bundle, `useRankedEmblemYear`, `useDDragonVersion`, `useAbilityDescription`, `useMatchDetail`, `useMatchTimeline`) were already at `staleTime: Number.POSITIVE_INFINITY`. The one remaining patch-keyed-immutable hook still at the global 60s default — [usePatchChanges](../../../apps/web/src/lol/patches/use-patch-changes.ts) (PN3 patch-notes tab) — was switched in `perf: pin per-version patch changes query to staleTime infinity` (c68026a). `usePatchList` and `useCurrentPatchChanges` are intentionally left at 60s because they shift when a cron detects a new patch — Infinity would mask that.

**Current state:** [apps/web/src/main.tsx:43-55](../../../apps/web/src/main.tsx#L43-L55) sets a sensible global default (`staleTime: 60_000`, `refetchOnWindowFocus: false`, retry policy with 4xx short-circuit). However, zero per-query overrides exist anywhere in `apps/web/src` — every query inherits the 60s default, including static metadata families that change only with a patch bump.

**KB floor:** `15-realtime-state-forms.md` §2.1 — "the project-wide `staleTime` (default `0` is wrong for almost every app — pick 30s–5min based on the data shape)". The follow-on guidance: per-query overrides for data classes that diverge from the global default.

**Why it matters:** Static metadata families in this app — champion id↔name bundle, item descriptions, ability descriptions, rune/spell metadata, rank emblems — all carry the current patch version in their cache key (LoL static-metadata arc shipped 2026-05-21). The cache key changes if and only if the patch changes. With the global 60s default these queries silently re-fetch on every tab focus / route revisit after 60s, even though the data is provably unchanged until the next patch.

For patch-stable data, `staleTime: Infinity` (or a multi-hour value paired with `gcTime`) is the honest setting — the cache key carries the freshness invariant; `staleTime` should match.

**Tension with Start:** None. Per-query overrides survive the SSR loader migration unchanged; loaders prime the cache with the same query options.

**How to apply:** One commit. Identify the static-metadata query hooks (likely in `apps/web/src/lol/champions/`, `apps/web/src/lol/items/`, `apps/web/src/lol/_shared/`) and add `staleTime: Infinity` to their `useQuery` configs. Spot-check one route's network panel before/after — the focus-refetch on these queries should disappear. Reference: KB §2.1 advice on per-query overrides for data with diverging staleness.

**Effort:** ~30 min including audit + verify pass. Sub-session.

### Round 4 bundling

| Bundle | Gaps | Effort | Slot |
|---|---|---|---|
| **M — Static metadata `staleTime: Infinity`** | #14 | ~30 min | SHIPPED 2026-05-23 (c68026a); most hooks were already pinned by the 2026-05-21 static-metadata arc |

### Round 4 non-gaps (worth knowing, no action)

- **No client-state library needed.** Zustand / Jotai / Valtio / Legend-State all parked with explicit triggers — see [library-shortlist.md § State / realtime / forms](library-shortlist.md). React state + Context (`SplashProvider`, `CommandPaletteProvider`) covers the app today; no surface has hit the "persisted + cross-component + selector-shaped state" threshold.
- **No form library needed yet.** No client forms exist. Upcoming form-shaped surfaces (status-page admin POST buttons, owner-auth OAuth redirect) are single-button or redirect flows, not form-library territory. Pick is **react-hook-form + zod** when the first ≥3-field validated surface lands; TanStack Form deferred to "2+ surfaces would benefit."
- **No sync engine needed.** Convex / Zero / Triplit / Jazz / InstantDB / ElectricSQL / TanStack DB all parked. Riot/Steam APIs are server-truth; the read-only-portfolio framing has no offline-first stakes. Triggers to reconsider: offline-first becomes a requirement, multi-user shared-state surface lands, or collaborative annotations.
- **SSE for [live-presence-chip.md](live-presence-chip.md) is the right call.** Already cited in the plan; reaffirmed against KB §1.2. WebTransport (now Baseline as of April 2026) is overkill for one-way presence push — SSE wins on simplicity.

---

## Round 5 — frameworks pass (2026-05-23)

Audit focus: `05-frameworks.md` against the project's TanStack Router / Vite SPA shape. The structural framework-choice question (SPA → SSR via TanStack Start) is already owned by [tanstack-start-migration.md](tanstack-start-migration.md) — Round 5 does **not** re-litigate it. Instead it audits the project's adoption of the TanStack Router idioms the KB rubric calls out as best-in-class: typed search params (strong adoption, no gap), route loaders (zero adoption, Gap 15), per-route `head()` for SEO (one site, Gap 16). Both ship-now gaps are migration-safe — they are exactly the surfaces the eventual Start migration will lift, so doing them now de-risks the migration rather than creating throwaway work.

### Gap 15 — Route loaders are unused; every route does render-then-fetch via Query hooks

**Current state:** `ugrep -F 'loader:' apps/web/src/routes/ -r` returns **zero hits** across all 20+ route files. Every route component mounts and then triggers its `useQuery` hooks on render, producing a render-then-suspend waterfall on cold navigation. [apps/web/src/main.tsx:30-34](../../../apps/web/src/main.tsx#L30-L34) sets `defaultPreload: "intent"` which prefetches the **route chunk** on link hover, but does not prime the **data** — the chunk arrives early, then the component still has to wait for its queries on click.

**KB floor:** `05-frameworks.md` §1.2 (TanStack Router scoring) — loaders are the "best-in-class" framework idiom that pairs with TanStack Query: a route's loader calls `queryClient.ensureQueryData(...)` before the component renders, so the cache is primed at the moment of render and the first paint contains data instead of a skeleton. This is the single biggest perceived-perf win available in TanStack Router SPA mode.

**Why it matters:** Cold navigation to `/lol/$accountSlug/matches/$matchId` mounts the layout, then the match-detail query fires, then the timeline query fires — three sequential round-trips before the first useful pixel. With `defaultPreload: "intent"` already on, adding a loader means the data round-trip overlaps the chunk load on hover, so by the time the user clicks the data is already in cache. The skeleton-loader convention (per `repo-conventions.md`) papers over this latency but doesn't remove it.

**Tension with Start:** None — loaders are the **exact migration target** for chunk 4 of [tanstack-start-migration.md](tanstack-start-migration.md) ("loaders on /lol and /steam"). Shipping them now in SPA mode is forward-compatible: the same `Route.loader` signature works in Start, where it just runs server-side instead of client-side. This is one of the cheapest forms of migration de-risking available.

**How to apply:** One pilot commit, not a full sweep. Pick the highest-traffic detail route ([apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx](../../../apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx)) and add:

```ts
loader: async ({ params, context: { queryClient } }) =>
  queryClient.ensureQueryData(matchDetailQueryOptions(params.accountSlug, params.matchId)),
```

This requires (a) wiring `queryClient` into router `context` in [main.tsx](../../../apps/web/src/main.tsx) (`createRouter({ ..., context: { queryClient } })`), and (b) refactoring the existing `useMatchDetail` hook to expose a `queryOptions`-style factory so the loader and the component share one definition. Verify with the Network panel: cold click from match-list should show the match-detail XHR firing on hover (preload) rather than after navigation.

If the pilot lands cleanly, fan out in follow-up commits — one per route family (`matches`, `champions`, `patches`, `steam/game`). Do **not** add loaders to index/list routes that already render fast with cached parent data; the win is on detail routes with new queries.

**Effort:** Pilot ~1h including the `queryOptions` refactor. Per-route fan-out ~20–30 min each. Total domain: ~3–4h split across 4–5 commits.

### Gap 16 — Per-route `head()` exists at exactly one site, and it ships `http://localhost:2010` in production

**Current state:** [apps/web/src/routes/__root.tsx:49](../../../apps/web/src/routes/__root.tsx#L49) renders `<HeadContent />`, so per-route `head()` exports are already wired into the render pipeline — but only **one** route uses it: [apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx:35-55](../../../apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx#L35-L55). And that one site has a production bug — line 31 hardcodes `const API_URL = "http://localhost:2010"`, so the `og:image` and `twitter:image` URLs shipped to social-preview crawlers in production are unreachable `localhost` URLs.

Every other route (`/lol/$accountSlug`, `/lol/$accountSlug/champions/$championKey`, `/steam/game/$appid`, `/lol/patches/$version`, etc.) inherits only the static `<title>vyoh.gg</title>` and the generic site description from [apps/web/src/index.html](../../../apps/web/src/index.html). A link to a specific champion or game shared in Discord/Slack/Twitter shows the homepage preview, not the page's content.

**KB floor:** `05-frameworks.md` §13 ("Per-route SEO floor") — every shareable route should override title, description, and (when an OG image pipeline exists) og:image. The static `index.html` head is the fallback for routes that genuinely don't have unique content; deep routes that **do** must override.

**Why it matters:** The OG image pipeline ([docs/working-notes/cross-cutting/og-image-pipeline.md](og-image-pipeline.md)) shipped images for matches but the per-route `head()` adoption stopped at one route. Owner-shaped portfolio framing means social-preview cards are a primary discovery surface — a champion-detail link in a freelance pitch should show that champion's name + role + last-played, not "vyoh.gg / Personal cross-platform gaming dashboard".

The `localhost` bug is the more urgent half: it's a one-line fix and any production share of a match URL right now ships a broken preview.

**Tension with Start:** None — `head()` exports are identical between Router SPA and Start. In Start, the head also influences the SSR document; in SPA mode it mutates the client `<head>` after hydration (still picked up by crawlers that execute JS, and by some that don't with the right SSR posture later). Shipping `head()` per-route now is the structural prep for the Start migration's chunk 2 ("per-route metadata").

**How to apply:** Two commits.

1. **Fix the localhost bug.** Replace `const API_URL = "http://localhost:2010"` with a resolution that reads `import.meta.env.VITE_API_URL` (or `window.location.origin` if API is same-origin in production via reverse proxy). Confirm by running `pnpm build && pnpm preview` and inspecting the rendered `<head>` for the match route — `og:image` must be the production URL.
2. **Fan out `head()` to the remaining deep routes.** Per route, derive title/description from the loader-primed data (matches Gap 15 nicely — loader primes the query, `head()` reads the cache). Champion-detail uses champion display name; game-detail uses game title from Steam; patch-detail uses patch version + headline change count. Use the existing OG image pipeline for og:image where one exists; fall back to the static favicon for routes without a per-page image.

Order the work after Gap 15's pilot so the loader-primed cache is available to `head()` synchronously. Without a loader, `head()` runs before the query resolves and can't read the data — you'd have to derive titles from URL params only (still better than nothing for the localhost-bug commit).

**Effort:** Bug fix ~15 min. Fan-out ~20 min per route family × 4–5 = ~2h. Total: ~2.5h.

### Round 5 non-gaps (worth knowing, no action)

These are strong-adoption signals confirming the framework pick is correctly used today:

- **Typed search params are strongly adopted.** Six routes use `validateSearch` (`$accountSlug.tsx`, `champions/index.tsx`, `patches/index.tsx`, `patches/$version.tsx`, `steam/wishlist.tsx`, `steam/game.$appid.tsx`); nine files call `useSearch`. This is the single biggest reason to pick TanStack Router per KB §1.2, and the project genuinely uses it — not a gap.
- **React Compiler 1.0 is wired.** [apps/web/vite.config.ts](../../../apps/web/vite.config.ts) loads `babel-plugin-react-compiler` via `reactCompilerPreset()`, satisfying KB §05 → §03 reference for React 19 + Compiler adoption.
- **Route-chunk prefetch on intent is on.** [main.tsx:30-34](../../../apps/web/src/main.tsx#L30-L34) sets `defaultPreload: "intent"`. This is necessary but not sufficient (Gap 15 covers the data half).
- **`<HeadContent />` is already mounted.** [__root.tsx:49](../../../apps/web/src/routes/__root.tsx#L49) renders it, so Gap 16's fan-out has zero infra cost — just add `head:` exports.
- **Structural framework-choice question is parked correctly.** TanStack Start migration sits in [tanstack-start-migration.md](tanstack-start-migration.md) gated on pre-launch; Next.js / React Router 7 / Astro / Waku are documented in [library-shortlist.md § Framework](library-shortlist.md) with their rejection rationale.

### Round 5 bundling

| Bundle | Gaps | Effort | Slot |
|---|---|---|---|
| **N — Route loader pilot on match-detail** | #15 (pilot) | ~1h | Ship now, single commit |
| **O — `head()` localhost bug fix** | #16 (part 1) | ~15 min | Ship now, single commit (independent of N) |
| **P — Loader fan-out + `head()` fan-out** | #15 (rest), #16 (part 2) | ~5h | Multi-commit sub-arc; order after N + O land |
