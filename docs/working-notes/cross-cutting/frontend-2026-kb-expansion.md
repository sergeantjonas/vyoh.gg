# Frontend 2026 KB — expansion: three new domain files

**Status:** Active — decided 2026-06-12: add domain files **18-angular**, **19-migrations**, **20-data-visualization** to `~/.claude/knowledge/frontend-2026/`. AI-feature frontend patterns explicitly deferred (trigger below). One file per session; suggested order 18 → 20 → 19.

## Why these three (decision record, 2026-06-12)

A gap audit of the 17-file KB against the owner's positioning (Angular-deep + React-competent + perf/build/migration specialist) and vyoh.gg's actual usage found:

1. **Angular** — zero coverage. Only passing mentions in 6 files (01/03/11/12/14/15); entirely absent from `05-frameworks.md`, which covers Next/TanStack Start/RR7/Astro/Nuxt/SvelteKit/SolidStart/Qwik. The owner's deepest expertise area and most plausible freelance engagement shape has no KB backing.
2. **Migrations / brownfield modernization** — fragments only (Rspack-for-webpack-migrations in 07, one passing module-federation mention). No treatment of strangler-fig sequencing, micro-frontends, codemod tooling, or framework-to-framework migration. A third of the positioning statement.
3. **Data visualization** — zero coverage (one incidental d3 mention in a 07 tree-shaking example). vyoh.gg uses Recharts daily and the elevation arcs keep pushing toward data-viz densification; the decisions are live with no KB backing.

**Deferred: AI-feature frontend patterns** (streaming token rendering, AI SDK vs raw SSE, chat UX, optimistic generation). Highest churn rate in the candidate set — would be stale within a quarter. **Trigger to promote:** a concrete project needs an AI-powered UI surface. Until then, one-off questions go through deep-research.

## Conventions every new file must follow

Match the existing 17 files — read 2–3 of them first (06 is a good structural reference: numbered `##` sections with `###` subsections, outline-friendly):

- **`last_verified` frontmatter** (YAML, added KB-wide 2026-06-12). New files are born-verified: set to their compile date. The README's staleness rule (>3 months → cross-check version-specific claims) applies from day one.
- **Dense, decision-shaped, source-cited.** 5,000–8,000 words. Every version number, ship date, statistic, or behavior assertion resolves to an inline markdown link (MDN, spec, vendor release notes, web.dev, caniuse). Unconfirmable claims flagged **uncertain** inline. Prefer "when X, pick Y; trigger Z" over encyclopedic coverage — the KB's value is calibrated judgment with explicit triggers, not facts the model already has.
- **Cross-references are explicit.** Where a topic spans files, point at the other file instead of duplicating (e.g. webpack→Vite mechanics stay in 07; 19 owns the *sequencing strategy* and points at 07 for the tooling).
- **README integration in the same change:**
  - Domain index row (table in README §"Domain index").
  - Load-when-X mapping row(s) (table in README §"How to use this knowledge base").
  - Cross-cutting recommendations / decision-shortcut rows only where the new domain genuinely changes a default.
  - Update the "A 17-file knowledge base" count in the README intro and the "What changed from v1" note.
- **Sweep-queue row:** add a row per new file to [frontend-2026-sweep-queue.md](frontend-2026-sweep-queue.md) §Status with tier rationale (see per-file notes below), status `✅ compiled <date>`.
- Update **this note's** checklist when a file lands.

## File 18 — `18-angular.md`

The one file where **owner calibration beats web research**. The owner has ~10y Angular; the compiling session should lean on interview-style drafting (propose judgment calls, let the owner confirm/correct) rather than synthesizing purely from public sources. Public sources date claims; the owner supplies the "what actually bites in production" layer.

Scope:

