# Repo conventions

Portable workflow, environment, and architectural rules for vyoh.gg. Committed so they survive across machines. 

Code-site-specific facts live as comments at the relevant source location, not here. This file holds only what is too cross-cutting to attach to one file.

## Architecture

Web-surface conventions — server rendering and hydration, the production build, the styling system (surface treatment, tiles, chrome, headers, tooltips), engine gating, and the per-route paint budgets — live in [repo-conventions-web.md](./repo-conventions-web.md), read on demand rather than auto-loaded with this file. Read it before adding or styling any web surface, touching a route `loader`, changing the build, or adding layer-promoting CSS.

### Per-stream routes; `/` is synthesis-only

Each integration owns its own top-level route tree: `/lol/...`, `/steam/...`, and future streams get their own (`/music` for Spotify, `/code` for GitHub + WakaTime, etc.). Never embed Steam-specific components into LoL-scoped routes (e.g. `/lol/$accountSlug/*`) — and don't do the reverse.

`/` is for cross-stream *synthesis* — content that combines multiple streams into one verdict (chronotype hour-bucketing across LoL + commits, "what am I doing right now" picking the dominant live stream). A "top tracks this week" or "latest commit" tile on `/` is wrong-place; it belongs on its per-stream route. `/` may carry at most a single curated highlight per stream that links into the deep route.

**Why:** Domain separation matches the data model (`/lol/$accountSlug` is one Riot account; Steam has nothing to do with that account) and keeps the portfolio framing clean (each integration becomes its own case study, with `/` as the aggregator). If `/` accumulates one stream-feed per integration, the synthesis story drowns and the page reads as a mixed-bag dashboard rather than a self-portrait.

**How to apply:** When scoping any new integration UI, default to its own route subtree. Only put something on `/` if it is explicitly cross-stream synthesis. If a working note says "Profile-page section placeholder" without naming the page, treat it as ambiguous and confirm the surface — don't assume the LoL profile page just because it has stacked `Profile*` components.

### Scroll-to-top is layered between root and section roots

`<main>` (not `window`) is the scroll container and TanStack Router's `scrollRestoration` is disabled, so every route transition would otherwise inherit the previous `scrollTop`. The reset is split by component lifetime:

- **`apps/web/src/routes/__root.tsx`** owns cross-scope reset, keyed on `topLevelScope(pathname)`. The root layout stays mounted across every navigation, so it sees `/lol/x` → `/`, `/steam` → `/status`, etc. Sectionless top-level routes (`/`, `/status`) need no wiring of their own — the root handles them.
- **Section roots** (e.g. [apps/web/src/routes/lol/$accountSlug.tsx](../apps/web/src/routes/lol/$accountSlug.tsx), [apps/web/src/routes/steam.tsx](../apps/web/src/routes/steam.tsx)) own intra-section reset via `useScrollResetOnNav(pathname, skips)` from [apps/web/src/lib/use-scroll-reset-on-nav.ts](../apps/web/src/lib/use-scroll-reset-on-nav.ts). The root doesn't reset for same-scope navigation, and the section root is the longest-lived component that can still see those transitions. The `skips` param exists for list↔detail back-restore (match-list, champion-table).

**Why:** A single root-level unconditional reset would break the per-section skip mechanism. A pure section-root pattern silently breaks for sectionless routes (`/`, `/status`) and for cross-section navigation, because `useScrollResetOnNav` returns early on first mount (`prev === null`) — calling it from a freshly-mounted leaf or section component is a no-op.

**How to apply:** When adding a new section (TFT, future verticals), call `useScrollResetOnNav` in the section root in the same change, with `skips` for any list↔detail back-restore pairs. When adding a new sectionless top-level route, no scroll wiring is needed. **Never** call `useScrollResetOnNav` from a leaf route component — the first-mount no-op makes it look like it works in dev (subsequent intra-route navigation, if any, would fire) but it doesn't reset on the navigation that brought you there. If a sectionless route grows children and becomes a section, add `useScrollResetOnNav` to its new layout component at that point.

