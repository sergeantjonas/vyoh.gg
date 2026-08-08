# Repo conventions

Portable workflow, environment, and architectural rules for vyoh.gg. Committed so they survive across machines. 

Code-site-specific facts live as comments at the relevant source location, not here. This file holds only what is too cross-cutting to attach to one file.

## Architecture

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

### Server-render the routes a crawler cares about; not the ones the owner cares about

Under TanStack Start, a route renders on the server with whatever its `loader` awaited into the Query cache. Everything the loader awaits is then **serialised into the HTML** so the client can hydrate against it without refetching. That second half is the part that decides the rule: a route loader is not free, and its cost scales with the payload rather than with the render.

So priming is a per-route judgement, made against three questions:

> **Is this route's content something an HTML-only crawler should read?** and **is the data behind it small relative to what it renders?** and **does the api answer it fast enough to sit in the critical path?**

All three yes → await it in the loader. Any no → leave it client-side.

- **Prime**: `/lol/patches` and `/lol/patches/$version`. Patch notes are the page's indexable content, the payload is ~30 kB, and the rendered text is roughly the whole of it. Measured 2026-07-26: 61 → 1838 characters of server-rendered text.
- **Prime**: the root route's `meQueryOptions()`. Small, and the entire LoL section resolves its account out of it, so one request lets every section route emit an identity instead of a spinner.
- **Prime**: `/lol/$accountSlug/matches` (25 kB / 6 ms), `/steam/achievements` (23 kB / 4 ms), `/steam/wishlist` (7 kB / 1 ms). Each one's list *is* its page, and each reads our own Postgres cache rather than an upstream. Measured 2026-07-27: 62 → 1506, 176 → 1302, 184 → 628 characters.
- **Do not prime**: the champion table's `useCachedMatchesWindow(account, 2000)`. The window is ~350 kB of JSON that renders down to ~150 aggregated rows, and its audience is the owner, not a crawler. Awaiting it would add the full 350 kB to every document to save one client fetch.
- **Do not prime**: `/steam/library`'s owned-games query. 664 kB — the same objection as the champion window, twice over.
- **Do not prime**: `/steam`'s `steamSummaryQueryOptions`. It is only 854 bytes, so it passes both size questions, and it is still wrong: it calls Steam live and measured **~900 ms warm across three runs**. Awaiting it would park every `/steam` document behind almost a second of upstream latency, which costs more LCP than server-rendering the page could ever return. This is the case that made the third question exist — payload size alone would have said yes.

**Why:** the migration exists for AI-search and first-pass indexing ([tanstack-start-migration.md](./working-notes/cross-cutting/tanstack-start-migration.md) § Motivation), and both read static HTML. But a document that carries a large dehydrated cache is slower to deliver and pushes LCP out, which is the ranking signal the same migration is trying to protect. "SSR everything" trades one goal for the other without anyone deciding to.

**How to apply:** when adding a route, ask the three questions above before writing a `loader`. Time the endpoint before you decide — `curl -o /dev/null -w '%{size_download}B %{time_total}s'` three times answers all three questions in one command, and the latency one is invisible from reading the code. If you prime, go through a shared `queryOptions` factory — the loader and the hook must build the same cache key, and a loader that constructs the key inline warms an entry the component never reads. That failure is quiet in exactly the wrong way: the data shows up in the dehydrated payload, so the page looks primed while the component still renders its pending branch. If you skip priming, say so at the hook with the payload size, so the next reader doesn't "fix" the omission.

#### A loader that rejects answers HTTP 500, so decide per prime whether that is the honest answer

Priming decides *whether* to await; this decides what happens when the await fails. A rejected loader is escalated to the nearest `errorComponent` — the route tier by default, via `defaultErrorComponent` in [router.tsx](../apps/web/src/router.tsx) — and on a server render the document comes back **HTTP 500**. The shell, nav and palette survive; the region renders the error card. The status code is the part that has to be chosen deliberately:

> **Swallow the prime when the primed query is one region of a page that still says something true without it. Let it reject when the primed query *is* the page.**

A 200 over an empty state teaches a crawler the page is empty and gets that indexed. A 500 asks it to come back. So for the routes the SSR migration exists to get indexed, rejecting is the *correct* behaviour, not a defect — which is why this is a per-loader decision rather than a guard to add everywhere.

Tolerate with [`primeQuietly`](../apps/web/src/lib/prime-quietly.ts), never a bare `.catch()` on `Promise.all` — `all` settles the instant either input rejects, so a slower sibling that was going to succeed never lands in the dehydrated cache it had already earned.

| Loader | Decision | Because |
|---|---|---|
| `__root.tsx` `me` | fatal | no identity, no app — and no shell left to render into |
| `/lol/$accountSlug` rank + live | tolerated | two chips on a page also carrying the champion pool, match links, season history |
| `/lol/patches/$version` list | tolerated | supplies only the release date, read through `patchList?.find` |
| `/lol/patches/$version` changeset | fatal | without it `PatchesPage` returns `PatchesEmpty` *before* the version sidebar, so the tolerated document is empty **and** unnavigable |
| `/lol/patches` list + changeset | fatal | the list picks the version; same `PatchesEmpty` shape below it |
| `/steam/wishlist`, `/steam/achievements` | fatal | the list is the route, not a region of it |
| `/lol/$accountSlug/matches` | fatal | `MatchList` gates on `isPending` with no error branch, so tolerating holds the skeleton forever |
| `/steam/portrait` | tolerated | two independent halves; either one still argues without the other |

That last row of the fatal column is the trap worth naming: **swallowing is only safe if the consuming component has an error branch.** A component that gates on `isPending` alone never leaves its skeleton when the query *errors*, so tolerating there ships an infinite loading state — strictly worse than the error card it replaced.

**How to apply:** when you add a `loader`, answer the question above for each prime and record the answer at the loader, including for the ones that stay fatal — otherwise the next reader reads an unguarded `await` as an oversight and "fixes" it. Check the consuming component for an `isError` branch before tolerating anything. The decisions are pinned in [route-loaders.test.ts](../apps/web/src/route-loaders.test.ts); add a case there rather than relying on review. Nothing about either choice fails to compile, and the two are indistinguishable until an upstream is actually down — the way to see it is a proxy that fails one endpoint while the api stays up, not a stopped api, which only ever exercises the root loader.

Two more traps worth knowing before writing a loader:

- **Cover the whole loading gate, not one query.** Dependent queries have to be chained (`/lol/patches` awaits the list, reads the newest version off it, then awaits that changeset). Priming one of two leaves the page rendering its skeleton, because a gate like `!changes && (list === undefined || changesPending)` needs both.
- **Data crossing the boundary needs `setupRouterSsrQueryIntegration`** (wired in [router.tsx](../apps/web/src/router.tsx)). Without it the server render has the data and the fresh client cache does not, so a correct server response hydrates into a pending branch and React reports a mismatch. `router.test.ts` pins that the hook is installed.

