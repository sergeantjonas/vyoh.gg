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

**How to apply:** Two commits, but the first is gated on the hosting decision — not shippable in isolation.

1. **Fix the localhost bug** as part of the hosting pre-deploy sweep (see [hosting.md § Pre-deploy checklist #1](../ops/hosting.md)). The hardcoded `const API_URL = "http://localhost:2010"` is **duplicated across 20+ sites** in `apps/web/src/` (every query hook in `home/`, `steam/`, `lol/matches/`, `lol/champions/`, plus the SSE `EventSource` URL — not unique to the `head()` site), so a one-file replace would leave the broader inconsistency. The fix shape also depends on hosting Option A/B (separate api.vyoh.gg → absolute env var) vs Option C (same-origin reverse-proxy → relative paths + Vite dev proxy). Don't pre-decide.
2. **Fan out `head()` to the remaining deep routes.** Independent of #1 — does not need the localhost bug fixed first since it only adds new `head()` exports, doesn't touch the existing buggy one. Per route, derive title/description from the loader-primed data (matches Gap 15 nicely — loader primes the query, `head()` reads the cache). Champion-detail uses champion display name; game-detail uses game title from Steam; patch-detail uses patch version + headline change count. Use the existing OG image pipeline for og:image where one exists; fall back to the static favicon for routes without a per-page image.

Order the work after Gap 15's pilot so the loader-primed cache is available to `head()` synchronously. Without a loader, `head()` runs before the query resolves and can't read the data — you'd have to derive titles from URL params only.

**Effort:** Localhost bug fix is part of the hosting sweep (~1–2h once hosting is picked, not a standalone quick-win). Fan-out ~20 min per route family × 4–5 = ~2h. Total: ~2h fan-out + hosting-sweep dependency for the bug.

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
| **O — `head()` localhost bug fix** | #16 (part 1) | hosting-gated | Land as part of [hosting.md § Pre-deploy #1](../ops/hosting.md) — 20+ duplicate API_URL sites + hosting-shape dependency means this isn't a standalone quick-win |
| **P — Loader fan-out + `head()` fan-out** | #15 (rest), #16 (part 2) | ~5h | Multi-commit sub-arc; can order after N alone (independent of O) |

---

## Round 6 — build-tooling pass (2026-05-23)

Audit focus: `07-build-tooling.md` against the project's Vite 8 / pnpm 11 / Biome 1.9 / SWC stack. Headline finding: the bundler stack is already best-in-class for 2026 (Vite 8 + Rolldown + `@rolldown/plugin-babel` for the React Compiler — the **Rolldown-native** plugin, not the Rollup one). The gaps are all on the **periphery** of the build: lint/format is one major behind, the monorepo's duplicate version pins have no catalog, and tree-shaking annotations are absent on the workspace package that every web import chain passes through.

### Gap 17 — Biome on 1.9.4; Biome 2.x has been the stable line for ~11 months

**Current state:** [package.json:26](../../../package.json#L26) pins `@biomejs/biome ^1.9.4`. Latest on npm is **2.4.15** (Biome 2.x line, first released mid-2025; 2026 has been a year of 2.x point releases). The repo is two majors behind on its lint+format slot.

**KB floor:** `07-build-tooling.md` calls out **oxc / oxlint challenging Biome on the lint+format slot** as a refresh axis. The reason that comparison is fresh in 2026 is that Biome 2.x closed the gap that made oxlint look attractive (multi-file analysis, type-aware lints via the new domain system, plugin API via GritQL). Staying on 1.x forfeits all of those — and produces the wrong baseline for the "should we add oxlint?" comparison, because the project would be comparing oxlint against a Biome line that is no longer the state of the art.

**Why it matters:** Biome 2.x's most load-bearing 2026 additions for this codebase shape:

- **Domains** — let you scope rule strictness per package without per-directory `overrides` arrays. Useful here because [biome.json:31-46](../../../biome.json#L31-L46) already has an `apps/api/**` override block that exists only to disable `useImportType` for Nest decorator metadata. Domains express that intent natively.
- **Multi-file analysis** — catches dead exports across barrel files. Directly relevant: `packages/shared/src/index.ts` (163 lines, pure re-exports). A 1.x lint cannot tell you which of those 60+ re-exports are unused; 2.x can.
- **GritQL plugin API** — lets you write project-specific lints in declarative form. Not load-bearing today, but it's the path forward for codifying the conventions in [`docs/repo-conventions.md`](../repo-conventions.md) as lints (e.g. "clickable element without `cursor-pointer`", "tooltip without `TooltipPrimitive`").

**Tension with Start:** None — Biome is unrelated to the TanStack Start migration.

**How to apply:** One commit. `pnpm add -DEw @biomejs/biome@^2` at the workspace root, then `pnpm biome migrate --write` to auto-translate `biome.json` to the 2.x schema. Update the `$schema` URL in [biome.json:2](../../../biome.json#L2). Re-run `pnpm check:cc`; address any new findings (expected: a handful of import-sort changes from the overhauled organizer, plus possibly some multi-file dead-export findings on `packages/shared/src/index.ts` worth keeping or annotating). Bump the `--max-diagnostics` flag in `check:cc` if the first run floods.

**Effort:** ~45 min including migrate + verify pass + handling whatever new findings 2.x surfaces.

### Gap 18 — No pnpm catalogs despite duplicate version pins across all three workspaces

**Current state:** [pnpm-workspace.yaml](../../../pnpm-workspace.yaml) has `packages:`, `overrides:`, `allowBuilds:` blocks but **no `catalogs:` block**. The repo runs pnpm 11.1.1 (latest 11.2.2 — catalogs supported since pnpm 10). Duplicate version pins in `package.json` files today:

- `vitest ^4.1.5` in [apps/web](../../../apps/web/package.json#L77), [apps/api](../../../apps/api/package.json#L52), [packages/shared](../../../packages/shared/package.json#L17)
- `@vitest/coverage-v8 ^4.1.6` in the same three sites
- `@types/node ^24.12.2` in [apps/web](../../../apps/web/package.json#L64) and [apps/api](../../../apps/api/package.json#L46)
- `prisma` + `@prisma/client` + `@prisma/adapter-pg` all `^7.8.0` — split across api dev/runtime, will drift if bumped separately
- `react` + `react-dom` `^19.2.5` and `@types/react` + `@types/react-dom` `^19.2.x` — currently single-site (web only) so not a catalog candidate today, but becomes one the moment a second package needs React

**KB floor:** `07-build-tooling.md §5.1` describes `pnpm-workspace.yaml` catalogs as "the 2026 default for serious monorepos" — quote: *"Bumping the version touches one file, not N. Eliminates the merge conflict noise on dep bumps that dominates large monorepos."*

**Why it matters:** A vitest 4.1.5 → 4.2 bump touches three `package.json` files today. The next session is one forgotten file away from a partial bump (web on 4.2, api on 4.1) that ships green tests in CI on the upgraded site and silently leaves the other on a stale runtime. The cost of this happening once is more than the 30 minutes catalogs takes to wire.

The freelance-positioning angle in [CLAUDE.md](../../../CLAUDE.md) calls out "perf/build/migration specialist" — pnpm catalogs are the cheapest concrete signal of "this engineer knows monorepo hygiene" available, and they are completely invisible from the rendered app.

**Tension with Start:** None.

**How to apply:** One commit. Add to [pnpm-workspace.yaml](../../../pnpm-workspace.yaml):

```yaml
catalogs:
  vitest4:
    vitest: ^4.1.6
    "@vitest/coverage-v8": ^4.1.6
  tooling:
    "@types/node": ^24.12.2
```

Then in each `package.json` replace the pin with `"vitest": "catalog:vitest4"`. Run `pnpm install --no-frozen-lockfile` to refresh the lockfile. Verify `pnpm verify:cc` still passes. Defer the React catalog and the Prisma catalog until a second package needs them — premature catalogs are noise.

**Effort:** ~30 min including verify.

### Gap 19 — `@vyoh/shared` is a pure re-export barrel with no `sideEffects: false` declaration

**Current state:** [packages/shared/package.json](../../../packages/shared/package.json) is `"type": "module"` with `exports` pointing at source `.ts` files (the modern "source-as-published" workspace pattern, fine for private consumption) — but **no `sideEffects` field**. The barrel file [packages/shared/src/index.ts](../../../packages/shared/src/index.ts) is 163 lines of pure re-exports across 25+ leaf modules: every formatter, every type, every LoL/Steam/home stat helper.

**KB floor:** `07-build-tooling.md §3.2` ("What kills tree shaking") explicitly calls out **re-export chains through barrel files without `sideEffects: false`** as one of the four primary tree-shake killers. Quote: *"The bundler must execute the barrel to know what it does, which usually pulls every sub-module."* Same section §3.3: *"Use an array (`"sideEffects": ["*.css", "./src/polyfills.ts"]`) when only specific files have side effects."* — `@vyoh/shared` has zero side-effect modules, so a flat `false` is the right call.

**Why it matters:** Today every import like `import { formatGold } from "@vyoh/shared"` forces Rolldown to conservatively pull every other re-exported leaf (`computeTiltStats`, `parseMatchQuery`, every Steam type module, etc.) into the dependency graph until proven unused. Rolldown's static analysis is good enough that most of this gets eliminated in the final bundle, but the work happens at build time and the "what's actually being kept" reason chain is harder to reason about with `vite-bundle-visualizer`. The fix is one line; the win is structural correctness of the tree-shake graph.

This is also a setup gap for a future change: if `@vyoh/shared` ever grows a true side-effectful module (a polyfill, a `globalThis` mutation, an `import './styles.css'`), the safe path is `"sideEffects": ["./src/the-one-with-side-effects.ts"]` — but only if the package starts from `false` as the baseline. Adding `false` now is the cheapest possible insurance.

**Tension with Start:** None — `sideEffects` is a build-graph concern, not a runtime one. The Start migration doesn't change how the shared package is consumed.

**How to apply:** One line. Add `"sideEffects": false` to [packages/shared/package.json](../../../packages/shared/package.json) immediately after `"type": "module"`. Re-run `pnpm --filter @vyoh/web build` and confirm bundle size doesn't regress (it should drop slightly or stay flat — never increase, because the annotation only ever relaxes inclusion). Optional: also add `"sideEffects": false` to [apps/web/package.json](../../../apps/web/package.json) — it's an app not a library, but the annotation costs nothing and removes ambiguity if any internal helper file ever gets re-imported by another package down the road.

**Effort:** ~5 min including verify. This is a quick-win candidate (added to [quick-wins.md](quick-wins.md) in the same sweep).

### Round 6 non-gaps (worth knowing, no action)

These are strong-adoption signals confirming the build stack is correctly modern:

- **Vite 8.0.10 with Rolldown is fully adopted.** [apps/web/package.json:76](../../../apps/web/package.json#L76) is pinned `^8.0.10`. The `@rolldown/plugin-babel` package ([line 57](../../../apps/web/package.json#L57)) for the React Compiler is the **Rolldown-native** plugin, not the Rollup version — this is the correct choice for Vite 8 and the project picked it without an explicit nudge. KB §1.2 calls Vite 8 + Rolldown the defining 2026 release; vyoh is on it.
- **TanStack Router auto code splitting is on.** [apps/web/vite.config.ts:29](../../../apps/web/vite.config.ts#L29) sets `autoCodeSplitting: true`. KB §8.1 puts route-level splitting as the top default for any SPA.
- **Manual code-split annotations exist where they matter.** [apps/web/src/main.tsx:28](../../../apps/web/src/main.tsx#L28) lazy-loads `sonner` (toaster used post-mount). [apps/web/src/components/command-palette.tsx:4](../../../apps/web/src/components/command-palette.tsx#L4) lazy-loads the dialog body so `cmdk` doesn't ship in the initial chunk. [apps/web/src/lol/matches/match-event-timelines.tsx:31](../../../apps/web/src/lol/matches/match-event-timelines.tsx#L31) lazy-loads the map overlay. KB §8.3 rule of thumb (>50KB or behind interaction) is being followed.
- **Bundle-size budget is enforced in CI.** [.github/workflows/ci.yml:70-87](../../../.github/workflows/ci.yml#L70-L87) runs `size-limit` on every PR with budgets for the main chunk (200 kB gzip) and the recharts chunk (85 kB gzip). This is the single highest-value CI guardrail for a portfolio site and most projects don't have it.
- **Production audit is gated on `--audit-level=high`** in CI ([.github/workflows/ci.yml:55-68](../../../.github/workflows/ci.yml#L55-L68)). KB doesn't call this out explicitly but it's part of the "honest build" posture.
- **The API uses SWC via `nest build --builder swc`** ([apps/api/nest-cli.json:6](../../../apps/api/nest-cli.json#L6)) and `unplugin-swc` for vitest ([apps/api/vitest.config.ts:5-8](../../../apps/api/vitest.config.ts#L5-L8)) — correct choice for Nest decorator metadata. The `oxc: false` line in vitest.config explicitly opts out of vitest 4's default oxc transformer, which is necessary because oxc doesn't yet emit decorator metadata. This is a deliberate, correct choice; do not "fix" it.
- **Node 22 baseline is set in three places consistently:** [package.json:5-7](../../../package.json#L5-L7) `engines`, [.nvmrc](../../../.nvmrc), and CI's `node-version-file: .nvmrc`. KB §2.3 notes Node 22+'s `require(esm)` unflag is the inflection point for ESM-only adoption — vyoh is on the right side of that line.
- **No browserslist file, and that's fine.** Vite 8 defaults to a baseline-aware target derived from `build.target` (default: `'modules'` = native ESM). For a private app served behind owner-controlled clients, the default is correct and a browserslist file would only add maintenance burden. Setting `build.target: 'baseline-widely-available'` explicitly is a one-line quick-win (added to [quick-wins.md](quick-wins.md)) but not a gap.
- **No Sentry or sourcemap upload pipeline.** Sourcemaps default off in Vite production. Project has no error tracker wired. KB §7 only applies once an error tracker exists; not a gap.
- **`rollup-plugin-visualizer` still works in Vite 8** via Rolldown's Rollup-plugin compat shim ([apps/web/vite.config.ts:7](../../../apps/web/vite.config.ts#L7)). A Rolldown-native bundle visualizer doesn't exist on npm as of this audit (`rolldown-plugin-visualizer` 404, `@rolldown/plugin-bundle-visualizer` 404). Not a gap — keep the Rollup one until a native equivalent ships.

### Round 6 bundling

| Bundle | Gaps | Effort | Slot |
|---|---|---|---|
| **Q — `sideEffects: false` on `@vyoh/shared`** | #19 | ~5 min | Ship now, atomic; pairs with Vite `build.target` quick-win |
| **R — pnpm catalogs for vitest + types/node** | #18 | ~30 min | Ship now, single commit |
| **S — Biome 1.9 → 2.x migration** | #17 | ~45 min | Ship now, single commit; may surface multi-file analysis findings worth a follow-up |

---

## Round 7 — testing pass (2026-05-24)

Audit focus: `10-testing.md` against the project's Vitest 4.1 / happy-dom / jest-axe stack across the three workspaces. Headline finding: the **unit + component tiers are healthy** (309 test files, jest-axe scans, restrained snapshot use, same-commit test hygiene already a stated convention) but the **integration and E2E tiers are missing or shaped wrong**. Network mocking is a hand-rolled `vi.stubGlobal('fetch', …)` pattern reinvented across 20+ files; there is no Playwright surface; there is no visual regression despite a hard project rule that splash-art swaps require side-by-side visual proof ([feedback_splash_visual_parity](../../../home/node/.claude/projects/-workspaces-vyoh-gg/memory/feedback_splash_visual_parity.md)); coverage thresholds gate only `lines`; and the three workspaces' Vitest configs diverge in include patterns in ways that already create silent-skip risk.

### Gap 20 — `vi.stubGlobal('fetch', vi.fn())` pattern reinvented across 20+ test files instead of MSW

**Current state:** 22 test files in [apps/web/src](../../../apps/web/src/) use the same ad-hoc pattern:

```ts
beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); });
// inside test:
vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(sample), { status: 200 }));
```

Reference: [apps/web/src/home/use-home-weekly-totals.test.ts:24-30](../../../apps/web/src/home/use-home-weekly-totals.test.ts#L24-L30) is the canonical shape; the same boilerplate is duplicated across `home/use-home-*`, `lol/matches/use-*`, `lol/profile/use-*`, `lol/champions/use-*`, `lol/patches/use-patch-hooks`, `steam/use-steam-hooks`, `steam/game/use-steam-game-hooks`, `identity/use-me`, `status/use-status` and others. Each file independently constructs `new Response(...)` literals; there is no shared handler set, no `onUnhandledRequest` policy, no contract validation against the real `@vyoh/api` response shape.

**KB floor:** `10-testing.md` §6 — MSW is the 2026 default for both test and dev mocking. **Same handler set runs in jsdom/happy-dom (Vitest), in browser (Service Worker), and in Node (via `@mswjs/interceptors`).** Quote: *"`onUnhandledRequest: 'error'` is the right default — a test that calls an un-mocked endpoint should fail fast, not silently hit prod."* Today every test silently allows arbitrary `fetch` calls because `vi.fn()` returns `undefined` by default — an un-stubbed endpoint just produces a "Cannot read properties of undefined" downstream rather than failing loudly at the network boundary.

**Why it matters:** Three concrete pain points the audit surfaced:

1. **Contract drift is invisible.** Each test hand-writes a `MatchSummary`/`SteamGame`/`PatchHeadline` literal that the test author thought matched the api response. Nothing checks it against the real `@vyoh/shared` schema or the api's NestJS DTO. A future api response-shape change will compile-pass (the response is opaque to the typed client) and unit-test-pass (the literal is what the test wrote), then fail in production. MSW handlers parameterised by Zod schemas (or the existing `@vyoh/shared` types) catch this in the test step.
2. **Re-stubbing across 20+ files is a refactor tax.** When the api's URL base moves from `http://localhost:2010` to a same-origin reverse-proxy path (planned in [hosting.md](hosting.md)), every test that hand-writes `expect(fetch).toHaveBeenCalledWith("http://localhost:2010/home/weekly-totals")` breaks. With MSW, the handler matches `'/home/weekly-totals'` regardless of base URL.
3. **Storybook 9 and Playwright reuse blocked.** When/if Gaps 22 (Playwright) and 23 (Storybook) land, the handler set is the load-bearing reusable artefact. Hand-rolled `vi.stubGlobal` patterns can't be reused; MSW handlers can.

**Tension with Start:** None. MSW is purely a test-time concern; Start migration changes the *server* side, not the test mock surface.

**How to apply:** Two commits.

1. **Adopt MSW with a shared handler set.** Add `msw ^2.14` to [apps/web/package.json](../../../apps/web/package.json) devDeps. Create `apps/web/src/test-mocks/handlers.ts` with default handlers for every api endpoint the web hits — derive response bodies from `@vyoh/shared` types (or Zod-mock if Zod schemas exist; see Gap 30 below). Create `apps/web/src/test-mocks/server.ts` that calls `setupServer(...handlers)`. Wire into [apps/web/src/test-setup.ts](../../../apps/web/src/test-setup.ts) with `server.listen({ onUnhandledRequest: 'error' })` in `beforeAll`, `server.resetHandlers()` in `afterEach`, `server.close()` in `afterAll`.
2. **Migrate the 22 sites file-by-file.** Each migration replaces `beforeEach/vi.stubGlobal` + `vi.mocked(fetch).mockResolvedValue(...)` with `server.use(http.get('/home/weekly-totals', () => HttpResponse.json(sample)))` for the per-test override case. The 200/500/404 path matrix collapses to per-status overrides.

**Effort:** Step 1 ~1h (handler set is mostly derivable from existing test literals — collect them into one file). Step 2 ~2-3h (mechanical migration, ~5-10 min per file × 22 files, often a no-op compared to the existing shape). Total: ~3-4h split across one infra commit + N migration commits, can be done incrementally without churn.

### Gap 21 — No visual regression despite a hard project rule requiring side-by-side visual proof on splash-art swaps

**Current state:** Zero visual-regression coverage anywhere in the repo. No Playwright `toHaveScreenshot()`, no Vitest browser-mode `toMatchScreenshot()`, no Chromatic/Argos/Percy/Lost Pixel integration. The only image-baseline-style test is [apps/web/src/lol/_shared/static/rich-description.snapshots.test.ts](../../../apps/web/src/lol/_shared/static/rich-description.snapshots.test.ts) which does *text* snapshots of sanitiser output — not visual.

The project has an explicit, documented rule that *images* must be visually verified: [feedback_splash_visual_parity](../../../home/node/.claude/projects/-workspaces-vyoh-gg/memory/feedback_splash_visual_parity.md) — *"champion card/backdrop look-and-feel is a hard constraint; any wiki-primary swap on splash art needs side-by-side visual proof before merge."* This is currently enforced by the owner eyeballing the dev server. It is the textbook use case for visual regression.

The surface area that needs this protection is large: [project_unified_image_fallback](../../../home/node/.claude/projects/-workspaces-vyoh-gg/memory/project_unified_image_fallback.md) lists **12 image families** with two upstreams each (wiki-primary + 2-stage fallback). Every one of those is a place a future swap could silently degrade.

**KB floor:** `10-testing.md` §7 ranks five options for visual regression. For a personal portfolio with high visual stakes, no designer-in-loop, willing to git-track PNGs, the right entrant is **Playwright `toHaveScreenshot()`** for full-route diffs and/or **Vitest 4.0 `toMatchScreenshot()`** (browser mode) for component-level. Both are free; baselines live in `__screenshots__/` in git; PR review shows the PNG diff inline. See `10-testing.md` §7 quote: *"For a personal-portfolio repo, Vitest 4's `toMatchScreenshot()` in browser mode or Playwright snapshot tests are sufficient and free."* The new "Testing — evaluated alternatives" section in [library-shortlist.md](library-shortlist.md) carries the full ranking (Chromatic / Argos / Percy / Lost Pixel rejected with rationale).

**Why it matters:** The splash-parity rule is a *hard* rule, not a soft one — owner has called it out as a merge blocker. Today the rule depends on the owner remembering to do the visual comparison; visual regression makes it impossible to merge a regressing change without the diff appearing in PR review. Same logic applies to the 11 other image families — every wiki-primary swap is currently a category of merge-time risk that has no automated check.

**Tension with Start:** None. Visual regression runs against built artifacts or browser-mode component trees; both survive the Start migration.

**Why not Chromatic/Argos/Percy:** All three are SaaS with per-snapshot cost. Their differentiator is the *PR-bound design-review UI* (accept/reject per snapshot, change history, branch-aware approval). vyoh has no designer in the loop and no team — the differentiator is wasted. The free git-tracked PNG path is the right tradeoff for project shape. Full rationale in [library-shortlist.md § Testing — evaluated alternatives](library-shortlist.md).

**Why not Lost Pixel self-hosted:** Self-hosted infra burden is non-zero. The "OSS, repo owns baselines in-tree" angle is met more simply by Playwright/Vitest's in-repo PNG baselines without a separate service.

**How to apply:** Pair with Gap 22 (Playwright adoption). Two commits in sequence:

1. **Land Playwright (Gap 22) first.** That gives the toHaveScreenshot() primitive for free.
2. **Add visual regression on the high-stakes surfaces.** One test per surface: champion-detail header + splash backdrop, profile header backdrop, match-card asset row (items + spells + runes), wishlist tile (Steam capsule art), home synthesis tile. ~6-8 baselines total. The first run writes baselines; subsequent runs diff. Baselines live in `apps/web/tests/__screenshots__/` and are reviewed in PR.

The orthogonal lighter path: **Vitest 4.0 `toMatchScreenshot()` in browser mode** for component-level (no Playwright dependency). Useful if Gap 22 is deferred — same baseline model, scoped to component fixtures rather than real routes. Either path resolves the splash-parity rule; pick based on whether Playwright lands.

**Effort:** ~2-3h after Gap 22 lands (writing the test surfaces + first baselines + PR-review workflow doc). Pure visual-regression with Vitest browser mode (no Playwright) is ~3-4h because the project needs a separate browser-mode project added to vitest config.

### Gap 22 — No E2E tier (Playwright). jsdom/happy-dom cannot test scroll restoration, view transitions, route prefetch, or real focus/layout

**Current state:** Zero Playwright presence. No `@playwright/test`, no `playwright.config.ts`, no `tests/` or `e2e/` directory, no E2E job in [.github/workflows/ci.yml](../../../.github/workflows/ci.yml). All tests run in happy-dom or node.

The architectural patterns in [CLAUDE.md](../../../CLAUDE.md) and [docs/repo-conventions.md](../repo-conventions.md) are explicitly *cross-route* and *real-layout-dependent*:

- **Scroll-to-top layering** (root + section roots, with skip-aware back-restore for list↔detail) — there are unit tests for the `useScrollResetOnNav` hook itself ([apps/web/src/lib/use-scroll-reset-on-nav.test.ts](../../../apps/web/src/lib/use-scroll-reset-on-nav.test.ts)) but no test that the actual cross-section navigation `/lol/x` → `/steam` resets, and no test that the list→detail→back skip works on the match list. These are pure layout behaviour; happy-dom has no scroll engine.
- **View Transitions** ([apps/web/src/lib/view-transition-nav.ts](../../../apps/web/src/lib/view-transition-nav.ts), shipped in commit b94fbec) — happy-dom has no `document.startViewTransition`. The unit test mocks it. The actual transition behaviour cannot be tested without a real browser.
- **Route prefetch on intent** ([apps/web/src/main.tsx:30-34](../../../apps/web/src/main.tsx#L30-L34) — `defaultPreload: 'intent'`) — happy-dom has no hover intent timing or chunk-load behaviour. The feature exists; nothing tests that the prefetch actually fires.
- **SplashProvider + champion backdrop sync** — happy-dom can't render the backdrop image at all (no real image decode).
- **Command palette ⌘K + verb grammar** — there are extensive component tests but no test that the global keyboard shortcut works when focus is inside a Radix Dialog, a Tooltip portal, or another contenteditable region. These differ between happy-dom and Chrome.

**KB floor:** `10-testing.md` §4 — Playwright 1.59 is stable, fixture-based auth-state reuse cuts per-test login to ~zero, `--shard=1/4 --workers=4` gives 16-way parallel in CI. Quote (from §1 trophy decision): *"For a frontend monorepo the honeycomb maps cleanly onto package-boundary tests… and a thin Playwright tier at the other cap."* The thin cap is what's missing.

**Why it matters:** The patterns above are explicitly load-bearing project polish — they are part of the freelance-positioning signal per [CLAUDE.md](../../../CLAUDE.md). A scroll-restore regression or a view-transition stutter is exactly the class of bug that:

1. Lands silently because nothing in jsdom catches it.
2. Reads as broken to a reviewer/visitor without an obvious cause.
3. Erodes the "polished portfolio" signal the project is explicitly targeting.

A 5-test Playwright surface (one per top-level route + one cross-route navigation flow + one command-palette keyboard flow) catches all of these for ~30min CI/run and ~1-2h setup.

**Tension with Start:** Mild. Playwright tests should run against `pnpm preview` (built SPA), which works identically pre- and post-Start. Post-Start, the same suite runs against an SSR'd dev server with no test changes — Playwright doesn't care about the server posture.

**How to apply:** Three commits.

1. **Land minimal Playwright config.** `pnpm add -DEw @playwright/test`, create `playwright.config.ts` at workspace root (or apps/web), pin chromium-only initially, set `webServer: { command: 'pnpm --filter @vyoh/web preview', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI }`. Add `e2e:cc` script that runs `playwright test --reporter=line` with output capped.
2. **Write ~5-7 axe-clean smoke tests.** One per surface (`/`, `/status`, `/lol/$accountSlug`, `/lol/$accountSlug/matches`, `/lol/$accountSlug/matches/$matchId`, `/steam`, `/steam/game/$appid`). Each test: navigate, wait for content, axe scan, screenshot. Reference: `10-testing.md` §8 "@axe-core/playwright per-route" pattern.
3. **Add E2E job to CI** as a separate `e2e` job parallel to `check`. Use Playwright's `actions/cache` for browser binaries. Trace on first retry. Upload trace.zip as workflow artifact on failure.

The auth/storage-state fixture pattern from `10-testing.md` §4 is **deferred** until owner-auth lands ([owner-auth.md](owner-auth.md)) — pre-launch all routes are public, so storage state isn't needed yet.

**Effort:** Step 1 ~30 min. Step 2 ~2h (5-7 tests, each a happy-path smoke + axe scan, ~15-20 min each). Step 3 ~30 min. Total: ~3-4h end-to-end. Catches a class of bugs no other tier can.

### Gap 23 — No Storybook 9 component catalogue. The freelance-portfolio surface and the integration-tier consolidation are both blocked

**Current state:** No Storybook. No `.storybook/` directory, no `*.stories.*` files, no story-driven component dev. The project ships ~80 reusable components across `apps/web/src/components/`, `apps/web/src/lol/_shared/`, `apps/web/src/steam/`, and has no public catalogue surface.

**KB floor:** `10-testing.md` §5 — Storybook 9 GA (July 2025) reframes Storybook from a component explorer to a **component test platform**. The Vitest addon makes every `.stories.tsx` file also a Vitest test file: Vitest discovers stories, renders them in headless browser mode (Playwright provider), runs the `play` function as an interaction test, and reports results in the same `pnpm test` run. Quote: *"This is the killer feature: one artefact (the story) drives the docs UI, the dev component explorer, the interaction test, the accessibility scan, and the visual regression check."*

**Why it matters:** Two distinct payoffs:

1. **Portfolio surface.** Per [CLAUDE.md](../../../CLAUDE.md), vyoh is explicitly freelance-positioning ("Senior frontend engineer ... freelance profile ... Angular-deep + React-competent + perf/build/migration specialist"). A `/storybook` deploy target on the same domain reads as "I think about components as a system, with documented variants, a11y states, and interactive demos" — a strong signal that's invisible from the app surface today. The audience for this is the person clicking through from a freelance proposal.
2. **Test-tier consolidation.** The audit found ~80 components with React Testing Library tests that render the component in a wrapper with mocked providers (Tooltip, MotionConfig reducedMotion="always", QueryClient with retry: false). The "Story as test" model collapses three artefacts (the story, the test file, the mock fixture) into one. The wrapper boilerplate moves to a Storybook decorator stack and is written once.

Combined with Gap 21 (visual regression) and Gap 22 (Playwright), Storybook 9 + Vitest addon + a11y addon is the single artefact that drives docs + interaction tests + axe scans + screenshot baselines — replacing four separate test patterns that are currently duplicated across files.

**Tension with Start:** None on the component-test side. The portfolio-surface deploy is a separate concern but small: Storybook 9's static build (`storybook build`) is a flat dir that any static host serves; can deploy alongside the main app on the same domain at `/storybook/*`.

**Caveat:** This is a significant addition (Storybook adds ~100MB to `node_modules` and a real config surface). Worth pairing with the *next* round of UI-arc pickup (e.g. accent system, editorial type, ambient hero in [elevation-arcs.md](elevation-arcs.md)) so stories get written for the components being built anyway, rather than as a retrofit pass on the existing component tree.

**How to apply:** Two phases.

1. **Pilot.** `npx storybook@latest init` in apps/web. Configure the Vitest addon per `10-testing.md` §5 (storybookTest plugin + browser-mode project). Write stories for 3-5 components from an upcoming arc — not a retrofit. Verify `pnpm test` discovers them and runs interaction + a11y assertions.
2. **Gradual fan-out.** Each new component shipped after the pilot gets a story-in-same-commit (extends the existing test-in-same-commit rule per [feedback_test_alongside_code](../../../home/node/.claude/projects/-workspaces-vyoh-gg/memory/feedback_test_alongside_code.md)). Retrofit existing components opportunistically when their tests are touched.

**Effort:** Pilot ~3-4h including the addon plumbing + 3-5 story files + verifying the Vitest addon works against the existing happy-dom suite (some friction expected on the browser-mode project boundary). Fan-out is per-component and amortised into the work that touches each component.

**Decision posture:** Defer pickup until the next UI-arc starts — don't do a standalone retrofit pass.

### Gap 24 — Coverage thresholds gate only `lines`. Branch / function / statement coverage are uncovered

**Current state:** All three vitest configs gate coverage on `lines` only:

- [apps/web/vite.config.ts:77](../../../apps/web/vite.config.ts#L77) — `thresholds: { lines: 93 }`
- [apps/api/vitest.config.ts:19](../../../apps/api/vitest.config.ts#L19) — `thresholds: { lines: 94 }`
- [packages/shared/vitest.config.ts:14](../../../packages/shared/vitest.config.ts#L14) — `thresholds: { lines: 90 }`

**KB floor:** `10-testing.md` §3 — v8 coverage tracks lines, branches, functions, statements. *"v8 (default) ... less accurate for branch coverage; counts un-executed source-map regions imprecisely."* The 2026 best-practice is to gate on **all four** with branches as the load-bearing metric, because branch coverage is what catches an under-asserted conditional — a test that runs the branch but doesn't assert the per-branch outcome.

**Why it matters:** Today's coverage is already high (the owner ran a multi-day sweep per [feedback_test_alongside_code](../../../home/node/.claude/projects/-workspaces-vyoh-gg/memory/feedback_test_alongside_code.md)). The actual branch coverage number is unknown — could be 70%, could be 95%. A reducer with 100% line coverage but 60% branch coverage means tests exercise the function call but skip the conditional cases. Gating only on `lines` lets that erode silently as new branches land.

The shape of the fix is **floor-set thresholds at current actual** — find the current branches/functions/statements numbers from a coverage run, set thresholds at floor-minus-1 to give a small buffer, and treat any drop as a PR-blocking finding.

**Tension with Start:** None.

**How to apply:** One commit. Run `pnpm coverage:cc` to read current branches/functions/statements per workspace. Update each vitest config:

```ts
thresholds: {
  lines: 93,        // existing
  branches: 85,     // example — set at floor of current actual
  functions: 90,    // example
  statements: 93,   // typically tracks lines
  perFile: false,   // keep package-level for now; flip to true if a hotspot needs file-level enforcement
}
```

Pair with: a one-line note in the coverage step of [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) calling out that the CI summary now also surfaces branch coverage (it already does — just label it).

**Effort:** ~20 min including the coverage read + threshold tuning + CI verify.

### Gap 25 — Three separate Vitest configs; `test.projects` would unify them and prepare for browser-mode pilot

**Current state:** Each workspace has its own vitest config (apps/web embedded in [vite.config.ts](../../../apps/web/vite.config.ts), apps/api in [vitest.config.ts](../../../apps/api/vitest.config.ts), packages/shared in [vitest.config.ts](../../../packages/shared/vitest.config.ts)). `pnpm -r test` runs three Vitest processes sequentially. Coverage produces three separate lcov files that Codecov merges externally.

**KB floor:** `10-testing.md` §3 "Config and projects" — Vitest 4.x's `test.projects` array (renamed from `workspace` in 3.x, fully replaced 4.0) lets one root `vitest.config.ts` orchestrate multiple test environments. Each project gets its own `environment`, `setupFiles`, `include`, `exclude`. Standard 2026 shape: a `node` project for backend/shared, a `jsdom`/`happy-dom` project for component tests, and a `browser` project for visual/interaction tests.

**Why it matters:** Two payoffs:

1. **Coverage rollup.** `vitest --coverage` against the root config produces a single coverage report covering all projects. The current 3-lcov + Codecov merge works but a single rollup catches cross-package un-covered branches (a `@vyoh/shared` helper that's only used from `@vyoh/web` tests has its coverage credited to shared; a single project view sees the actual aggregate).
2. **Future browser-mode project is a one-line addition.** When Gap 21 (visual regression via Vitest browser mode) or Gap 23 (Storybook Vitest addon) lands, the right shape is a separate `browser` project in the same root config. With separate configs today, each addition requires touching apps/web's `vite.config.ts` and reasoning about Vite+Vitest plugin co-existence. With a root projects config, browser mode is its own slot.

**Tension with Start:** None.

**Why it's a "wrong shape for 2026" gap not a "broken" gap:** Nothing is broken today. The motivation is **preparing for browser-mode / Storybook adoption** — both of which want the projects shape. If the project never adopts those, this gap can stay open indefinitely.

**How to apply:** One commit (sequence after Gap 23's pilot if it lands; otherwise opportunistic).

1. Create `vitest.config.ts` at the workspace root with `test.projects` referencing each workspace's existing config (or inlining the per-workspace `test` blocks).
2. Update each workspace's `test` script to either remove (use root invocation) or alias to `--project=<name>`.
3. Update [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) to call `pnpm vitest --coverage` from root instead of `pnpm -r test --coverage`.

**Effort:** ~45 min including verify pass. Defer if no concrete browser-mode/Storybook pickup is planned.

### Gap 26 — No `@testing-library/user-event` explicit dep; tests use lower-level `fireEvent`

**Current state:** [apps/web/package.json](../../../apps/web/package.json) has `@testing-library/react ^16.3.2` but no `@testing-library/user-event` (`ugrep` for the import string returns zero hits). The 225 component/hook tests use `fireEvent` or invoke handlers directly.

**KB floor:** `10-testing.md` §1 quotes Testing Library's mantra: *"the more your tests resemble the way your software is used, the more confidence they can give you."* `user-event` is the realistic-interaction primitive: it dispatches the full sequence of events a real user produces (`keydown` → `beforeinput` → `input` → `keyup` for a typed character, focus/blur for tab, paste-with-clipboard for paste). `fireEvent` dispatches a single event and skips the intermediate steps — which means tests can pass while real user interaction breaks.

**Why it matters:** The command palette is the canonical example. [apps/web/src/components/command-palette-dialog.test.tsx](../../../apps/web/src/components/command-palette-dialog.test.tsx) tests the keyboard shortcut and filter behaviour. `fireEvent.keyDown(document, { key: 'k', metaKey: true })` opens the dialog correctly in tests; a real `cmd+k` in Chrome triggers focus + IME / shortcut handling that `fireEvent` skips. user-event's `userEvent.keyboard('{Meta>}k{/Meta}')` matches real browser behaviour.

The grammar parser in `parse-palette-verb` is also a typing flow; tests that exercise it via `fireEvent.change(input, { target: { value: 'foo' } })` don't fire the per-character handlers a real typist would, masking debouncing or focus-shift bugs.

**Tension with Start:** None.

**How to apply:** One commit. `pnpm --filter @vyoh/web add -D @testing-library/user-event`. The migration is opportunistic — new tests get `userEvent.setup()` + `await user.click(...)` / `await user.keyboard(...)` from the start; existing tests get migrated when they're touched for other reasons. No big-bang rewrite needed.

**Effort:** ~5 min to add the dep. Per-test migration is per-test.

### Gap 27 — `apps/api` vitest only includes `*.spec.ts`; web includes both `.test.` and `.spec.`. Silent-skip risk on an api test accidentally named `.test.ts`

**Current state:**

- [apps/api/vitest.config.ts:12](../../../apps/api/vitest.config.ts#L12) — `include: ["src/**/*.spec.ts"]`
- [apps/web/vite.config.ts:65](../../../apps/web/vite.config.ts#L65) — `include: ["src/**/*.{test,spec}.{ts,tsx}"]`
- [packages/shared/vitest.config.ts:6](../../../packages/shared/vitest.config.ts#L6) — `include: ["src/**/*.{test,spec}.ts"]`

api uses Nest's `.spec.ts` convention, web/shared use Vitest's `.test.ts` convention. The configs encode that — *but the api include is `.spec.ts` ONLY*, so an api file accidentally named `foo.test.ts` is silently un-run. Today 0 api files match `.test.ts` so this is latent rather than active, but the next session that copies a test pattern from web into api could trip it without any failure signal.

**KB floor:** `10-testing.md` §2 — "Pick one definition per repo and document it." The same logic applies to file naming; consistency across the monorepo prevents the silent-skip class of bug.

**Why it matters:** This is a hygiene gap, not a correctness gap today. The right fix is to broaden the include to `.{test,spec}.ts` everywhere, accepting both conventions. The cost is zero (no existing tests are renamed; future tests can use either suffix).

**Tension with Start:** None.

**How to apply:** One commit. Change [apps/api/vitest.config.ts:12](../../../apps/api/vitest.config.ts#L12) include to `["src/**/*.{test,spec}.ts"]`. Run `pnpm --filter @vyoh/api test` — expected: identical test count (no `.test.ts` files exist today). The change is purely a future-proofing one.

**Effort:** ~5 min.

### Round 7 non-gaps (worth knowing, no action)

These are strong-adoption signals confirming the testing stack is correctly modern:

- **Vitest 4.1 is fully adopted.** All three workspaces on `vitest ^4.1.5` + `@vitest/coverage-v8 ^4.1.6`. Matches KB §3 baseline (4.0 Dec 2025, 4.1 line is current as of April 2026).
- **happy-dom is the correct env choice.** Lighter than jsdom, well-supported in vitest 4. KB §3 doesn't prescribe one over the other; both are fine.
- **jest-axe usage is exactly the documented pattern.** [apps/web/src/components/accessibility.test.tsx](../../../apps/web/src/components/accessibility.test.tsx) uses `configureAxe` with the `color-contrast` + `aria-hidden-focus` carve-outs that KB §8 explicitly calls out as the happy-dom standard. The convention is also enshrined in [docs/repo-conventions.md § "Axe-scan new interactive components"](../repo-conventions.md).
- **Snapshot use is restrained and correct.** Exactly 1 file uses snapshots: [apps/web/src/lol/_shared/static/rich-description.snapshots.test.ts](../../../apps/web/src/lol/_shared/static/rich-description.snapshots.test.ts). Inline snapshots, drift-detection use case (wiki HTML through sanitiser), explanatory comments on every fixture's source. Matches KB §13 "useful when" pattern exactly — not debt.
- **Same-commit test enforcement is already a convention.** [docs/repo-conventions.md § "New interactive surfaces get a test in the same commit"](../repo-conventions.md) + [feedback_test_alongside_code](../../../home/node/.claude/projects/-workspaces-vyoh-gg/memory/feedback_test_alongside_code.md). KB §1's trophy-shape recommendation depends on this; the project enforces it.
- **API's `oxc: false` in [apps/api/vitest.config.ts:10](../../../apps/api/vitest.config.ts#L10) is deliberate and correct.** Already noted in Round 6 non-gaps — Nest decorator metadata needs SWC, oxc doesn't yet emit it. Carries over to the testing audit as a non-issue.
- **API's `Logger.overrideLogger(false)` in [apps/api/test/setup.ts:4](../../../apps/api/test/setup.ts#L4)** is the canonical fix for the "NestJS Logger floods test output" gotcha noted in [CLAUDE.md "tokf test filters suite-level results but not per-test framework-logger output"](../../../CLAUDE.md). Already handled.
- **Codecov integration is present.** [.github/workflows/ci.yml:46-53](../../../.github/workflows/ci.yml#L46-L53) uploads three lcov files with workspace flags. Coverage trend is observable per-PR.
- **No `vi.fn()`-as-component-mock patterns.** The mock surface is restrained to module-level `vi.mock('@tanstack/react-router', ...)` and `vi.mock('@/identity/use-me', ...)` — exactly the boundary the KB §3 mocking section recommends ("mock at the module boundary, not the component boundary").
- **`vi.useFakeTimers` usage is bounded.** 15 sites total; not a "every test uses fake timers" smell. The KB §3 fake-timers gotcha (async + fake-timers deadlock) is the kind of thing to watch but no specific finding today.
- **No mutation testing today is the right default for this project shape.** Stryker pays off on pure-logic packages with rich branching (parsers, formatters, financial calcs) — `@vyoh/shared` has some of this profile (sanitize-rich-html, parse-palette-verb, rank-history) but the cost-vs-signal at this codebase size doesn't justify it yet. Re-evaluate when one of those modules gets a public-npm extraction (per [case-study-topics.md](case-study-topics.md)).
- **No property-based testing today is a soft gap.** `parse-palette-verb` (encode/decode round-trip), `sanitize-rich-html` (idempotency), and `strip-wikitext` (idempotency, no-HTML-survives) are all classic fast-check candidates. Not promoted to a numbered gap because the existing unit tests are strong and the marginal catch rate is unknown for these specific functions. Treat as a "consider when next touching that module" nudge rather than a do-now item.
- **No OpenAPI contract testing today.** The api is a Nest 11 service that doesn't expose an OpenAPI spec; the web hits it with hand-typed wrappers around `@vyoh/shared` types. Could become a gap if a third consumer joins (e.g. a future React Native app, or a public api for portfolio purposes). Defer until then.

### Round 7 bundling

| Bundle | Gaps | Effort | Slot |
|---|---|---|---|
| **T — Coverage thresholds + include-pattern unification + user-event dep** | #24, #26, #27 | ~30 min | Ship now, atomic |
| **U — MSW handler set + first 5-10 file migrations** | #20 (infra) | ~2h | Ship now, infra commit; mechanical fan-out follows |
| **V — MSW fan-out across remaining 15 files** | #20 (rest) | ~2-3h | Multi-commit, incremental; can interleave with feature work |
| **W — Playwright minimal config + 5-7 axe-clean smoke tests + CI E2E job** | #22 | ~3-4h | Ship after Bundle U (MSW handlers reusable in Playwright via service-worker mode if desired later) |
| **X — Visual regression on splash + 6-8 high-stakes surfaces** | #21 | ~2-3h | Ship after Bundle W (uses Playwright's `toHaveScreenshot()`) |
| **Y — Storybook 9 pilot during next UI-arc pickup** | #23 | ~3-4h pilot | Defer until next UI-arc starts; pair with that arc's components |
| **Z — Root `vitest.config.ts` with `test.projects`** | #25 | ~45 min | Defer until Bundle X or Y creates a concrete need (browser-mode project) |

Bundle ordering rationale: T is pure hygiene and atomic. U is the load-bearing infra change that unblocks both Storybook and Playwright reuse later. W can land before or after U but reading MSW handlers from the same source as web tests is the cleaner shape. X depends on W. Y is the largest single commitment and should not be standalone — pair with a UI-arc. Z is preparation for browser-mode and is dead weight until something needs it.

---

## Round 8 — SEO audit (2026-05-24)

Audited `apps/web` against `~/.claude/knowledge/frontend-2026/13-seo.md`. Surfaced six new gaps (28–33). The structural CSR-vs-SSR gap (KB §8: AI crawlers lag JS rendering by 3–5 years) is already tracked in [tanstack-start-migration.md](tanstack-start-migration.md) and not re-raised here. Gap 1 follow-up (site-wide OG image) and Gap 16 (match-detail localhost `og:image` URL) remain open and are referenced rather than duplicated.

### Gap 28 — `robots.txt` is silent on every AI crawler token

**Current state:** [apps/web/public/robots.txt](../../../apps/web/public/robots.txt) is three lines: `User-agent: *`, `Allow: /`, `Sitemap: …`. No mention of `Google-Extended`, `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-User`, `PerplexityBot`, `Perplexity-User`, `CCBot`, `Applebot-Extended`, `Meta-ExternalAgent`, `Bytespider`. The `Allow: /` is also redundant (default behavior) and serves only as documentation.

**KB floor:** `13-seo.md` §5 — "AI vendors now publish dedicated user-agents. Treating them as a distinct policy layer from search-index crawlers is the standard pattern in 2026." Sites are expected to make explicit decisions for each token, not rely on `User-agent: *` defaults.

**Why it matters for this project specifically:** vyoh.gg is a freelance-positioning portfolio (per [self-portrait-surfaces.md](self-portrait-surfaces.md)). The decision matrix is unusual for the project shape:

- **Training crawlers** (`GPTBot`, `ClaudeBot`, `CCBot`, `anthropic-ai`, `Meta-ExternalAgent`, `Bytespider`) — owner is the *target* of LLM-driven freelancer search. Letting them ingest the site is the desired outcome, not a leak. **Decision: Allow.**
- **Retrieval/search crawlers** (`OAI-SearchBot`, `Perplexity-User`, `ChatGPT-User`, `Claude-User`, `PerplexityBot`) — these are how "Anthropic-deep React engineer with TanStack experience" queries reach the site. **Decision: Allow.**
- **Google-Extended** — opt-out of Gemini training without affecting search index. The same allow-training rationale applies: no reason to opt out. **Decision: Allow (omit or set Allow:/).**
- **Applebot-Extended** — Apple Intelligence training opt-out. Same reasoning. **Decision: Allow.**

The portfolio's positioning logic flips the usual default. Most production sites in 2026 either block training tokens (Reddit/NYT model — protect content) or block all AI (Cloudflare default — pure caution). vyoh.gg has the opposite incentive and that decision deserves to be in the file rather than implicit.

**Tension with Start:** None. `robots.txt` is served from `public/`.

**How to apply:** One commit. Rewrite [robots.txt](../../../apps/web/public/robots.txt) with explicit `User-agent:` groups for each named token + a brief comment recording the "allow training because portfolio" decision so the next reviewer understands the intent. Reference: KB §5 token table.

**Effort:** ~10 min.

### Gap 29 — Zero JSON-LD anywhere; no `Organization`, `Person`, `BreadcrumbList`

**Current state:** `ugrep -r 'ld\+json' apps/web/src apps/web/index.html` returns nothing. The site is a self-portrait portfolio of a named person yet ships zero entity-reconciliation signal.

**KB floor:** `13-seo.md` §3 — `Organization` JSON-LD on the homepage is the standard root-only schema; `Person` is the E-E-A-T-aligned entity for author/owner pages; `BreadcrumbList` belongs on every section page deeper than one click from the root.

**Why it matters for this project specifically:** Three different surfaces have unrendered schema right now:

1. **Homepage** — should ship `Organization` (or, since this is a personal project, `Person` is more accurate). `sameAs` array drives Knowledge Graph reconciliation against GitHub, LinkedIn, the owner's other profiles. Without it, AI Overviews and Perplexity answers about "Jonas freelance React Angular" can't link the site to the owner's other web presence — the citation breaks.
2. **Match-detail** — has a visible breadcrumb component ([routes/lol/$accountSlug/matches/$matchId.tsx:58-83](../../../apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx#L58-L83)) but no `BreadcrumbList` markup. KB §3 explicitly warns against invisible breadcrumbs (cloaking-adjacent); the opposite — visible breadcrumb without schema — is the normal "we forgot" pattern.
3. **Champion-detail** — has its own breadcrumb-style nav. Same gap.

**KB-deprecated types to NOT add:** `FAQPage` (deprecated 2026-05-07), `HowTo` (removed 2024), `Course`/`Book`/`ClaimReview`/`SpecialAnnouncement` (retired June 2025). None of these are relevant to this project, but worth recording in the gap so a future "add JSON-LD" pass doesn't reach for them.

**Tension with Start:** None. JSON-LD blocks are inert `<script>` tags that work identically in CSR or SSR. Adding them to `index.html` (for `Organization`) and to per-route `head()` (for `BreadcrumbList`) is the standard pattern.

**How to apply:** Three sub-commits, atomic each:

- `Organization`/`Person` block in [index.html](../../../apps/web/index.html) with `name`, `url`, `image`, `sameAs` array of social profiles.
- `BreadcrumbList` in match-detail's `head()` (after Gap 31 lands, which expands `head()` coverage). Each item: position, name, item URL — final item omits `item`.
- `BreadcrumbList` in champion-detail's `head()` once that route gains one.

**Effort:** ~30 min for the `Organization` block (including assembling the `sameAs` URL list); ~5 min each for the breadcrumb additions once `head()` exists on those routes.

### Gap 30 — Sitemap ships `changefreq` and `priority` (ignored), no `lastmod` (the only field Google honors)

**Current state:** [apps/web/public/sitemap.xml](../../../apps/web/public/sitemap.xml) has 4 entries, each with `<changefreq>` and `<priority>`. None have `<lastmod>`. The file is hand-maintained.

**KB floor:** `13-seo.md` §4 — "Google ignores `changefreq` and `priority` entirely (confirmed by Gary Illyes 2017). `lastmod` is the only optional element Google honors, and only when it's truthful — populating `lastmod` with the current date on unchanged URLs trains Google to ignore your `lastmod` permanently."

**Why it matters:** Two costs from the current shape — (a) the unused fields bloat the file and lie about the project's freshness signal accuracy; (b) the absence of `lastmod` means Google has no per-URL crawl-budget hint, so every crawl re-fetches every URL.

**Tension with Start:** None for the static routes. Dynamic routes (matches, champions, accounts) become a different question — they need either a build-time sitemap-index generator or a runtime route serving `sitemap.xml` (KB §4 Static SPA row: "Generate at build time via a Vite plugin or a postbuild script; commit `public/sitemap.xml` or write it during `vite build`. Never try to generate at runtime from a static host.").

**How to apply:**

- Atomic now: drop `changefreq`/`priority` from the 4 static entries; add `<lastmod>` derived from a meaningful date (git mtime of the corresponding route file, or simply the last meaningful redesign date for top-level routes). Format: `YYYY-MM-DD`.
- Deferred: Vite-postbuild generator that walks the route tree + queries the DB for `accountSlug`, `matchId`, `championAlias`, `appid` slugs. Belongs in a sitemap-arc note (not created yet) since it intersects with the api boundary and would benefit from being a worked example for a future case-study topic.

**Effort:** ~10 min for the static cleanup; ~2h for the dynamic generator (separate arc).

### Gap 31 — Per-route `head()` only on match-detail; every other route inherits the same `<title>vyoh.gg</title>` and root canonical

**Current state:** `head:` exports exist on exactly one route — [routes/lol/$accountSlug/matches/$matchId.tsx:35-55](../../../apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx#L35-L55). Every other route renders the static `<title>vyoh.gg</title>` from [index.html:22](../../../apps/web/index.html#L22) and inherits `<link rel="canonical" href="https://vyoh.gg/">` regardless of the actual URL.

The practical impact:

- **Browser tab** for `/lol/SeargentJonas-EUW/matches`, `/steam/game/440`, `/lol/SeargentJonas-EUW/champions/Yasuo` — all read `vyoh.gg`. Indistinguishable from each other when several tabs are open.
- **SERP titles** — Google sees `vyoh.gg` for every indexed URL. Duplicate-title is the most common "low-quality" signal per KB §1.
- **Canonical** — every page declares itself a duplicate of `/`. Per KB §6, "Canonical to a URL that itself canonicals elsewhere" is on the common-mistakes list; the variant here is worse (all pages canonicalize to root). Google will likely override based on URL signals, but the markup is actively misleading.

**Overlap with Round 5 Gap 15:** Round 5 noted "zero route loaders" + match-detail being the only `head()` site. This gap extends that finding from "we need loaders" to "the metadata side alone is shippable today without SSR" — `head()` runs client-side in TanStack Router 1.x and the `<head>` tags are still parsed by every social/AI crawler that does render the page (Googlebot per KB §8 runs current stable Chromium; AI crawlers don't, which is why the canonical static fallback in [index.html](../../../apps/web/index.html) still has to be accurate).

**KB floor:** `13-seo.md` §1 + §6 + §15 — every public page ships a unique `<title>` (≤60 chars), self-referential canonical, unique description.

**Tension with Start:** None for landing per-route `head()` now. When Start ships, `head()` runs server-side instead of client-side — the API surface is the same per [05-frameworks.md §2 head()/loader pairing pattern]. Investing in per-route `head()` today is forward-compatible.

**How to apply:** Add `head()` to the high-traffic public routes in this order:

1. `/lol/$accountSlug` — title `{accountSlug} · LoL · vyoh.gg`, description from real data (rank + main role if available, static fallback if not), canonical = absolute URL.
2. `/lol/$accountSlug/champions/$championAlias` — title `{championName} · {accountSlug} · vyoh.gg`, canonical, og:image (champion splash, already available via image proxy).
3. `/steam/game/$appid` — title `{gameName} · Steam · vyoh.gg`, canonical, og:image (game header from Steam API).
4. `/` — explicit `head()` even though it duplicates index.html, so the canonical pattern is uniform across all routes.
5. `/status` — title `Status · vyoh.gg`, `<meta name="robots" content="noindex">` (operational dashboard, not portfolio content).

`og:image` per-route is the natural upgrade path — see Gap 1 follow-up; the og-card pipeline at [apps/api/src/og](../../../apps/api/src/og) already serves match cards and can be extended.

**Effort:** ~2h end-to-end for the five routes; can ship route-by-route. The single load-bearing decision is the absolute-URL builder helper — needs to be a shared utility so canonical/og:url strings stay consistent (see Round 5 Gap 16 localhost-bug for what happens when each call site reinvents the URL).

### Gap 32 — Twitter card is `summary` (small thumbnail); should be `summary_large_image` once OG image lands

**Current state:** [apps/web/index.html:21](../../../apps/web/index.html#L21) declares `<meta name="twitter:card" content="summary" />`. The `summary` card type renders a small square thumbnail (1:1, min 144px); `summary_large_image` renders the 1200×630 full-bleed card.

**KB floor:** `13-seo.md` §2 — "summary_large_image (1200×628, ratio 1.91:1) for articles." The 1:1 `summary` card is for compact listings, not main-content pages.

**Why it matters:** The card type is a 30-second swap that's load-bearing for what a shared link looks like in any X/Twitter unfurl, Discord embed (which respects `twitter:card`), and several smaller previewers. Sitting on `summary` while the project doesn't ship an OG image at all is consistent; once Gap 1 follow-up lands (the deferred 1200×630 OG image), the card type must flip in the same commit or the new OG image renders as a 144px thumbnail in X.

**How to apply:** Pair with Gap 1 follow-up: when the static OG image PNG lands, change [index.html:21](../../../apps/web/index.html#L21) to `summary_large_image` in the same commit. Add `<meta property="og:image:alt" content="…" />` (KB §2: "read aloud by some assistants when the link is shared in conversational AI"). Don't flip in isolation — `summary_large_image` without an image is wasted markup.

**Effort:** ~5 min, but coupled to Gap 1 follow-up.

### Gap 33 — No `max-image-preview:large` directive; Google Discover ineligible

**Current state:** [apps/web/index.html](../../../apps/web/index.html) has no `<meta name="robots">` tag (defaults to `index, follow`). Per KB §1 the robots directive `max-image-preview:large` is "required for Discover eligibility."

**KB floor:** `13-seo.md` §1 — list of useful robots directives, with `max-image-preview:large` flagged as Discover-required.

**Why it matters (and why it's a soft gap for this project):** Google Discover is the mobile content feed — eligibility requires high-quality images, recency signals, and `max-image-preview:large`. The site is unlikely to chase Discover traffic actively, but the directive is free, has zero risk, and signals "site is set up correctly" to any SEO audit. The same line slot also takes `max-snippet:-1` (allow any snippet length) — also free, also no risk.

**Tension with Start:** None.

**How to apply:** One line in [index.html](../../../apps/web/index.html), or roll into the per-route `head()` work (Gap 31) so the directive applies via the route layer rather than the static template. Site-wide-in-index.html is the simpler shape; per-route only matters when individual routes need different snippet rules (e.g. `/status` getting `noindex`).

```html
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
```

**Effort:** ~2 min.

### Round 8 non-gaps (worth knowing, no action)

- **No llms.txt** — KB §10 explicitly: "No major AI vendor has committed to consuming llms.txt as of May 2026." Adoption ~10% of measured domains. KB calls it "high-ROI for developer-tool docs, optional for marketing sites." This project is portfolio-shaped, not docs-shaped, so no action. Re-evaluate if the project ever publishes a public API spec or SDK.
- **theme-color is single-value (not `prefers-color-scheme` paired)** — site is dark-only with `<html class="dark">` and ships a single `#0a0a0a` value. KB §1 shows the `media`-attribute variant for dark+light; not applicable here. Non-issue.
- **No hreflang** — site is English-only. Non-issue unless a Dutch/French variant ever ships.
- **URL trailing-slash inconsistency is minor** — canonical declares `https://vyoh.gg/` (with slash) while internal links to `/lol`, `/steam`, `/status` are slash-less. Not flagged as a gap because TanStack Router renders consistently and no duplicate-content signal has appeared in practice. Watch if Search Console ever lights up.
- **The CSR-vs-SSR structural blocker is not re-raised** — [tanstack-start-migration.md](tanstack-start-migration.md) already owns it. AI crawlers (ChatGPT-Search, Perplexity, ClaudeBot per KB §8) need static HTML; the head-tag work in Round 8 is the half of the SEO floor that's shippable *without* SSR. The other half is the migration.
- **Match-detail localhost `og:image` URL is already in quick-wins** — Round 5 Gap 16; not duplicated. SEO audit confirms it's the only `head()` site in the codebase, which makes the localhost bug both narrower (one file) and more impactful (the only route currently shipping per-route OG).
- **Image SEO is adequate where it matters** — KB §13 requires `fetchpriority="high"` on LCP image. Splash backdrops have been audited under [unified-image-fallback](../../../home/node/.claude/projects/-workspaces-vyoh-gg/memory/project_unified_image_fallback.md); the splash component uses native lazy/eager loading appropriately. No new gap.
- **`Person` vs `Organization` choice for the homepage JSON-LD** — KB doesn't prescribe a winner. For a personal portfolio Person is more accurate (owner is the entity, not a company); for credibility-projection Organization can imply scale. Recording the call here so Gap 29's implementation doesn't churn on the choice: ship `Person` (with `worksFor` only if a freelance entity name exists), and revisit if positioning ever pivots toward agency framing.

### Round 8 bundling

| Bundle | Gaps | Effort | Slot |
|---|---|---|---|
| **AA — robots.txt AI crawler tokens + sitemap `lastmod` cleanup + `max-image-preview:large`** | #28, #30 (static part), #33 | ~25 min | Ship now, atomic, one commit |
| **AB — `Organization`/`Person` JSON-LD in index.html + OG image baseline + twitter card flip** | #29 (homepage), Gap 1 follow-up, #32 | ~1h once OG image PNG is captured | Ship after a marquee surface to screenshot exists |
| **AC — Per-route `head()` rollout across 5 high-value routes + absolute-URL helper** | #31, #29 (breadcrumb part) | ~2h | Ship route-by-route; helper goes in `packages/shared/src/seo/` |
| **AD — Vite-postbuild dynamic sitemap generator** | #30 (dynamic part) | ~2h | Separate arc; defer until Start migration or post-launch traffic data |

Bundle ordering rationale: AA is pure config and ships today with zero risk — the AI crawler decision is documented in Gap 28 so the file doesn't need to be re-derived. AB is gated on the deferred OG image; until that lands, the JSON-LD + twitter-card work is best paired with the image so a single commit moves the social-preview story end-to-end. AC is the largest mechanical change and benefits from a shared absolute-URL helper to prevent another Gap 16 (localhost in og:image) recurrence. AD is the only piece that wants a working note before pickup.