### Virtualize only when the list can exceed ~100 items AND grows via paged loading

A virtualizer (`@tanstack/react-virtual` etc.) trades implementation cost for render cost. **Implementation cost is real:** scroll-restore needs a pin loop, the loop has to be StrictMode-resilient (mount → cleanup → remount races the first RAF and can leave scroll stuck — see the `pinCompletedRef` pattern in [apps/web/src/lol/matches/match-list.tsx](../apps/web/src/lol/matches/match-list.tsx)), the virtualizer container's `getTotalSize()` height has to land before the first scrollTo, intersection-observer plumbing has to coexist with whatever else mounts in the route, and the whole thing interacts with AnimatePresence + route transitions in ways that take a while to debug. **Render cost is negligible at small N:** 50 rows of a tilt-card with hover state and Motion variants are not a perf problem on any mainstream device.

**Use a virtualizer when:**
- The list count can exceed ~100 items (a Steam library of 500 games, an active match history of 1000+ matches), AND
- The list grows via infinite scroll / paged loading rather than a bounded fetch, AND
- A representative render of the full list shows actual measurable jank (long tasks > 50 ms, dropped frames on scroll).

**Do NOT virtualize when:**
- The count has a structural cap (champion list at ~150 unique champions max, patches list at ~30 over a season, profile widgets that fan out to single-digit counts).
- The list is part of a bounded view (recap match-by-match, trend rollup rows).
- "It might get longer eventually" — virtualize *when* it does, not pre-emptively. Future-you can always add it; future-you can't easily remove it.

**Why:** Pre-emptively virtualizing a bounded list buys ~zero render savings and adds a class of bugs that take real time to diagnose. The match-list virtualizer is justified (potentially 1000+ matches via infinite scroll); the champion-list is not (capped, no infinite scroll); the Steam library is *now* virtualized (2026-05-24, see [apps/web/src/steam/library/library-list-virtual.tsx](../apps/web/src/steam/library/library-list-virtual.tsx) and [library-grid-virtual.tsx](../apps/web/src/steam/library/library-grid-virtual.tsx)) — promoted because a 500+ game library renders 2000–3000 DOM nodes on first paint and shows measurable scroll/transition jank on the representative dataset, even though the count is capped per user.

**How to apply:** When adding a new list surface, default to a flat unvirtualized render. Re-evaluate only if perf measurement shows a problem on a realistic dataset. Promote when ANY of the following hold on a representative dataset: more than ~200 unvirtualized items rendered at once, first-paint DOM weight above ~800 nodes from the list alone, or measurable jank during scroll or route transitions. When promoting, plan it as a focused change that's tested specifically for scroll-restore + nav-transition interactions; grid-shaped lists use TanStack's `lanes` parameter (see [library-grid-virtual.tsx](../apps/web/src/steam/library/library-grid-virtual.tsx)) with lane count driven by a media-query hook that mirrors the static-grid breakpoints it replaces.

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

### API response types live in `packages/shared`, and the controller declares them

Every NestJS route handler that returns a JSON body carries an **explicit** return type, and that type is imported from `@vyoh/shared` — not declared locally in `apps/api`, and not left to inference. The web hook that consumes the endpoint annotates its fetch function with the *same* imported type.

```ts
// packages/shared/src/lol/match-detail.ts
export type MatchDetail = { … };

// apps/api/src/lol/match.controller.ts
async getMatch(@Param() { matchId }: MatchIdParamDto): Promise<MatchDetail> { … }

// apps/web/src/lol/matches/use-match-detail.ts
async function fetchMatchDetail(matchId: string): Promise<MatchDetail> { … }
```

