# Repo conventions — rationale

The **Why** behind most rules in [repo-conventions.md](./repo-conventions.md). Split out so the rules load into every session while the reasoning is read on demand: open the matching heading here before arguing a rule has gone stale, and add a paragraph here whenever a rule is added there.

## Architecture

### Per-stream routes; `/` is synthesis-only

Domain separation matches the data model (`/lol/$accountSlug` is one Riot account; Steam has nothing to do with that account) and keeps the portfolio framing clean (each integration becomes its own case study, with `/` as the aggregator). If `/` accumulates one stream-feed per integration, the synthesis story drowns and the page reads as a mixed-bag dashboard rather than a self-portrait.

### Scroll-to-top is layered between root and section roots

A single root-level unconditional reset would break the per-section skip mechanism. A pure section-root pattern silently breaks for sectionless routes (`/`, `/status`) and for cross-section navigation, because `useScrollResetOnNav` returns early on first mount (`prev === null`) — calling it from a freshly-mounted leaf or section component is a no-op.

### Virtualize only when the list can exceed ~100 items AND grows via paged loading

Pre-emptively virtualizing a bounded list buys ~zero render savings and adds a class of bugs that take real time to diagnose. The match-list virtualizer is justified (potentially 1000+ matches via infinite scroll); the champion-list is not (capped, no infinite scroll); the Steam library is *now* virtualized (2026-05-24, see [apps/web/src/steam/library/library-list-virtual.tsx](../apps/web/src/steam/library/library-list-virtual.tsx) and [library-grid-virtual.tsx](../apps/web/src/steam/library/library-grid-virtual.tsx)) — promoted because a 500+ game library renders 2000–3000 DOM nodes on first paint and shows measurable scroll/transition jank on the representative dataset, even though the count is capped per user.

### Skeleton loaders must mirror the layout they replace

A generic skeleton causes a visible reflow the moment real content swaps in, which reads as jank even though every individual transition is smooth. Worse, it lies to the user about what's loading — a participant-list shimmer on the Timeline tab promises team rows that never arrive.

### Extend the command palette when adding filterable surfaces

The palette is the explicit handoff from the reverted sticky-controls bar. Scattering filter UI across leaf pages re-invents the problem that handoff was meant to solve and forks the vocabulary away from the shared parser.

### Cross-package utilities belong in `packages/shared/src/`

Duplication drifts. A hygiene sweep on 2026-05-18 found 6+ independent copies of duration/playtime/gold formatters scattered across `apps/web` and `apps/api`, with enough variation between them that a future display inconsistency was only a matter of time.

### API response types live in `packages/shared`, and the controller declares them

This is what makes API drift a *build* failure instead of a runtime one. The shared type is the contract; the controller's explicit annotation is what pins the api to it. Drop the annotation and the handler's return type becomes whatever the service happens to return, so the contract silently re-shapes itself around the drift and web keeps type-checking against a type that no longer describes the response. The web-side annotation matters for the same reason in reverse: `res.json()` is `any`, so an unannotated fetch function launders a wrong shape into confident-looking typed code.

### Centralise domain invariants that must apply to every aggregation in a feature

A 2026-05-18 audit found 12+ inlined `matches.filter((m) => !m.remake)` sites across the LoL feature. The remake filter is an explicit invariant (all stat computation must exclude remakes), yet nothing prevented a future aggregation from omitting it. The pattern applies to any domain that has must-hold preconditions — e.g. filtering invalid/incomplete records before aggregation, excluding test/bot accounts, excluding unsupported game modes.

### A response that varies by viewer is scoped on both sides

The halves fail in different directions. A missing scope in the key corrupts the cache for whoever loads second; a missing cookie corrupts it quietly for the owner alone. Neither is a type error, and neither shows up in a render — the page just describes a library that isn't yours.

### Use `useChampionName()` for all champion name display

Champion aliases from the Riot API are internal identifiers that diverge from display names for multi-word champions and renamed champions (e.g. `"JarvanIV"` → `"Jarvan IV"`, `"MonkeyKing"` → `"Wukong"`, `"AurelionSol"` → `"Aurelion Sol"`). Rendering the alias produces incorrect UI silently.

## Testing

### New interactive surfaces get a test in the same commit

The T3–T5 hygiene sweep (2026-05-18) found the highest-risk surfaces (command palette, match-detail tab nav, scroll restoration, splash backdrop) had zero tests despite driving most user-perceived behavior. Test-after-the-fact costs more and is easy to defer indefinitely.

### Axe-scan new interactive components

Axe catches structural a11y gaps (missing dialog titles, unlabelled icon buttons, broken role hierarchy) that are invisible in visual review. The T5 sweep found a real gap: `CommandPaletteDialog` lacked a screen-reader `DialogTitle` that would have been missed indefinitely without the scan.