### A server/client branch during render is a hydration bug, not a safety guard

`if (typeof window === "undefined")` inside a render path reads as defensive, and under SSR it is the opposite. The server takes one branch; the client's **first** render — the one that hydrates — takes the other. React does not reconcile that difference. It throws away the entire server-rendered tree and re-renders the route on the client.

That failure mode is what makes this worth a convention: **the page still works**. Nothing is visibly broken, no test fails, and the only evidence is a console error most of the time nobody is looking at. What is silently gone is the whole benefit of server-rendering that route — the markup a crawler reads still ships, but every user pays the full client render anyway. A 2026-07-27 sweep found three of these live at once, and between them they were discarding the server tree on `/`, all of `/lol`, and all of `/steam` — every route the migration had just been built for.

The rule is about *when* a value is read, not whether it is browser-only:

| Reading | Wrong | Right |
|---|---|---|
| A media query | `useState(() => matchMedia(q).matches)` | `useSyncExternalStore(subscribe, getSnapshot, () => false)` — [use-media-query.ts](../apps/web/src/lib/use-media-query.ts) |
| localStorage / a persisted pref | lazy `useState` initialiser | seed the default, adopt the stored value in an effect — [serious-queues.tsx](../apps/web/src/lol/_shared/serious-queues/serious-queues.tsx) |
| A portal, or anything needing the DOM | `typeof document === "undefined"` | `useHydrated()` — [use-hydrated.ts](../apps/web/src/lib/use-hydrated.ts) |
| A virtualizer's scroll element | let it measure `null` and emit nothing | state `initialRect` — `SSR_VIEWPORT_HEIGHT` in [scroll-container.ts](../apps/web/src/lib/scroll-container.ts) |

`useSyncExternalStore` is the preferred shape wherever it fits, because it is the only one that knows whether React is hydrating: `getServerSnapshot` answers the server render *and* the hydrating render, while `getSnapshot` answers every later render — including the first render of a component mounted by a client-side navigation, which therefore still reads the true value synchronously and never flashes. `useHydrated()` costs that component one extra commit, so prefer it for things that genuinely cannot exist server-side rather than for values that merely differ. One trap inside it: `getServerSnapshot` must return a **stable reference**, since React compares snapshots with `Object.is`. Returning a fresh object literal per call earns "The result of getServerSnapshot should be cached to avoid an infinite loop" — see `SERVER_PREFS` in [use-audio.ts](../apps/web/src/lib/use-audio.ts). Primitives are fine as-is.

**How to apply:** grep for `typeof window`/`typeof document` before adding one, and ask whether the enclosing function runs during render. In an event handler or an effect it is fine — those never run on the server. In a render body, a lazy `useState` initialiser, or a `useMemo`, it is this bug.

Two things do **not** catch it, which is why it lasted: a passing test suite (happy-dom has a `window`, so both "sides" agree there) and a smoke test in a fresh browser (the localStorage-backed ones only diverge once a preference has actually been stored). The check that does catch it is a real browser against a real server render, watching the console — [ssr-hydration.test.tsx](../apps/web/src/lib/ssr-hydration.test.tsx) pins the contract per-hook by asserting what `renderToString` emits while `matchMedia` and `localStorage` say otherwise.

#### A query the root warms is data a code-split route does not have on the server

There is a second way into the same failure, and no `typeof window` appears anywhere in it. Every route component is code-split; the root layout is not. So on a cold load the order is: root hydrates and its hooks start fetching → route chunk arrives → route subtree hydrates. **Anything the root started has had a full network round-trip to resolve by the time the route's hydrating render runs**, while the server render of that same route never had it.

The live one was [presence-mounts.tsx](../apps/web/src/lib/presence-mounts.tsx), which polls live-game and Steam-player-state from the root so the favicon dot works on every route. Two code-split surfaces read those same query keys: the profile hero's live halo, and `/`'s now-playing strip. Both rendered on the hydrating client render and on no server render, so React discarded the tree for the LoL landing page and for `/`. It reproduces **only while the owner is actually playing something**, which is why it survived a full 12-route sweep in chunk 4b and was found in chunk 5 by accident.

Two fixes, and which one applies is decided by the data, not by preference:

- **Prime it in the route's loader** when the value is deterministic and cheap — the profile route awaits rank (173 B / 1.5 ms) and live (3.9 kB / 0.8 ms), both answered from our own Postgres or the poller's memory. This is strictly better than gating, because the server render also stops lying: `/lol/$accountSlug` used to server-render "Unranked / Unranked" and now renders "Emerald I 92 LP · In Game".
- **Gate it on `useHydrated()`** when priming cannot make the two sides agree. `/`'s now-playing strip is the example: it advances the clock with `Date.now()`, so the string differs by the time hydration runs whatever you prime, and its Steam branch reads the 664 kB owned-games query the priming rule keeps client-side. Live-presence chrome is not content a crawler wants, so client-only costs nothing.

**How to apply:** when adding a `useQuery` to a route component, check whether anything mounted from `__root.tsx` reads the same key. If it does, either prime it in that route's loader or gate the branch on `useHydrated()`. The same question applies in reverse: before adding a poll to the root layout, check which route components read it.

**Anything derived from the current clock has this shape too**, even with the data primed — `formatTimeAgo(...)` and `Date.now()` produce a string on the server and a possibly-different one a few hundred milliseconds later at hydration. That one is intermittent rather than reproducible, so it will not show up in a sweep; treat a relative timestamp in server-rendered markup as a hydration hazard on sight.

### Exactly one `<link rel="canonical">`, emitted from the shell

The canonical URL and `og:url` are rendered by `<CanonicalUrl />` in [__root.tsx](../apps/web/src/routes/__root.tsx)'s `shellComponent`, from `useRouterState`'s pathname via `canonicalUrl()` in [site-url.ts](../apps/web/src/lib/site-url.ts). **Do not add `rel: "canonical"` to any route's `head()`.**

**Why:** router merges `meta` by name/property with the leaf winning, but it merges `links` by *exact JSON equality* (`appendUniqueUserTags` in `@tanstack/router-core`). A root canonical plus a leaf canonical is therefore two conflicting tags rather than one override, and a page carrying conflicting canonicals has all of them ignored. Nesting makes that unavoidable at route level — `/lol/x/matches/y/timeline` has three ancestors with a `head()`, and each would claim its own URL. The shell is the one place where "one tag, full pathname" is structural instead of a rule every future route has to remember.

Until 2026-07-27 the root emitted a hardcoded `https://vyoh.gg/`, so **every page in the app told crawlers it was a duplicate of the homepage** — including the patch-notes routes the SSR migration exists to get indexed. Nothing catches that except reading the served HTML.