**Why:** this is what makes API drift a *build* failure instead of a runtime one. The shared type is the contract; the controller's explicit annotation is what pins the api to it. Drop the annotation and the handler's return type becomes whatever the service happens to return, so the contract silently re-shapes itself around the drift and web keeps type-checking against a type that no longer describes the response. The web-side annotation matters for the same reason in reverse: `res.json()` is `any`, so an unannotated fetch function launders a wrong shape into confident-looking typed code.

A local mirror in `apps/web` is the trap this rule exists to prevent — it type-checks perfectly while describing a response the api no longer sends. Exporting the type from `apps/api` instead is also wrong: it inverts the package boundary (`apps/*` depending on `apps/*`) and drags Nest internals into web's typecheck graph.

Note the limit of the guarantee: this is compile-time only. `class-validator` covers **request** params; nothing validates a response body at runtime, by decision (see the parked entry in [working-notes/parked.md](./working-notes/parked.md)).

**How to apply:** when adding an endpoint, define its response type in `packages/shared/src/<domain>/` first, export it from the barrel, then annotate both ends against it. When touching an existing endpoint whose handler has no return type, add one in the same change rather than leaving it. If you are about to write a `type Foo = { … }` in a web hook to describe a response, the type belongs in shared instead.

**This is unlinted** — `biome.json` sets no `useExplicitType` and `apps/api/src/conventions.spec.ts` carries no controller assertion — so it holds by review, not by tooling. A 2026-07-26 audit measured the actual posture at 58 of 61 web fetch sites and 62 of 65 JSON-returning handlers already conforming, with the 6 stragglers tracked in [open-work.md](./working-notes/open-work.md). If that ratio ever slips, add the lint rather than re-auditing.

### Centralise domain invariants that must apply to every aggregation in a feature

If a predicate or filter must hold for *every* stat computation, rollup, or display in a feature domain, define it as a named helper in `packages/shared/src/<domain>/` — never inline it at each call site. An inlined filter can be silently omitted when a new aggregation is added under time pressure; a named helper cannot.

**Why:** A 2026-05-18 audit found 12+ inlined `matches.filter((m) => !m.remake)` sites across the LoL feature. The remake filter is an explicit invariant (all stat computation must exclude remakes), yet nothing prevented a future aggregation from omitting it. The pattern applies to any domain that has must-hold preconditions — e.g. filtering invalid/incomplete records before aggregation, excluding test/bot accounts, excluding unsupported game modes.

**How to apply:** When writing a new LoL aggregation, call `excludeRemakes()` from `@vyoh/shared` before computing stats — never re-derive `!m.remake` inline. For other feature domains, check whether must-hold preconditions exist and define a named helper in `packages/shared/src/<domain>/` the same way. If the helper doesn't exist yet, create it in the same change.

**Iterate the helper, don't guard inside the loop.** `for (const m of excludeRemakes(matches))` is the shape; `for (const m of matches) { if (m.remake) continue; … }` is not. The two behave identically, which is exactly the problem: the second one hides from review and from tooling. Ten of them survived a dedicated sweep in 2026-07 because the structural lint only understood `.filter(…)` call shapes. Both forms are now linted in `apps/api/src/conventions.spec.ts`, and each lint carries fixtures asserting what it must *not* flag — the `continue` scoping is what spares `match-hero`'s single-match display guard and the backfill script.

Two failures reached production through the gap this rule closes, both in code that never spelled `remake` at a filter site: `buildOutcomeSignal` walked an unfiltered history so a remake could pad a streak, and `getChampionExtras` counted remade games into item and matchup win rates. If an aggregation reads a match list and you cannot point at the `excludeRemakes()` call, assume it is wrong.

### Use `useChampionName()` for all champion name display

When rendering a champion's name in any UI component, call `useChampionName()` from `@/lol/champions/use-champions` and use the returned function at the render site — never render a raw alias string directly as a display label.

