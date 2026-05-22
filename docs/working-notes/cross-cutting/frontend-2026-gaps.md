# Frontend-2026 KB gaps

**Status:** Active — five small gaps surfaced by the 2026-05-22 evaluation against `~/.claude/knowledge/frontend-2026/`. Most ship as sub-session each; one defers to post-launch; one folds into the parked [tanstack-start-migration.md](tanstack-start-migration.md).

Companion to [tanstack-start-migration.md](tanstack-start-migration.md). That note covers the structural gap (CSR vs SSR for a public portfolio). This note covers the smaller, mostly-independent items that don't need to wait for the migration.

---

## Gap 1 — Static `<head>` baseline

**Current state:** [apps/web/index.html](../../../apps/web/index.html) carries charset + viewport + favicon + `<title>vyoh.gg</title>`. Nothing else. No description, no OG tags, no theme-color, no canonical, no `robots.txt`, no `sitemap.xml`.

**KB floor:** `13-seo.md` §1 — every public page ships with description, OG title/description/image, theme-color, canonical. `robots.txt` + `sitemap.xml` for indexable sites.

**Why it matters now even though Start is parked:** AI crawlers (ChatGPT-Search, Perplexity, ClaudeBot) lag JS rendering by 3–5 years per `13-seo.md` §8. Page-agnostic head fields are read from `index.html` directly on first crawl — they don't need SSR. The portfolio framing depends on these crawlers being able to read *something* the moment the site goes live.

**What changes after Start:** Per-route `<title>` and description come from each route's `head()` function. The static baseline (OG image URL, theme-color, default description) stays in the root document either way.

**How to apply:** One commit. Add the missing tags to [index.html](../../../apps/web/index.html). Create `apps/web/public/robots.txt` and `apps/web/public/sitemap.xml`. Generate an OG image (1200×630, can be a screenshot of `/` once a marquee surface exists; placeholder for now).

**Effort:** ~1h including OG image. Sub-session.

---

## Gap 2 — React Compiler on Vite

**Current state:** [apps/web/vite.config.ts](../../../apps/web/vite.config.ts) configures `@vitejs/plugin-react` without `babel.plugins`. React 19.2.5 is installed, so the runtime supports Compiler memoization primitives.

**KB floor:** `04-react-internals.md` §10 — React Compiler 1.0 is GA. On Vite, enable via `babel.plugins: ['babel-plugin-react-compiler']` inside the react plugin config.

**Why it matters now:** Owner is actively building MR2–MR4 and PN1–PN4 (per [open-work.md](../open-work.md)). Compiler removes the need to hand-write `useMemo`/`useCallback`/`memo` in those surfaces. Flipping it later still works but loses the leverage on everything written between now and then.

**Tension with Start:** None. Compiler config sits on the vite-plugin-react instance, which Start keeps.

**How to apply:** Add `babel-plugin-react-compiler` to `apps/web/package.json`, wire it into vite.config.ts, run `pnpm verify:cc`, spot-check one heavily-memoized surface (e.g. `MatchWindowProvider`) to confirm no regressions.

**Effort:** ~30 min + verify pass. Sub-session.

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
| **A — head baseline + LCP fetchpriority** | #1, #5 | ~1h | Ship now, single commit |
| **B — React Compiler** | #2 | ~30min + verify | Ship now, separate commit (isolate any Compiler-related regressions) |
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