**How to apply:** a new route needs no canonical wiring at all. If a route ever needs a canonical that differs from its own pathname (a filtered view pointing at the unfiltered one, say), extend `canonicalUrl()` rather than adding a second tag — search is already dropped there for exactly this reason, since every search param in this app is view state.

### The production image is a different environment, and three things diverge there

`pnpm build` on the dev box and `docker build` produce different artefacts from the same commit. Not occasionally — the first containerised build of this repo (2026-07-27) hit three separate defects at once, and every one of them was invisible to a passing test suite, a local build, and a code review. The differences are structural, so they will recur:

| The container lacks | What breaks | The fix |
|---|---|---|
| `.git` | Tailwind's automatic source detection skips what `.gitignore` excludes. With no repo it scans `dist/`, which the client pass has already written by the time the server pass runs — so the two passes emit different CSS and the server render links a hash only it computed. **The site 404s its own stylesheet.** | `@source not "../dist"` in [index.css](../apps/web/src/index.css). State the scope; don't inherit it from a directory that may not be there. |
| A shell that leaves unset vars unset | A Docker `ARG` the build was not given arrives as `""`, not as `undefined`. `value ?? fallback` passes it straight through, so `VITE_SITE_URL=` makes every canonical, `og:url` and sitemap entry **relative**. | [`envOrigin()`](../apps/web/src/lib/env-origin.ts) for anything read out of a build-time env var. Never `??` on one. |
| A timezone | Containers are UTC. Every `Intl.DateTimeFormat` without an explicit `timeZone` resolves to the process zone, so the server renders a date one day off from the browser and React discards the tree. | `TZ` on the container ([compose.prod.yaml](../compose.prod.yaml)) as the floor; pinning `timeZone` per formatter is what actually fixes it for a visitor outside that zone. Pass `OWNER_TIME_ZONE` from `@vyoh/shared` for anything describing the owner's activity, `"UTC"` for an upstream date-only value. Enforced by the `no unpinned date formatter in web` lint in [conventions.spec.ts](../apps/api/src/conventions.spec.ts). |

**Why this is a convention and not a changelog entry:** each of these is silent. The stylesheet one does not fail the build, it fails the page. The empty-`ARG` one produces valid HTML that a crawler reads as "this page is not canonical". The timezone one only fires when a timestamp lands near midnight, so it reproduces on one route and looks like a fluke.

The **locale** argument has the identical shape and is easier to miss, because passing `undefined` reads as "use the user's preference" rather than as an unset value. It resolves to the host's locale, so an `en-US` server renders "Aug 7" where an `en-GB` browser renders "7 Aug" — a mismatch on every date, not just the ones near midnight. Name the locale explicitly at every formatter; the lint above covers the zone, not this.

**How to apply:** when a change touches the build (a new env var, a plugin with content detection, a formatter reading ambient state), ask what it reads that a container will not have. And before claiming a deploy works, probe **the container**, not a local server or a scratchpad harness — the four SSR chunks each verified against something more convenient than production, and each one shipped a defect that the next chunk's less convenient probe caught. Two traps in the probe itself:

- **A clean console proves nothing without a positive check that the client bundle ran.** Chunk 4b reported "14 routes clean" against a harness that served no `dist/client`, so no JS had evaluated and there was nothing left to throw an error. Assert something only hydration produces — the container probe presses ⌘K and requires the palette to open.
- **Count failed requests too.** The 404ing stylesheet raised no hydration error and no page error. It was visible only as a `response` with status ≥ 400.

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

### Clickable elements must carry `cursor-pointer`

Any element that is interactive but not a native `<a>` tag must include `cursor-pointer` in its Tailwind class list. Tailwind's preflight resets `<button>` (and other non-anchor elements) to `cursor: default`, so the pointer is never implicit.

**Why:** Without an explicit class, hovering a button-styled chip or icon button shows the text cursor, which breaks the affordance that the element is clickable.

**How to apply:** When adding a `<button>`, `role="button"` div, or any other click target that is not a native link, include `cursor-pointer` in the className. Applies equally to icon-only buttons, shortcut chips, and toggle controls.

### Use `TooltipPrimitive` for all tooltip surfaces; never use `title=`

When an element needs a tooltip, use `import * as TooltipPrimitive from "@radix-ui/react-tooltip"` — never the native HTML `title=` attribute. A `TooltipPrimitive.Provider` with `delayDuration={150}` is already mounted in [`__root.tsx`](../apps/web/src/routes/__root.tsx); do not add another.

The `Content` className comes from [apps/web/src/lib/tooltip.ts](../apps/web/src/lib/tooltip.ts), which exports two recipes composed from shared `SHELL` (chrome + bg + shadow + blur) and `ANIMATION` (`data-[state=delayed-open|closed]:*`) primitives:

- **`TOOLTIP_CONTENT_COMPACT`** — label-only chips (`px-2 py-1 text-xs`). Use for icon-button tooltips, single-line labels, small chips.
- **`TOOLTIP_CONTENT_RICH`** — hover-card style (`w-max max-w-48 p-3`). Use for tooltips that carry a heading, body, or icon — sparkline popovers, ability descriptions, keystone hover cards.

Standard compact structure (label-only tooltip, e.g. icon buttons):

```tsx
import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";

<TooltipPrimitive.Root>
  <TooltipPrimitive.Trigger asChild>
    {/* the trigger element */}
  </TooltipPrimitive.Trigger>
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content side="bottom" sideOffset={6} className={TOOLTIP_CONTENT_COMPACT}>
      Tooltip label
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
</TooltipPrimitive.Root>
```

For bespoke widths, padding, or background opacity, compose via `cn()`:

```tsx
className={cn(TOOLTIP_CONTENT_COMPACT, "max-w-xs")}
className={cn(TOOLTIP_CONTENT_RICH, "max-w-72")}
className={cn(TOOLTIP_CONTENT_COMPACT, "bg-popover/90 shadow-md")}  // chip over busy background
```

Do **not** re-declare the className inline or as a local `const TOOLTIP_CONTENT_CLASS = "…"` — both shapes drift over time (a 2026-06-11 sweep found 21 local copies plus ~21 inline strings, with subtle variations in `bg-popover/85` vs `/90`, missing animation classes, etc.). If the existing exports don't fit, add a third recipe to `lib/tooltip.ts` rather than inlining.

**Why:** The native `title=` attribute has no styling control, ignores design tokens, cannot be positioned reliably, and doesn't fire on touch. Inline className strings drift — the missing animation classes on ~10 of the pre-consolidation inline sites would have stayed broken indefinitely.

**How to apply:** Any new element that needs a label or explanation uses `TooltipPrimitive` with one of the two exported recipes. Add `aria-label` on the trigger when there is no visible text label (icon-only buttons). Reference: [nav.tsx](../apps/web/src/components/nav.tsx) for the compact form, [match-pips.tsx](../apps/web/src/lol/_shared/ui/match-pips.tsx) for the rich form.

### Styling a new surface: where the visual guidance lives

