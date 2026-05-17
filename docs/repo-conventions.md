# Repo conventions

Portable workflow, environment, and architectural rules for vyoh.gg. Committed so they survive across machines. 

Code-site-specific facts live as comments at the relevant source location, not here. This file holds only what is too cross-cutting to attach to one file.

## Architecture

### Per-stream routes; `/` is synthesis-only

Each integration owns its own top-level route tree: `/lol/...`, `/steam/...`, and future streams get their own (`/music` for Spotify, `/code` for GitHub + WakaTime, etc.). Never embed Steam-specific components into LoL-scoped routes (e.g. `/lol/$accountSlug/*`) — and don't do the reverse.

`/` is for cross-stream *synthesis* — content that combines multiple streams into one verdict (chronotype hour-bucketing across LoL + commits, "what am I doing right now" picking the dominant live stream). A "top tracks this week" or "latest commit" tile on `/` is wrong-place; it belongs on its per-stream route. `/` may carry at most a single curated highlight per stream that links into the deep route.

**Why:** Domain separation matches the data model (`/lol/$accountSlug` is one Riot account; Steam has nothing to do with that account) and keeps the portfolio framing clean (each integration becomes its own case study, with `/` as the aggregator). If `/` accumulates one stream-feed per integration, the synthesis story drowns and the page reads as a mixed-bag dashboard rather than a self-portrait.

**How to apply:** When scoping any new integration UI, default to its own route subtree. Only put something on `/` if it is explicitly cross-stream synthesis. If a working note says "Profile-page section placeholder" without naming the page, treat it as ambiguous and confirm the surface — don't assume the LoL profile page just because it has stacked `Profile*` components.

### Skeleton loaders must mirror the layout they replace

A skeleton loader's job is to reserve the shape of incoming content, not to render a generic shimmer. If a page has multiple tabs/sections with different layouts (e.g. match-detail's Recap / Your game / Timeline), the skeleton must branch on the active surface — the example pattern lives in [apps/web/src/lol/matches/match-detail-skeleton.tsx](../apps/web/src/lol/matches/match-detail-skeleton.tsx), gated by tab prop in [apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx](../apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx).

**Why:** A generic skeleton causes a visible reflow the moment real content swaps in, which reads as jank even though every individual transition is smooth. Worse, it lies to the user about what's loading — a participant-list shimmer on the Timeline tab promises team rows that never arrive.

**How to apply:** When adding a new tab, sub-route, or layout variant to a section that has a skeleton loader, extend the skeleton in the same change — don't ship the new layout against the old skeleton. When restructuring an existing layout (adding a header strip, removing a column, changing grid shape), update the corresponding skeleton in the same commit. Treat the skeleton as part of the layout, not a separate concern.

### Extend the command palette when adding filterable surfaces

When adding a new filterable list, deep-link action, or "find by X" affordance, default to extending the ⌘K command palette rather than shipping a leaf-page dropdown, sticky controls bar, or one-off filter chip. The palette is the project's single "find anything" surface, with its grammar parser living in `@vyoh/shared`. Full plan and chunk list: [docs/working-notes/cross-cutting/command-palette.md](./working-notes/cross-cutting/command-palette.md).

**Why:** The palette is the explicit handoff from the reverted sticky-controls bar. Scattering filter UI across leaf pages re-invents the problem that handoff was meant to solve and forks the vocabulary away from the shared parser.

**How to apply:** When scoping any task that touches a filterable surface or adds a "find by X" intent, include an "extend palette grammar/groups" sub-chunk in the plan and update the chunk list in `command-palette.md`. If a feature genuinely doesn't fit the palette (spatial selection, live-preview range slider, drag-to-reorder), document why in the working-note before adding parallel UI.

### Cross-package utilities belong in `packages/shared/src/`

If a helper function (formatter, type guard, domain utility) is used across more than one package, it lives in `packages/shared/src/` — not inlined per-component or duplicated per-service. Each package may still have private helpers for single-package concerns, but once a helper escapes into a second package it must be consolidated.

**Why:** Duplication drifts. A hygiene sweep on 2026-05-18 found 6+ independent copies of duration/playtime/gold formatters scattered across `apps/web` and `apps/api`, with enough variation between them that a future display inconsistency was only a matter of time.

