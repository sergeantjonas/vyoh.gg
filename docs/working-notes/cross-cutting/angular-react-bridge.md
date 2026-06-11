# Angular↔React bridge artifact

**Status:** Reference — idea on file (2026-06-12 exploration, indexed in [idea-pool-2026-06.md](idea-pool-2026-06.md)), not scoped. Promote when a freelance-pitch trigger appears or after current scoped work clears. Independent of all app arcs.

## Why

The freelance positioning is **Angular-deep + React-competent + perf/build/migration specialist**. vyoh.gg demonstrates the React and perf halves convincingly; the Angular half is *claimed, nowhere shown*. Nothing in any backlog addresses this — it is the single most on-positioning artifact available. For migration-shaped leads ("we have an Angular app, considering React" or the reverse), a concrete side-by-side is worth more than any amount of dashboard polish.

## Shape

**One small widget built twice, plus the write-up.** The write-up is the real deliverable; the code exists to make it honest.

- **Widget candidate:** the LP sparkline tile or a cut-down `ConclusionCard` — small, real (data fetch + derived state + a touch of motion), and already has a reference implementation in-tree. Frozen scope: no feature growth ever; it's a specimen.
- **Angular side:** current Angular, zoneless + signals-first, `OnPush`-free modern idiom — the point is showing fluency in *today's* Angular, not 2019 Angular.
- **React side:** extracted/adapted from the in-tree implementation (React 19 + Compiler).
- **Write-up:** "React for Angular engineers" mapping table — signals ↔ state/derived values, DI ↔ context/module scope, zoneless change detection ↔ Compiler memoization, RxJS streams ↔ TanStack Query, template control flow ↔ JSX. Plus measured comparison: bundle size, hydration/startup cost, devtools story. Lands in [docs/case-studies/](../../case-studies/) and the [case-study reader](case-study-reader.md) when that exists.

**Where it lives — companion repo (recommended):** `vyoh-bridge` or similar, linked from the case study and README. Keeps the Angular toolchain out of this workspace (pnpm catalog, Biome config, and CI stay untouched) and gives the artifact its own clean clone-and-run story. The alternative — embedding both builds in [`/lab`](lab-section.md) via iframes — is heavier and couples the app to a second framework's build; only worth it if `/lab` ships anyway and wants a live exhibit.

## Sequencing / dependencies

- Zero coupling to app arcs; can be done in any gap week. Pairs naturally with the case-study reader (distribution) but doesn't depend on it.
- Version-stamp both sides (exact Angular/React versions in the write-up header) so the artifact ages gracefully instead of silently rotting.

## Risks / open questions

- **Maintenance creep:** a second repo that drifts unbuildable is negative signal. Mitigate: lockfile committed, CI smoke build, scope frozen, date-stamped.
- **Fairness:** the comparison must read as fluent in both, not as a React sales pitch — an Angular reviewer should nod along. That's the difference between positioning signal and framework flamebait.
- Open: does the write-up include a "migration playbook" section (incremental strategies, interop seams)? Probably yes — that's the service being sold — but it doubles the write-up scope; decide at pickup.