The tile/chrome/header rules in this file are auto-loaded, but the motion and editorial layer lives in code and working notes that nothing else points to. Before styling any new screen, panel, or band, route by intent:

| Intent | Where |
|---|---|
| Bento vs editorial treatment | [Next section](#bento-vs-editorial-pick-the-surface-treatment-before-picking-components) — decide this first; it picks which conventions apply downstream. |
| Entrance animations (mount stagger, scroll-entry, text reveals) | `sectionContainerVariants` / `sectionChildVariants` (role-keyed: eyebrow, headline, meta, body, tile) in [section-variants.ts](../apps/web/src/components/ui/section-variants.ts); CSS `.view-entry` and `.stagger-children` / `data-mount-stagger` in [motion.css](../apps/web/src/styles/motion.css); per-line hero reveals via [editorial-heading.tsx](../apps/web/src/components/ui/editorial-heading.tsx); animated numerals via [count-up.tsx](../apps/web/src/components/count-up.tsx). Don't hand-roll a new Motion `variants` object for a standard section entrance — reuse these. |
| Editorial composition + cascade timing | [subject-chapter-design-spec.md](./working-notes/cross-cutting/subject-chapter-design-spec.md) — read for **any editorial/hero surface**, not only recap chapters: cascade delay table, blur-as-hero-marker, shadow tiers, list-row patterns, rejected experiments. |
| Big numerals / labels | `HeroNumber` / `HeroLabel` / `HeroPair` in [hero-number.tsx](../apps/web/src/components/ui/hero-number.tsx). |
| Route/view transitions | `getNavigationType` in [navigation-type.ts](../apps/web/src/lib/navigation-type.ts) is the single classifier (including the WebKit/Firefox engine gates); keyframes in [view-transitions.css](../apps/web/src/styles/view-transitions.css). When adding a top-level route or section, decide its transition type in the classifier — don't add per-route VT wiring elsewhere. |
| Theme/accent color | [accent-color-system.md](./working-notes/cross-cutting/accent-color-system.md) (OKLCH token cascade); `useThemeColor()` in [use-theme-color.ts](../apps/web/src/lib/use-theme-color.ts) for route chrome color; `useAtmosphereClaim({ accentHex })` for per-subject `--accent`. |
| Charts (Recharts) | Color slots from [chart-palette.ts](../apps/web/src/lib/chart-palette.ts) — pick by role (`CHART_GRID`/`CHART_AXIS`/`CHART_CURSOR` chrome, `CHART_SERIES` primary line, `CHART_TREND` fitted/secondary, `CHART_POSITIVE`/`CHART_NEGATIVE` semantic win-loss pair); never hardcode a series hex at a call site. Hover tooltips via `ChartTooltipShell` in [chart-tooltip.tsx](../apps/web/src/components/chart-tooltip.tsx) (null children while inactive; the shell owns AnimatePresence). Reference structure: [trend-kda.tsx](../apps/web/src/lol/trends/trend-kda.tsx). |
| Tiles, chrome, headers, tooltips, skeletons | The sections in this file. |

**Why:** A 2026-06-12 documentation audit found the entrance-animation and editorial primitives well-built and well-commented in code, but unreachable from the auto-loaded docs — a fresh session styling a new screen would have re-invented Motion variants, chart palettes, and header treatments that already exist.

**How to apply:** Scan this table for the matching intent and open the referenced file or note before writing styling code. If you're about to write a new Motion `variants` object, entrance keyframe, or chart palette, first check whether the referenced primitive can carry it — and if it genuinely can't, extend the primitive rather than forking at the call site.

### Bento vs editorial: pick the surface treatment before picking components

The app has two fully-specified visual poles — chromed tile compositions (this file's tile/chrome/header rules) and editorial typographic chapters ([subject-chapter-design-spec.md](./working-notes/cross-cutting/subject-chapter-design-spec.md)) — and which one a new surface gets is a decision, not a default. The question is mechanical:

> **"Will the user scan this surface to compare repeated units, or read it once as a statement?"** Scan/compare → bento. Read-once statement → editorial.

- **Bento (dashboard) treatment** — repeated units of the same shape (stat tiles, list rows, fact cards) in grid/stack composition. Chromed tiles per the [tile background rule](#tile-background-one-level-of-glass-between-background-and-content), headers via `SectionTitle`/`CardTitle`, entrance via the `section-variants` stagger. Reference surfaces: LoL profile, Trends tab, Steam game-detail.
- **Editorial treatment** — a single subject carrying a verdict: bare wrappers ("magazine spread, not a dashboard"), typographic hierarchy (eyebrow → masthead → verdict via `EditorialHeading` / `HeroPair`), cascade entrance with blur reserved for the hero tier. Reference surfaces: the recap chapters in [apps/web/src/home/recap/](../apps/web/src/home/recap/); full vocabulary in the design spec.

The decision applies **per band, not per route** — a page may open with an editorial hero band and continue bento below it.

**Why:** Both poles were fully specified, but nothing said which one a new surface gets. Defaulting everything to tiles makes the app read as a mixed-bag dashboard and dilutes the editorial identity the portfolio framing depends on; defaulting to editorial spends hero weight on surfaces that should be scannable.

**How to apply:** Ask the scan-vs-statement question per band before picking components. Bento → chrome composition rule + tile recipe + `SectionTitle`/`CardTitle`. Editorial → bare wrapper + the design spec's composition and cascade rules + the typography primitives. If a band seems to want both ("an important data grid"), it's bento — importance is carried by position and a `SectionTitle`, not by editorial treatment.

### Header primitives: `SectionTitle` vs `CardTitle` — pick by chrome, not by content

Two header primitives live in [apps/web/src/components/ui/](../apps/web/src/components/ui/). They share the same uppercase-tracked editorial aesthetic but carry different visual weight so the page hierarchy reads. **The rule is structural, not semantic — it's about whether the header sits inside card chrome.**

- **`SectionTitle`** (`text-sm font-semibold uppercase tracking-[0.2em] text-foreground`, defaults to `<h3>`, `as` prop for `h2`/`h4`) — for **page-zone dividers** that sit on the page background. No card chrome around the header. The header itself does the visual lifting because there's no border/bg to contain the region. Examples: LoL profile's `Pre-game` / `Post-game` / `Recent form` (group multiple tiles), every LoL match-detail section header (`Build order`, `Spell casts`, `Damage profile`), Steam `Trophy case` / `100%'d` / `Rarest unlocks`.
- **`CardTitle`** (`text-sm font-medium uppercase tracking-[0.2em] text-foreground/70`, same `as` prop) — for **headers inside card chrome** (a `rounded-lg border bg-card/…` wrapper). The chrome contains the region; the header can be quieter because the border is already doing the dividing work. Examples: Steam `About this game`, `Unlock Timeline`, `Achievements` (each lives inside `<section className="rounded-lg border bg-card/50 p-4">`).

The test is mechanical: **look at the immediate wrapper of the header**. If it has `rounded-lg border bg-card/…` (or equivalent card chrome), use `CardTitle`. If it's a plain `<section>` / `<div>` with just flex/spacing classes, use `SectionTitle`. Don't pick by what the content "feels like" — pick by whether there's a visible card boundary around the header.

This aligns with the industry-standard slot pattern documented in `~/.claude/knowledge/frontend-2026/02-design-systems.md` §6 (Primer, Carbon, shadcn/ui — `CardTitle` is its own named primitive distinct from page-section headers) and the token-tier principle in §1 (semantic role gets its own token slot; reusing one primitive for two roles is an anti-pattern).

**Why:** The earlier `SectionTitle`-only approach used one primitive for both slots, which made page-zone dividers and card-internal headers render identically. The result was structural inconsistency between sections that used the bare-header pattern (LoL profile, LoL match-detail) and sections that used the card-with-internal-header pattern (Steam game-detail) — both rendered the same weight even though they have different visual containment around them. The bifurcation lets the page-zone divider command its region while the in-chrome card title fits naturally into the chrome.

**How to apply:** When introducing a new section header, the choice is determined by the wrapper element you're putting around the header *in the same JSX*. Don't pick `SectionTitle` because the content feels important, or `CardTitle` because the content feels minor. If you find yourself wanting `SectionTitle` inside card chrome (or vice versa), that's a signal the layout itself wants reworking — either remove the surrounding chrome (and use SectionTitle), or commit to the chrome-as-container pattern (and use CardTitle). When in doubt, mirror the closest existing surface of the same shape — most LoL surfaces are `SectionTitle`; most Steam in-card cards are `CardTitle`.

**When auditing for missed migrations** (i.e., scanning for ad-hoc headers that should be a primitive), three pitfalls cost this convention three sweep rounds during its initial landing:

1. **Don't grep only for `<h2>` / `<h3>` tags.** Headers also show up as `<span className="text-sm font-medium">…</span>` or `<p className="text-sm font-medium">…</p>` — semantically wrong but visually identical. Search for the visual pattern (uppercase, font-weight, tracking) AND the heading tags.
2. **Don't grep only for the LoL idiom (`text-muted-foreground` suffix).** A header that uses plain `text-sm font-medium` without an explicit color class will be missed by `text-sm font-medium text-muted-foreground` regex. Audit for the *role* (introduces a substantial body) not the specific text-class signature.
3. **Check shared layout primitives once and let them propagate.** `card-shell.tsx`'s internal `<h3>` was missed in the first two sweep rounds because it wasn't a direct call site — ~45 chip surfaces inherited the unmigrated treatment through it. When a single change point covers many consumers (`CardShell`, `ConclusionCard`, `FactCard`, future card primitives), migrate the primitive itself, not every callsite.

If you're about to write a new ad-hoc `<span>` / `<p>` header with uppercase + font-weight classes, you almost certainly want `SectionTitle` or `CardTitle` instead.

### Page composition: chrome belongs at the lowest level that visually groups heterogeneous content

When choosing the container shape for a new section (chrome `rounded-lg border bg-card/…` wrapper vs bare `<section>` / `<div>` with only flex/spacing classes), the rule is **compositional**, not content-based:

> Chrome belongs at the lowest level that visually groups heterogeneous content. **Don't nest chrome inside chrome.**

Three sub-rules:

1. **If a section's children each carry their own chrome, the outer wrapper stays bare.** Wrapping creates nested borders — visually noisy, and the chrome stops "containing" anything because each child is already contained.
2. **If a section's children are bare inline content** (text, chips, a single chart body, a strip of metadata), **the wrapper carries chrome.** The chrome is doing the visual lifting that no individual child does.
3. **A `<section>` whose role is purely to group sibling sections under a shared `SectionTitle` divider stays bare regardless of child content.** It's an IA scope marker, not a visual band.

The two reference surfaces in the app:

- **Bare wrapper, chromed children** — [apps/web/src/routes/steam/library/$appid.tsx](../apps/web/src/routes/steam/library/$appid.tsx). The Editorial band (`GameScreenshotStrip` + `GameAboutBlock`) and Progress band (`GameUnlockTimeline` + verdict-grid + `AchievementPanel`) each use `<section className="flex flex-col gap-4">` because every child component carries its own `rounded-lg border` wrapper on the frosted recipe (`bg-card/60 backdrop-blur-sm` — `frosted` defaults true and the call sites pass it explicitly). The Identity band one row above *does* carry chrome — because its children (price strip, platform pills, review chip, ESRB chip, short description) are bare inline content.
- **Bare wrapper, bare children, dividers do the work** — [apps/web/src/lol/matches/match-detail-view.tsx](../apps/web/src/lol/matches/match-detail-view.tsx) (`MatchYourGameTab`). Six chart sections (`MatchBuildOrder`, `MatchSpellCasts`, `MatchDamageProfile`, `MatchOwnerStats`, `MatchSkillOrder`, `MatchLanePhase`) sit in a flat `flex flex-col gap-6` stack with no chrome anywhere. Each child uses `<section className="flex flex-col gap-3">` with a `SectionTitle` header. Works because the children are individual chart bodies of similar visual weight, sitting under a scrollspy nav that already implies the section structure.

**Why:** The earlier draft of this rule was content-shape-based ("chart/timeline/grid → chrome, text/sentence → bare"), but that produced false-positive "incomplete migration" readings on layouts like Steam game-detail where chrome lives at the child level by design. The compositional rule subsumes the content-shape heuristic and makes both reference patterns obviously correct — the question collapses from "is this content important enough to chrome?" to the mechanical "is there already chrome below this point?".

**How to apply:** When adding a new section, look one level down before deciding. If the immediate children mostly carry `rounded-lg border bg-card/…` already, use a bare wrapper. If they're bare content blocks, use a chrome wrapper. If you find yourself wanting to wrap chrome around already-chromed children to "tie them together visually," the IA wants the *children* to share a single `SectionTitle` divider above the bare wrapper, not nested chrome. The compositional rule pairs with the [header primitive rule](#header-primitives-sectiontitle-vs-cardtitle--pick-by-chrome-not-by-content) above: chrome decision picks the wrapper, header primitive picks the title treatment, and they decide each other (chromed wrapper → `CardTitle`, bare wrapper → `SectionTitle`).

### Tile background: one level of glass between background and content

The core rule, before any table: **one level of glass between the underlying backdrop and the content it carries**. A tile is frosted when it sits *directly* over an unstructured backdrop (a champion splash, the Steam profile backdrop, a Steam screenshot, the atmosphere layer). A tile nested *inside* another frosted (or image-backed) container stays solid. Glass is a boundary layer — you cross it once.

The **2026-06-10 policy refinement** (this convention's evolution): every interactive route in vyoh sits over a backdrop. LoL routes (`/lol/$accountSlug/*`) inherit a champion splash claim from `SplashProvider`. Steam routes (`/steam/*`) inherit the Steam profile backdrop with the game-detail layer on top. The recap pages inherit splash + atmosphere. **Page-grounded "no backdrop" surfaces are the exception, not the default** — they're effectively limited to `/status` and similar utility routes. So the tile recipe default has flipped: when in doubt on a splash-backed page, frost it.

The mechanical question that lands you on the right recipe (unchanged in shape, defaults flipped):

> **"What's directly behind this tile?"** Splash / screenshot / Steam backdrop / atmosphere → frosted. Another tile or chromed wrapper → bare. No backdrop at all (utility routes) → bare default.

That collapses to two observed tiers:

| Tier | Recipe | When |
|---|---|---|
| **Frosted** (default for splash-backed routes) | `bg-card/60 backdrop-blur-sm` + `border rounded-md/lg` | Tile faces an unstructured backdrop directly (panel internals over splash chrome, LoL profile / Trends / champion-list cards over splash, Steam profile chips over Steam backdrop, achievement-page cards, LoL recap chapter outers). |
| **Transparent** | `bg-card/50` + `border rounded-md/lg` | Tile nested *inside* a frosted or image-backed container (inner stat tiles under a frosted chapter wrapper, inner tile rows inside a chart card). |

Plus one **chrome** tier outside this system: `bg-card/80 backdrop-blur-md` for fixed-position UI overlapping scrolling content (`champion-sticky-strip`, `scroll-to-top` button). Heavier blur is load-bearing for legibility over moving content.

**Radius exception:** recap chapter outers use `rounded-xl` (vs the tile-default `rounded-md/lg`) — deliberate, the larger radius marks the editorial band scale. The recipe lives in [chapter-shell.tsx](../apps/web/src/lol/recap/chapter-shell.tsx) (`ChapterShell` + exported class consts). Don't normalize it back to `rounded-lg` in a consistency sweep, and don't spread `rounded-xl` to ordinary tiles.

**Retired tier (do not reintroduce):** An "atmosphere overlay" tier (`bg-card/40 + backdrop-blur-md`) briefly existed for the recap chapters. It was the only tile-shaped consumer of `backdrop-blur-md` in the entire app, every other tile uses `backdrop-blur-sm`. A consistency pass on 2026-06-10 retired it: the recap chapters now use the standard frosted recipe, which reads visually the same and removed ~50 ms of cold-load raster cost on `/`. If a future surface wants "stronger glass than frosted," the right move is to revisit the frosted recipe globally (e.g. `bg-card/50 + backdrop-blur-sm` is a possible knob), not to fork into a second blur intensity.

Reference surfaces in-tree (post-2026-06-10 consistency pass):

- **Frosted** — Almost every interactive surface in `/lol/$accountSlug/*` and `/steam/*`, plus the LoL recap chapter outers. Notable: LoL match-detail / champion-detail / Steam game-detail panel internals; LoL profile chips (`profile-stats-bar`, `profile-multikill-strip`, `profile-role-strip`, `profile-now-playing`, `profile-duos`, `profile-season-history`, `RitualTile` pre/post-game tiles, `ProfilePatchNotice`); LoL Trends tab cards (all 17 trend components default to frosted); LoL champion-detail panel internals; LoL recap chapter outers (`recap-rank-arc`, `recap-champion` empty state, `recap-most-improved`, `recap-signature-game`, `recap-patch-verdict`, `recap-duo-of-year`, `recap-top-insight`); Steam profile chips (Trophy Case, Recent Unlocks, Wishlist, Library, Most Played, Platforms — all `FactCard`); Steam achievement-page cards (`steam-chronotype-tile`, `rarest-section`, `recent-unlocks-virtual`). The `RecapChampion` *populated* outer stays transparent (no `bg-card`) when it has its own baked splash overlay; in that case the inner Stat tiles wear the frosted recipe instead.
- **Transparent** — Inner Stat tiles inside frosted outer wrappers (e.g. the 2-column Net LP / Tracked Seasons grid inside `RecapRankArc`, the inner PatchTiles in `RecapPatchVerdict`), inner tile rows inside chart cards.

**Component default**: `CardShell.frosted` defaults to **`true`** ([apps/web/src/components/card-shell.tsx](../apps/web/src/components/card-shell.tsx)) — every consumer (`ConclusionCard`, `FactCard`) inherits the frosted recipe. The wrapper components that propagate `frosted` (`TrendDeathMatchupHeatmap`, `TrendTimeHeatmap`, `TrendTiltIndicator`, `ChampionBuildPath`, `ChampionPositionHeatmap`, every Steam `*Card` in `apps/web/src/steam/game/`) also default to `frosted = true`. Pass `frosted={false}` only at call sites that genuinely have no backdrop behind them. Inside a frosted card, child tiles stay bare even if the design feels like "tile-within-tile" — that's the one-level-of-glass rule working as intended.

**Vignette diagnosis (2026-06-10):** `CardShell` adds a `view-entry` CSS class that runs a scroll-driven `animation-timeline: view(block)` opacity entrance. In page-grounded contexts it's a nice polish — each card fades in as it scrolls into view. But it ALSO suppresses opacity as the card nears the bottom of the viewport, reading as a vignette / progressive transparency on the page-end cards. The class is gated by `!frosted`, so flipping the default to `frosted=true` removes the vignette across every consumer at once. If a future surface needs the scroll-driven entrance without the bottom-fade, the right fix is to adjust `animation-range` in [motion.css](../apps/web/src/styles/motion.css) (currently `entry 0% cover 30%`), not to re-introduce the view-entry on splash-backed cards.

**Why this beats "frost everywhere":**

- Apple HIG / NN/g converge: glass works through *contrast* with solid surroundings. If every element is glass, nothing reads as glass.
- `backdrop-filter` is expensive — offscreen capture + Gaussian blur on every paint. 6–8 frosted cards is fine on modern hardware; spreading across the whole app pushes WebKit toward chop and bloats composite memory.
- Every `backdrop-filter` creates a stacking context. Stacking contexts can be silently suppressed by any ancestor with `opacity`/`filter`/`mix-blend-mode`. ([[ancestor-opacity-suppresses-backdrop-filter]] for the 2026-06-08 sweep that flushed 5+ instances of this.) Fewer frosted elements = smaller bug surface.

**How to apply when adding new tiles:**

1. Look at the immediate parent's backdrop. Image/splash/atmosphere directly behind → **frosted**. Already inside chromed container or page-grounded → **bare**.
2. If you're inside a panel (Dialog overlay), default to frosted unless the tile is nested inside another frosted card.
3. If the component renders in *both* in-panel and page-grounded contexts (any reusable trend / fact card), accept a `frosted?: boolean` prop and pass through to `CardShell`. Set at the call site.
4. Retired opacity rungs (`bg-card/20`, `/30`, `/60` without blur, `/70`) — don't introduce new uses. Demote existing to `/50` or promote to frosted during your change.
5. Solid `bg-card` (no opacity) stays for shell surfaces — primitives, skeleton placeholders, page chrome — where transparency is undesired and the surface should read as a fully-painted block.
6. Tooltip / popover / dialog recipes (`bg-popover/85-95 + backdrop-blur-md`) are a separate system, portaled outside the tile hierarchy. Don't conflate.
7. Honour `prefers-reduced-transparency: reduce` — the project-wide `@media` rule in [apps/web/src/index.css](../apps/web/src/index.css) drops `backdrop-filter` and promotes `bg-card/40-/60` to solid `bg-card` so glass effects don't ship to users who've opted out.
8. Pairs with the [chrome composition rule](#page-composition-chrome-belongs-at-the-lowest-level-that-visually-groups-heterogeneous-content) above: chrome decision picks the wrapper, this rule picks the *tile recipe* for whatever sits inside.

### Gate engine-specific perf cliffs instead of chasing CSS parity

When a feature performs well in Blink/Gecko but produces visible chop on WebKit (Safari/iOS), and you've exhausted reasonable in-CSS optimisations without closing the gap, **gate the feature on `isWebKit()` ([apps/web/src/lib/is-webkit.ts](../apps/web/src/lib/is-webkit.ts)) and ship a compositor-only substitute** for the engine that doesn't handle it well. Don't continue tuning CSS toward parity when the cost lives inside an engine code path no CSS property reaches (snapshot capture, filter pipeline, layer-tree management).

**Currently in scope:** intra-Steam router VT is bypassed on WebKit in [navigation-type.ts](../apps/web/src/lib/navigation-type.ts), substituted by the `safari-slide-in-from-*` keyframes + [`useSafariSlideDirection`](../apps/web/src/steam/use-safari-slide-direction.ts) hook applied in [routes/steam.tsx](../apps/web/src/routes/steam.tsx). Documented end-to-end in [safari-vt-snapshot-cost.md](working-notes/cross-cutting/safari-vt-snapshot-cost.md).

**Why:** WebKit's compositor and filter pipeline run more work on the main thread than Blink/Gecko's. For Steam-shaped DOM (high stacking-context density, multiple `backdrop-blur` chips, virtualised rows with absolute positioning), Safari's `startViewTransition` snapshot capture costs hundreds of ms — contending with React commits and producing chop. A two-session debugging arc ruled out backdrop, filters, perspective transforms, blur layers, and virtualiser teardown one-by-one before landing on snapshot capture as the irreducible cost. CSS-level tuning helped marginally but couldn't cross the gap because the cost path was unreachable from app code.

**How to apply:**
- Before reaching for `isWebKit()`, exhaust standard perf moves: reduce composite layer count, drop `filter:` properties, defer mount, virtualise lists, simplify component chrome. Many issues *do* yield to CSS-level fixes; gate only when they don't.
- Validate with Safari Web Inspector → Timelines → Frames before and after each change. If Composite or "Other" stays high after the standard moves and the user-felt cost persists, the cost likely lives in an engine path you can't reach — gate.
- The gate goes in `getNavigationType` (route-level) or at the component opt-in (feature-level), not as a global engine downgrade. Other surfaces on the same engine may handle the feature fine; LoL VT works on Safari while Steam VT doesn't.
- When you gate, ship a substitute that runs purely on the compositor: `transform`-only CSS animations, no `opacity`, no `filter:`, no `backdrop-filter`. The substitute should preserve the visual intent (motion, continuity) without paying the engine cost.
- Detection is by `navigator.vendor === "Apple Computer, Inc."` (cached at module load). This catches iOS Chrome / Firefox too, which both wrap WKWebView and share the same cost.

**Generalisation guidance:** the current `useSafariSlideDirection` hook hard-codes the Steam tab order. When a second section needs the same pattern, generalise — pass tab order as a parameter, lift the hook into `_shared`. Don't pre-emptively abstract before a second consumer exists ([per the "three similar lines is better than a premature abstraction" rule](#)).

### Layer-count + paint budget per route scenario

The compositor + paint baseline measured by [`tools/perf-probe`](../tools/perf-probe/) (chromium, 1440×900, dev server) defines a budget that any new surface added to the app must respect. The seven currently baselined scenarios are `lol-overview`, `lol-champion-panel`, `steam-library`, `steam-portrait`, `recap`, `lol-patches` and `wishlist-upcoming`. Full numbers and the diagnostic trail live in [progressive-paint-audit.md](working-notes/cross-cutting/progressive-paint-audit.md).

**Cold-load budget per route (01-load phase):**

Budgets are per-route because the routes diverge in how much frosted/blur-cost they carry. The `RasterTask` floor on a frosted-heavy route (recap with 7 chapter wrappers carrying `bg-card/40 + backdrop-blur-md`) sits structurally above an un-frosted route's floor, even at the same compositor-layer count. The 2026-06-10 frosted-tile consistency pass moved the recap raster floor from 145 ms → ~245 ms by design — the cost bought the visible glass aesthetic the section explicitly wants.

| Route | Layers | RasterTask | Long tasks | Notes |
|---|---|---|---|---|
| lol-overview | ≤ 30 | ≤ 150 ms | ≤ 2 | 24 layers / ~100 ms / 1–2 long tasks across 3-run bracket. Long-task count is noisy run-to-run; 2 is the median, 3 is hit. |
| steam-library | ≤ 35 | ≤ 175 ms | ≤ 2 | 31 layers / 121–157 ms median ~129 / 0 long tasks (2026-08-02, after the portrait moved to its own route). **The raster floor went up when content was removed**, from ~67 ms at 26 layers: the two portrait bands used to sit between the identity hero and the trophy case, so the trophy-case art and the wishlist capsule were below the fold and did not raster at load. Promoting them above it costs more than the frosted chips did. The ceiling is widened to match rather than treated as a regression — but it is now the tightest of the non-list routes, so re-probe before adding anything above the fold here. The handle predates `/steam/library` existing and measures `/steam`, the profile page; the virtualised library route has no scenario of its own. |
| steam-portrait | ≤ 30 | ≤ 100 ms | ≤ 2 | 26 layers / 61–67 ms median ~63 / 0–1 long tasks / dropped=0 across a 3-run bracket (2026-08-06, after a third band of three frosted chips landed between the two halves). First baseline was 24–25 layers / ~53 ms, so three more chips cost ~2 layers and ~10 ms — the expected shape, recorded so the delta doesn't read as drift. Still cheaper than the profile page it moved off despite carrying more content: two editorial hero bands with no `backdrop-filter` at all, twelve frosted chips, and no art. Both its queries are primed in the route loader, so the numbers are a warm render rather than a fetch waterfall. |
| recap | ≤ 20 | ≤ 220 ms | ≤ 2 | 13 layers / 179–213 ms median ~195 / 1–2 long tasks. Pre-frosted-pass floor was 145 ms; the ~50 ms residual delta is the irreducible cost of the chapter outers carrying `bg-card/60 + backdrop-blur-sm` (vs the pre-pass `bg-card/40` with no blur). All 7 chapter outers are CV-auto-gated in [recap.tsx](../apps/web/src/routes/lol/$accountSlug/recap.tsx); below-fold chapters do not raster at cold-load. |
| wishlist-upcoming | ≤ 52 | ≤ 150 ms | ≤ 2 | 46 layers / 86–92 ms median ~87 / 1 long task across 3-run bracket (2026-06-11, post-chunk-4). The layer count sits above the other non-list routes by design: the imminent-hero leases the page-wide Steam backdrop and the frosted calendar wrapper + art-forward capsule tiles each promote. Raster stays low (~90 ms) because the capsule tiles are opaque art, not blur — only the calendar wrapper carries `backdrop-blur-sm`. dropped=0. Hero is skip-gated (nothing day-precise within 60 days → no hero, no lease); when skipped the layer count drops back toward the steam-library floor. |
| lol-patches | ≤ 30 | ≤ 300 ms | ≤ 2 | 22–27 layers / load raster 56–266 median ~230 / 1–2 long tasks / dropped=0 (2026-06-12, 3-run bracket, pinned to big patch 26.3 — 41 champions — with `?as=` lens). Raster floor raised by the V3 identity pass: page-wide splash claim + 3 frosted section cards; pre-V3 floor was ~45 ms at 19 layers. Scroll-bottom raster reads ~620–720 ms — the multi-viewport frosted champion card re-samples the animated splash through the scroll — but the scroll-phase gates (dropped=0, long tasks=0) pass and rows are CV-gated (`[content-visibility:auto]` per row, champion-table pattern). If a future patch dataset pushes dropped frames above 0, the documented fallback is demoting the champion card to `/50` (splash stays). |
| lol-champion-panel (list) | per `30 + ceil(visibleRows × 4)` | ≤ 200 ms | ≤ 2 | 64–68 layers at ~150 rows. List-shaped exception below. |

List-shaped routes (champion-list, match-list, library-list) are an explicit exception — they render N rows where N is determined by data, so layer count scales with viewport-visible row count. Current example: lol-champion-panel `01-load` (the champion-list page, not the panel) = 64–68 layers at ~150 rows. Budget for a list-shaped route is "the cold layer count should be roughly `30 + ceil(visibleRows × 4)`" — i.e. the base budget plus a per-row contribution. If a new list-shaped route exceeds that estimate, audit per-row class composition before merging.

**Interactive budget (panel-open / panel-close phases on panel-shaped routes):**

| Metric | Budget | Reference |
|---|---|---|
| Panel-open `RasterTask` | ≤ 1000 ms | lol-champion-panel current 709–929 ms (post-chunk-2) |
| Panel-close `RasterTask` | ≤ 2000 ms | lol-champion-panel current ~1500–1600 ms (post-chunk-2). This is a known floor — two cost-preserving levers were tried and reverted; the metric is GPU energy, not user-felt jank ([[feedback_panel_close_raster_floor]]). |
| Dropped frames in any phase | **0** | hard gate — non-zero dropped frames triggers a perf review regardless of other metrics |

**Scroll-bottom phase:**

No fixed layer-count budget — `content-visibility: auto` materialisation timing makes the measurement window-dependent (the same code can read 38 or 431 layers across runs depending on whether CV-auto has finished promoting by capture). Use dropped-frame count and long-task count as the gates instead.

**How to apply:**

- Before adding a new top-level route or a new panel, decide which existing scenario it most resembles and run `pnpm --filter @vyoh/tools-perf-probe probe -- --scenario <name>` to baseline.
- After landing the route, re-run the probe and compare against the budget above. A new surface that pushes a baseline scenario over its layer budget by more than ~50 layers, or any non-zero dropped-frame count, triggers a perf review before merge.
- Single-run probe numbers vary 10–20% on raster and ±2 on long-task count. Bracket with 3 runs before claiming a regression or improvement; only treat a delta as real if the median moves outside the budget. A non-zero dropped-frame count is the only single-run signal that needs no bracketing.
- **Discard the first run after any dev-server restart, or warm the route once before bracketing.** The first probe against a cold Vite dev server captures a *skeleton* and reports falsely excellent numbers: measured 2026-07-25, `lol-overview` read 3 layers / 31 ms raster / 0 long tasks cold, against 21–26 layers / 49–60 ms warm. It does not look like a failed capture — `web-vitals` still reports a plausible FCP (220 ms) and the run exits clean. The tell is that the `01-load` and `03-scroll-bottom` screenshots come out **byte-identical**, because content never arrived at all. Bracketing three cold runs pulls the median down roughly 40% and reads as a large improvement.
- Install the probe's browser through the tools package, not the workspace root: `pnpm --filter @vyoh/tools-perf-probe exec playwright install chromium`. A root-level `pnpm exec playwright install` resolves the root playwright pin and can fetch a different chromium build than the one the probe launches.
- When a visual identity ask (frosted recipe, splash backdrop, new chapter motif) intentionally raises a route's raster floor, widen that route's budget row to reflect the new floor *in the same change* — don't leave a stale budget for the next reviewer to flag as a regression. Note the trigger in the row's Notes column so the cost is traceable to the decision that paid for it.
- New surfaces that introduce layer-promoting CSS (`backdrop-filter`, `will-change`, `transform: translateZ(0)`, `isolate` with no descendant escape, `transition` targeting `transform`) or new Motion components should always re-probe.
- The thresholds above are derived from observed numbers and are not fundamental limits. They are calibrated to "don't regress what we have" — if you make a measured improvement that lowers a budget, edit this table to reflect the new bar.
- For panel-shaped surfaces, see also the [tile background convention](#tile-background-one-level-of-glass-between-background-and-content): panel-internal frosted tile clusters more than ~one viewport below the panel header should be wrapped in [`CvSection`](../apps/web/src/_shared/cv-section.tsx) so their `backdrop-filter` layer-promotion is gated to scroll-near. The scroll container — not the document viewport — is the IntersectionObserver root for CV-auto inside an `overflow-y-auto` panel; this was confirmed empirically in chunk 2 (see audit doc).

### Committed generated files must be documented here

Generated files (codegen output, router manifests, OpenAPI clients, Prisma artefacts) default to gitignored. Commit a generated file only when there is a deliberate reason (e.g. zero-cold-start dev, diff-as-audit-log), and record that reason in this section so the next reviewer doesn't raise it as a defect.

**Currently committed generated files:**

- `apps/web/src/routeTree.gen.ts` — TanStack Router file-based route manifest. Kept tracked so `pnpm dev` works immediately after `pnpm install` without a generate step; the diff also serves as a readable audit log when routes change.

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
