# Repo conventions

Portable workflow, environment, and architectural rules for vyoh.gg. Committed so they survive across machines. 

Code-site-specific facts live as comments at the relevant source location, not here. This file holds only what is too cross-cutting to attach to one file. The reasoning behind most rules here lives in [repo-conventions-why.md](./repo-conventions-why.md), read on demand — check it before arguing a rule has gone stale, and extend it when adding a rule here. [repo-conventions-web.md](./repo-conventions-web.md) keeps its own rationale inline.

## Architecture

Web-surface conventions — server rendering and hydration, the production build, the styling system (surface treatment, tiles, chrome, headers, tooltips), engine gating, and the per-route paint budgets — live in [repo-conventions-web.md](./repo-conventions-web.md), read on demand rather than auto-loaded with this file. Read it before adding or styling any web surface, touching a route `loader`, changing the build, or adding layer-promoting CSS.

### Per-stream routes; `/` is synthesis-only

Each integration owns its own top-level route tree: `/lol/...`, `/steam/...`, and future streams get their own (`/music` for Spotify, `/code` for GitHub + WakaTime, etc.). Never embed Steam-specific components into LoL-scoped routes (e.g. `/lol/$accountSlug/*`) — and don't do the reverse.

`/` is for cross-stream *synthesis* — content that combines multiple streams into one verdict (chronotype hour-bucketing across LoL + commits, "what am I doing right now" picking the dominant live stream). A "top tracks this week" or "latest commit" tile on `/` is wrong-place; it belongs on its per-stream route. `/` may carry at most a single curated highlight per stream that links into the deep route.

**How to apply:** When scoping any new integration UI, default to its own route subtree. Only put something on `/` if it is explicitly cross-stream synthesis. If a working note says "Profile-page section placeholder" without naming the page, treat it as ambiguous and confirm the surface — don't assume the LoL profile page just because it has stacked `Profile*` components.

### Scroll-to-top is layered between root and section roots

`<main>` (not `window`) is the scroll container and TanStack Router's `scrollRestoration` is disabled, so every route transition would otherwise inherit the previous `scrollTop`. The reset is split by component lifetime:

- **`apps/web/src/routes/__root.tsx`** owns cross-scope reset, keyed on `topLevelScope(pathname)`. The root layout stays mounted across every navigation, so it sees `/lol/x` → `/`, `/steam` → `/status`, etc. Sectionless top-level routes (`/`, `/status`) need no wiring of their own — the root handles them.
- **Section roots** (e.g. [apps/web/src/routes/lol/$accountSlug.tsx](../apps/web/src/routes/lol/$accountSlug.tsx), [apps/web/src/routes/steam.tsx](../apps/web/src/routes/steam.tsx)) own intra-section reset via `useScrollResetOnNav(pathname, skips)` from [apps/web/src/lib/use-scroll-reset-on-nav.ts](../apps/web/src/lib/use-scroll-reset-on-nav.ts). The root doesn't reset for same-scope navigation, and the section root is the longest-lived component that can still see those transitions. The `skips` param exists for list↔detail back-restore (match-list, champion-table).

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

**Current state:** the match list and the Steam library (since 2026-05-24, [library-list-virtual.tsx](../apps/web/src/steam/library/library-list-virtual.tsx) and [library-grid-virtual.tsx](../apps/web/src/steam/library/library-grid-virtual.tsx)) are virtualized; the champion list is not.

**How to apply:** When adding a new list surface, default to a flat unvirtualized render. Re-evaluate only if perf measurement shows a problem on a realistic dataset. Promote when ANY of the following hold on a representative dataset: more than ~200 unvirtualized items rendered at once, first-paint DOM weight above ~800 nodes from the list alone, or measurable jank during scroll or route transitions. When promoting, plan it as a focused change that's tested specifically for scroll-restore + nav-transition interactions; grid-shaped lists use TanStack's `lanes` parameter (see [library-grid-virtual.tsx](../apps/web/src/steam/library/library-grid-virtual.tsx)) with lane count driven by a media-query hook that mirrors the static-grid breakpoints it replaces.

### Skeleton loaders must mirror the layout they replace

