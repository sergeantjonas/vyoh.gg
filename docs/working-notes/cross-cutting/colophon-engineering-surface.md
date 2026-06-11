# Colophon — public engineering surface

**Status:** Reference — idea on file (2026-06-12 exploration, indexed in [idea-pool-2026-06.md](idea-pool-2026-06.md)), not scoped. Promote to Active with a chunk plan + open-work entry when picked. Strongest after hosting lands (RUM needs real visitors), but the static half can ship earlier.

## Why

The project's engineering rigor — per-route paint budgets, a custom perf probe, a web-vitals bus, axe scans in CI, strict TS, 21 case studies — is invisible to a visitor. Most portfolios *claim* performance; showing **live budgets vs actuals** is a category of proof almost nobody ships. This is the single biggest unrealized portfolio asset on file.

Concretizes the vnext Observability entry "Web Vitals dashboard … public version is a case-study anchor" ([vnext-ideas.md](vnext-ideas.md#foundational--invisible-but-valuable-)) — treat that prior entry as +1 promotion signal.

## Shape

A `/colophon` route (utility route, page-grounded, no backdrop — bare tile tier per the [tile convention](../../repo-conventions.md#tile-background-one-level-of-glass-between-background-and-content)). Candidate bands, roughly in value order:

1. **RUM vitals** — p75 LCP / INP / CLS per top-level route. The multi-subscriber web-vitals bus already exists (`?perf=1` overlay + console subscriber per [library-shortlist.md](library-shortlist.md)); the new piece is a small API ingest endpoint + aggregate table + chart. Until launch this only collects owner traffic — honest label required ("n=…").
2. **Perf budgets vs actuals** — render the per-route layer/raster budget table from [repo-conventions.md](../../repo-conventions.md#layer-count--paint-budget-per-route-scenario) next to the latest [perf-probe](../../../tools/perf-probe/) numbers. If [perf-probe-ci-gate.md](perf-probe-ci-gate.md) ships, this band reads straight from the committed CI artifact — the two notes compound.
3. **Build facts** — per-route chunk sizes (build-time manifest), dependency count, TS strictness flags, test counts + coverage. All static, derivable at build time, zero runtime cost.
4. **Accessibility statement** — WCAG 2.2 AA self-assessment: axe-scan coverage, `prefers-reduced-motion` / `prefers-reduced-transparency` support (both already implemented), keyboard coverage. Gaming sites essentially never publish this; agencies and enterprise clients notice. Folded in here rather than its own note — it's the same "engineering trust made visible" surface.
5. **Stack narrative** — one paragraph per layer with links into the [case-study reader](case-study-reader.md) when that exists.

## Sequencing / dependencies

- Bands 3–5 are static and could ship pre-hosting. Band 1 needs the ingest endpoint and is only honest post-launch. Band 2 is best after the CI gate exists, else it's hand-pasted numbers that will drift.
- `/status` already exists as the operational surface (sync state, rate limiter). Keep them separate: `/status` = "is it healthy now", `/colophon` = "how it's built and how well". Cross-link, don't merge.
- New sectionless top-level route → no scroll wiring needed per the [scroll convention](../../repo-conventions.md#scroll-to-top-is-layered-between-root-and-section-roots); palette navigation entry in the same change per the [palette convention](../../repo-conventions.md#extend-the-command-palette-when-adding-filterable-surfaces).

## Risks / open questions

- **Stale-data risk is the real one.** Hand-maintained numbers rot and a rotted colophon is worse than none. Every band must be generated (build manifest, CI artifact, RUM aggregate) — if a band can't be automated, cut it.
- Deliberately **no tracing**: OpenTelemetry stays deferred per [vnext-ideas.md](vnext-ideas.md#low-priority--explicitly-deferred); this surface reads from data the app already produces.
- Route name: `/colophon` is the editorial choice; `/about` is the discoverable one. Decide at scoping.