**How to apply:** Before writing a new utility function, check `packages/shared/src/` first. Before copying a helper from one package into another, move it to shared instead. When refactoring a feature, treat cross-package duplication as a defect, not style.

### Centralise domain invariants that must apply to every aggregation in a feature

If a predicate or filter must hold for *every* stat computation, rollup, or display in a feature domain, define it as a named helper in `packages/shared/src/<domain>/` — never inline it at each call site. An inlined filter can be silently omitted when a new aggregation is added under time pressure; a named helper cannot.

**Why:** A 2026-05-18 audit found 12+ inlined `matches.filter((m) => !m.remake)` sites across the LoL feature. The remake filter is an explicit invariant (all stat computation must exclude remakes), yet nothing prevented a future aggregation from omitting it. The pattern applies to any domain that has must-hold preconditions — e.g. filtering invalid/incomplete records before aggregation, excluding test/bot accounts, excluding unsupported game modes.

**How to apply:** When writing a new LoL aggregation, call `excludeRemakes()` from `@vyoh/shared` before computing stats — never re-derive `!m.remake` inline. For other feature domains, check whether must-hold preconditions exist and define a named helper in `packages/shared/src/<domain>/` the same way. If the helper doesn't exist yet, create it in the same change.

### Use `useChampionName()` for all champion name display

When rendering a champion's name in any UI component, call `useChampionName()` from `@/lol/champions/use-champions` and use the returned function at the render site — never render a raw alias string directly as a display label.

**Why:** Champion aliases from the Riot API are internal identifiers that diverge from display names for multi-word champions and renamed champions (e.g. `"JarvanIV"` → `"Jarvan IV"`, `"MonkeyKing"` → `"Wukong"`, `"AurelionSol"` → `"Aurelion Sol"`). Rendering the alias produces incorrect UI silently.

**How to apply:** `const championName = useChampionName()` once at the top of the component; call `championName(alias)` at each render site. The hook falls back to a normalized alias while champion data loads, so the string is always safe to render.

### Committed generated files must be documented here

Generated files (codegen output, router manifests, OpenAPI clients, Prisma artefacts) default to gitignored. Commit a generated file only when there is a deliberate reason (e.g. zero-cold-start dev, diff-as-audit-log), and record that reason in this section so the next reviewer doesn't raise it as a defect.

**Currently committed generated files:**

- `apps/web/src/routeTree.gen.ts` — TanStack Router file-based route manifest. Kept tracked so `pnpm dev` works immediately after `pnpm install` without a generate step; the diff also serves as a readable audit log when routes change.

**How to apply:** When introducing a new codegen plugin, decide commit-vs-ignore intentionally and add a line here if committing. When reviewing a PR, a committed generated file without an entry here is a finding.

## Environment

### Owner timezone: Brussels

Owner lives near Brussels, Belgium. Use `Europe/Brussels` for any owner-local time bucketing (chronotype hour buckets, daily streak boundaries, "today/yesterday" framing) — not Berlin or UTC.

### Restart Firefox after a devcontainer rebuild

Blank pages or empty-status rows on `localhost:<port>` after a devcontainer rebuild are stale HTTP/2 streams that the browser is holding from the previous container. Storage clears, extension toggling, and ETP exemptions won't fix it — only a Firefox restart does. Mention this proactively if symptoms match.

## Workflow

### Simulating network hangs for timeout verification

Use `10.255.255.1` (RFC1918 black-hole address — TCP SYN goes nowhere, packets drop silently) when verifying that a timeout actually fires. Do not use `.invalid` TLDs (DNS resolves instantly to failure — different code path) or DevTools request blocking (also different code path). Only `10.255.255.1` reproduces a true network-level hang.

### Ask for a dev server restart instead of routing around stale state

When a non-reloaded API/web blocks live verification (Nest cold-start, new env var not picked up, Vite plugin change not HMR'd), ask the owner to restart the relevant dev server immediately. Do not invent workarounds that produce false positives — the cost of asking is a few seconds; the cost of debugging stale state is much higher.

### Verify "file is tracked" claims with `git ls-files` before acting

When an audit or automated tool claims a file is committed to the repo (e.g. "secrets in source", "generated file tracked"), verify with `git ls-files <path>` before raising the alarm or taking remediation steps. Working-tree presence does not imply tracked state — `.gitignore` rules are not always obvious, and acting on a false positive (e.g. rotating API keys that were never committed) wastes time and creates unnecessary churn.