A skeleton loader's job is to reserve the shape of incoming content, not to render a generic shimmer. If a page has multiple tabs/sections with different layouts (e.g. match-detail's Recap / Your game / Timeline), the skeleton must branch on the active surface — the example pattern lives in [apps/web/src/lol/matches/match-detail-skeleton.tsx](../apps/web/src/lol/matches/match-detail-skeleton.tsx), gated by tab prop in [apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx](../apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx).

**How to apply:** When adding a new tab, sub-route, or layout variant to a section that has a skeleton loader, extend the skeleton in the same change — don't ship the new layout against the old skeleton. When restructuring an existing layout (adding a header strip, removing a column, changing grid shape), update the corresponding skeleton in the same commit. Treat the skeleton as part of the layout, not a separate concern.

### Extend the command palette when adding filterable surfaces

When adding a new filterable list, deep-link action, or "find by X" affordance, default to extending the ⌘K command palette rather than shipping a leaf-page dropdown, sticky controls bar, or one-off filter chip. The palette is the project's single "find anything" surface, with its grammar parser living in `@vyoh/shared`. Full plan and chunk list: [docs/working-notes/cross-cutting/command-palette.md](./working-notes/cross-cutting/command-palette.md).

**How to apply:** When scoping any task that touches a filterable surface or adds a "find by X" intent, include an "extend palette grammar/groups" sub-chunk in the plan and update the chunk list in `command-palette.md`. If a feature genuinely doesn't fit the palette (spatial selection, live-preview range slider, drag-to-reorder), document why in the working-note before adding parallel UI.

### Cross-package utilities belong in `packages/shared/src/`

If a helper function (formatter, type guard, domain utility) is used across more than one package, it lives in `packages/shared/src/` — not inlined per-component or duplicated per-service. Each package may still have private helpers for single-package concerns, but once a helper escapes into a second package it must be consolidated.

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

A local mirror in `apps/web` is the trap this rule exists to prevent — it type-checks perfectly while describing a response the api no longer sends. Exporting the type from `apps/api` instead is also wrong: it inverts the package boundary (`apps/*` depending on `apps/*`) and drags Nest internals into web's typecheck graph.

Note the limit of the guarantee: this is compile-time only. `class-validator` covers **request** params; nothing validates a response body at runtime, by decision (see the parked entry in [working-notes/parked.md](./working-notes/parked.md)).

**How to apply:** when adding an endpoint, define its response type in `packages/shared/src/<domain>/` first, export it from the barrel, then annotate both ends against it. When touching an existing endpoint whose handler has no return type, add one in the same change rather than leaving it. If you are about to write a `type Foo = { … }` in a web hook to describe a response, the type belongs in shared instead.

**This is unlinted** — `biome.json` sets no `useExplicitType` and `apps/api/src/conventions.spec.ts` carries no controller assertion — so it holds by review, not by tooling. A 2026-07-26 audit measured the actual posture at 58 of 61 web fetch sites and 62 of 65 JSON-returning handlers already conforming, with the 6 stragglers tracked in [open-work.md](./working-notes/open-work.md). If that ratio ever slips, add the lint rather than re-auditing.

### Centralise domain invariants that must apply to every aggregation in a feature

If a predicate or filter must hold for *every* stat computation, rollup, or display in a feature domain, define it as a named helper in `packages/shared/src/<domain>/` — never inline it at each call site. An inlined filter can be silently omitted when a new aggregation is added under time pressure; a named helper cannot.

**How to apply:** When writing a new LoL aggregation, call `excludeRemakes()` from `@vyoh/shared` before computing stats — never re-derive `!m.remake` inline. For other feature domains, check whether must-hold preconditions exist and define a named helper in `packages/shared/src/<domain>/` the same way. If the helper doesn't exist yet, create it in the same change.

**Iterate the helper, don't guard inside the loop.** `for (const m of excludeRemakes(matches))` is the shape; `for (const m of matches) { if (m.remake) continue; … }` is not. The two behave identically, which is exactly the problem: the second one hides from review and from tooling. Ten of them survived a dedicated sweep in 2026-07 because the structural lint only understood `.filter(…)` call shapes. Both forms are now linted in `apps/api/src/conventions.spec.ts`, and each lint carries fixtures asserting what it must *not* flag — the `continue` scoping is what spares `match-hero`'s single-match display guard and the backfill script.