- **Modern Angular state of the union** (v19/v20 era): signals as the reactivity primitive (signal/computed/effect, `input()`/`model()`/`output()`), zoneless change detection status and migration path off zone.js, standalone-by-default (NgModules as legacy), new control flow (`@if`/`@for`/`@defer`), SSR + hydration (incremental hydration, event replay), Material 3 / CDK status.
- **The Angular-vs-React decision calculus in 2026** — when Angular wins (form-heavy enterprise, DI-shaped testability, team already deep, long-lived LOB apps), when it loses. This is the row missing from 05; write it here and add a cross-ref stub in `05-frameworks.md` §comparison pointing at 18 (one paragraph in 05, depth in 18 — don't duplicate).
- **Intra-Angular migration ladders**: NgModules→standalone, RxJS-imperative→signals (interop via `toSignal`/`toObservable`), zone→zoneless, ViewEngine-era patterns that still haunt brownfield codebases. Each with effort signals and sequencing.
- **Ecosystem picks** decision-shaped like the README stack table: state (NgRx vs NgRx SignalStore vs plain signals services), testing (Jest/Vitest vs Karma exit paths, Spectator/Testing Library), component libraries, Nx-for-Angular.
- **Angular CLI / build**: esbuild-based `application` builder status, what `ng update` automates vs doesn't.

Staleness tier: **slow decay** — Angular's 6-month major cadence is predictable and the judgment layer doesn't expire. Sweep-queue rationale: citation refresh per Angular major.

## File 19 — `19-migrations.md`

Owns migration **strategy and sequencing**; tooling mechanics stay in the files that already cover them (07 for bundlers, 18 for intra-Angular, 05 §2 for framework migration considerations — cross-ref all three).

Scope:

- **Strangler-fig sequencing** for frontend: route-by-route takeover, proxy/shell patterns, when big-bang is actually cheaper (small apps, dead-end stacks).
- **Micro-frontends and module federation** — decision-shaped and skeptical: when MF is load-bearing (independent deploy cadence across teams) vs résumé-driven; Module Federation 2.x / Rspack status; single-spa's 2026 standing; the "just use a monorepo" counter-default.
- **Framework-to-framework**: AngularJS→Angular hybrid exits (ngUpgrade end-state), Angular→React incremental adoption (web-components bridge vs route-level split), CRA→Vite, webpack→Rspack/Vite (sequencing here, mechanics in 07).
- **Codemod tooling**: jscodeshift, ts-morph, ast-grep, framework-official codemods (`ng update`, Next codemods) — when to write one vs hand-migrate (threshold: call-site count × mechanical-ness).
- **Migration-safe prep patterns** — the forward-compat moves that pay off before the migration starts (the KB already has two instances: per-route `head()` before SSR in 13 §8, route-loader pilot in 05 §2; generalize the pattern).
- **Risk rails**: characterization tests before refactor, visual-regression as migration safety net (cross-ref 10 §7), feature-flag-gated cutovers, parallel-run validation.

Staleness tier: **slow decay** — strategy patterns outlive tool versions. Sweep-queue rationale: refresh when Module Federation or a major framework's official migration story ships a step-change.

## File 20 — `20-data-visualization.md`

Grounded in live vyoh.gg decisions — the compiling session should audit vyoh's actual Recharts usage first (Phase-1-style, per the sweep-queue discipline) so the file's triggers are concrete, and write any project-side findings to the usual artifacts (gaps/quick-wins/library-shortlist).

Scope:

- **Library landscape, decision-shaped**: Recharts vs visx vs Observable Plot vs ECharts vs Chart.js vs nivo vs hand-rolled d3 — when each wins/loses, with the "you already know React; do you need a chart grammar or chart components?" axis. Include the d3-as-utilities-not-renderer pattern (d3-scale/d3-shape under React-owned DOM).
- **SVG vs Canvas vs WebGPU cliffs**: point-count thresholds where SVG DOM weight breaks (cross-ref the repo's layer-budget experience), OffscreenCanvas + worker rendering, when ECharts' canvas renderer is the answer.
- **Chart a11y** — the genuinely underdocumented area: what screen readers actually do with SVG charts, table-fallback patterns, `role="img"` + structured description vs navigable data points, sonification status (cross-ref 09).
- **Perf patterns**: animation of chart state (cross-ref 03 — Motion vs chart-library tweens), responsive containers without ResizeObserver thrash, downsampling (LTTB) before render.
- **Visual grammar**: color scales in OKLCH (cross-ref 01), sequential/diverging/categorical palette rules, dark-mode chart palettes, small-multiples vs overloaded single charts.
- **Tables-as-viz**: TanStack Table + sparkline patterns — vyoh's actual dominant shape.

Staleness tier: **moderate** — library churn is real but slower than AI tooling. Sweep-queue rationale: tier-2-style refresh cadence; re-verify on a major Recharts/visx/Plot release.

## Checklist

- [ ] 18-angular.md compiled + README integration + sweep-queue row
- [ ] 20-data-visualization.md compiled (vyoh Recharts audit first) + README integration + sweep-queue row
- [ ] 19-migrations.md compiled + README integration + sweep-queue row + cross-ref stubs in 05/07/18
- [ ] README file-count + "What changed from v1" updated (can land with the first file and be bumped per file)

## What this file is NOT

- Not a sweep-queue replacement — refresh cadence for the new files lives in [frontend-2026-sweep-queue.md](frontend-2026-sweep-queue.md) once they exist.
- Not a commitment to the deferred AI-patterns file — that needs its trigger to fire, and gets its own scoping pass when it does.
- Not a vyoh.gg feature arc — KB files are cross-project artifacts; only the File 20 Phase-1-style audit produces project-side output.