**Why:** Champion aliases from the Riot API are internal identifiers that diverge from display names for multi-word champions and renamed champions (e.g. `"JarvanIV"` → `"Jarvan IV"`, `"MonkeyKing"` → `"Wukong"`, `"AurelionSol"` → `"Aurelion Sol"`). Rendering the alias produces incorrect UI silently.

**How to apply:** `const championName = useChampionName()` once at the top of the component; call `championName(alias)` at each render site. The hook falls back to a normalized alias while champion data loads, so the string is always safe to render.

### Committed generated files must be documented here

Generated files (codegen output, router manifests, OpenAPI clients, Prisma artefacts) default to gitignored. Commit a generated file only when there is a deliberate reason (e.g. zero-cold-start dev, diff-as-audit-log), and record that reason in this section so the next reviewer doesn't raise it as a defect.

**Currently committed generated files:**

- `apps/web/src/routeTree.gen.ts` — TanStack Router file-based route manifest. Kept tracked so `pnpm dev` works immediately after `pnpm install` without a generate step; the diff also serves as a readable audit log when routes change.
- `packages/shared/src/lol/champion-assets.gen.ts` — champion accent colors + blurhashes precomputed from wiki art by `tools/champion-assets` (full rationale: [build-time-champion-assets.md](case-studies/build-time-champion-assets.md)). Committed because regeneration needs ~500 wiki fetches and the alphabetical diff doubles as the review artifact. Emitted as TS rather than JSON so it flows through the api's SWC build and the web's Vite build identically; typechecked against the handwritten `ChampionAssetsFile` shape, ignored by Biome via the `**/*.gen.ts` pattern.

**How to apply:** When introducing a new codegen plugin, decide commit-vs-ignore intentionally and add a line here if committing. When reviewing a PR, a committed generated file without an entry here is a finding.

## Testing

### New interactive surfaces get a test in the same commit

When adding a component that has any of the following, include a test file in the same commit — not as a follow-up:

- Routing (TanStack Router `Link`, `useRouterState`, `useNavigate`)
- Keyboard interaction (keyboard shortcut handlers, `onKeyDown`)
- Custom ARIA roles or `aria-*` attributes beyond simple `aria-label`
- Context providers that drive visible state (e.g. `SplashProvider`, `CommandPaletteProvider`)

**Why:** The T3–T5 hygiene sweep (2026-05-18) found the highest-risk surfaces (command palette, match-detail tab nav, scroll restoration, splash backdrop) had zero tests despite driving most user-perceived behavior. Test-after-the-fact costs more and is easy to defer indefinitely.

**How to apply:** Write the test file alongside the component, not in a separate "add tests" commit. Use the patterns established in `apps/web/src/components/command-palette-dialog.test.tsx` (keyboard shortcut + filter behavior), `apps/web/src/steam/wishlist/wishlist-tabs.test.tsx` (ARIA tab roles, roving focus, axe), `apps/web/src/lib/use-scroll-reset-on-nav.test.ts` (hook with `renderHook`), and `apps/web/src/components/accessibility.test.tsx` (axe scan). For routing, mock `@tanstack/react-router` per the pattern in `apps/web/src/lol/matches/match-list.test.tsx`.

### Axe-scan new interactive components

When adding a component with interactive elements (buttons, links, dialogs, tabs, custom roles), include an axe scan in the test. Add it to `apps/web/src/components/accessibility.test.tsx` or colocate it in the component's own test file.

**Why:** Axe catches structural a11y gaps (missing dialog titles, unlabelled icon buttons, broken role hierarchy) that are invisible in visual review. The T5 sweep found a real gap: `CommandPaletteDialog` lacked a screen-reader `DialogTitle` that would have been missed indefinitely without the scan.

**How to apply:** Use `configureAxe` from `jest-axe` with `color-contrast` disabled (requires real computed styles) and `aria-hidden-focus` disabled (Radix Dialog false positive in happy-dom). Assert `results.violations` has length 0 so failures print the violation list. See `apps/web/src/components/accessibility.test.tsx` for the canonical setup.

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