Two failures reached production through the gap this rule closes, both in code that never spelled `remake` at a filter site: `buildOutcomeSignal` walked an unfiltered history so a remake could pad a streak, and `getChampionExtras` counted remade games into item and matchup win rates. If an aggregation reads a match list and you cannot point at the `excludeRemakes()` call, assume it is wrong.

The Steam curation overlay is the second instance of this rule, and a stricter one: `excludeHiddenGames()`, `excludeUnfeaturedGames()`, `isHiddenGame()` and `visibleAppidFilter()` in `packages/shared/src/steam/curation.ts` are the *only* legitimate readers of a `SteamCurationSets`. Unlike `.remake` — a real field that display code legitimately reads for one match — a curation Set has no second use, so `conventions.spec.ts` bans `.hidden.has(…)` / `.unfeatured.has(…)` outright anywhere else, which covers the `.filter()` and the `if (…) continue` shapes in one lint instead of two.

### A response that varies by viewer is scoped on both sides

Some api responses depend on who is asking — today that means every Steam route that names a game, because the owner sees their hidden games and nobody else does. Getting one of these right takes four pieces, and any one of them missing produces a wrong answer that looks correct:

1. **The api route declares `@WithViewer()`** and takes `@ViewerIsOwner() isOwner: boolean`. Linted: `@ViewerIsOwner()` without `@WithViewer()` on the same handler always resolves to `false`.
2. **The service takes the curation sets as a required argument** rather than injecting `SteamGameCurationService` and fetching them itself. A new read path then cannot compile until it has answered "whose view is this?", where injection would let it quietly default to the owner's.
3. **The web query key carries `viewerScope(isOwner)`** as its last segment (`"owner"` / `"public"`), so the two projections never share a cache entry and prefix invalidation still matches. It goes last for that second reason.
4. **The fetch sends `credentials: "include"`.** This is the piece that fails silently: without it the api sees an anonymous request and answers the public projection, which then sits in the owner-scoped entry looking entirely correct.

**How to apply:** SSR primes the *public* key and must keep doing so — a route loader runs on the server where the visitor's cookie is out of scope — so `isOwner` defaults to `false` everywhere it is optional, and the loaders pass nothing. Prefetches are the exception that has to ask: a hover prefetch on the public key warms an entry the destination never reads for the owner, which is a prefetch that silently stops prefetching. Spread `viewerScopedQuery` into the options so the key flip after hydration doesn't drop the surface back to its skeleton. In tests, `seedViewer(client)` puts the viewer in the cache instead of letting it reach the fetch mock — one mocked `Response` has one readable body, and the viewer query will drink it.

### Use `useChampionName()` for all champion name display

When rendering a champion's name in any UI component, call `useChampionName()` from `@/lol/champions/use-champions` and use the returned function at the render site — never render a raw alias string directly as a display label.

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

**How to apply:** Write the test file alongside the component, not in a separate "add tests" commit. Use the patterns established in `apps/web/src/components/command-palette-dialog.test.tsx` (keyboard shortcut + filter behavior), `apps/web/src/steam/library/library-controls.test.tsx` (selected state on a custom control, via `aria-pressed`), `apps/web/src/lib/use-scroll-reset-on-nav.test.ts` (hook with `renderHook`), and `apps/web/src/components/accessibility.test.tsx` (axe scan). For routing, mock `@tanstack/react-router` per the pattern in `apps/web/src/lol/matches/match-list.test.tsx`. The app carries no `role="tablist"` surface as of 2026-08-11 — the wishlist's tab pair became two routes — so a new one needs the WAI-ARIA APG pattern read fresh rather than copied from here.

### Axe-scan new interactive components

When adding a component with interactive elements (buttons, links, dialogs, tabs, custom roles), include an axe scan in the test. Add it to `apps/web/src/components/accessibility.test.tsx` or colocate it in the component's own test file.

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
