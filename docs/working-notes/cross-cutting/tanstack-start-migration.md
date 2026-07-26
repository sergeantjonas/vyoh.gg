# TanStack Start migration — Vite SPA → SSR on Hetzner

**Status:** Active — committed direction (2026-05-26). Migration will happen as part of the pre-launch sweep alongside [owner-auth.md](../ops/owner-auth.md) and [hosting.md](../ops/hosting.md). Materially changes the web tier shape that hosting.md currently assumes (static rsync → long-running Node SSR), so the two notes need to land together when the sweep starts. **Every trigger condition is now clear, as of 2026-07-26** — MR1–MR4 shipped 2026-05-22, PN1–PN4 shipped 2026-05-22, owner-auth is not started, and TFT was cut from the trigger (see the Priority slot section). The sweep is unblocked and waiting on a start, not on a dependency. Round 5 N (route-loader pilot on match-detail) is the migration-safe Start prep that lands first. **Chunks 1, 2, 3 and 4a shipped 2026-07-26 — the app now server-renders, with real data on the routes that were primed**; the chunk list below was rewritten in chunk 1's commit after a live probe (see "Settled by probe") overturned this note's package names, entry contract, and scope estimate. Chunk 2 also closed Round 5 item O and [hosting.md](../ops/hosting.md)'s pre-deploy checklist item 1. Chunk 3 delivered a real document (shell, head merging, hydration) but thin content. Chunk 4a found out why: **the blocker was missing loaders and missing cache dehydration, not the render-shape items this note had listed** — see "What chunk 4 turned out to be". 4a shipped the data path (`/lol/patches` 61 → 1838 characters of server-rendered text); **4b still owes the render shape** — virtualizers, the section-header portal, `DeferredMount`, the Radix-portal detail routes, and the recap chapters' own `opacity: 0` entrance on `/`.

## Motivation

`apps/web` is a pure Vite + TanStack Router SPA. That's the right choice for an owner-only dashboard, but vyoh.gg is a **public freelance positioning surface** — the project CLAUDE.md is explicit about that, and [self-portrait-surfaces.md](self-portrait-surfaces.md) treats every public route as portfolio output. A CSR-only SPA has three concrete failure modes against that goal:

1. **AI-search citations lag JS rendering by 3–5 years vs Googlebot.** ChatGPT-Search, Perplexity, ClaudeBot read static HTML and skip most JS-injected content. For a recruiter-discovery surface in 2026, that's the whole channel.
2. **Google's render queue ≠ crawl queue.** Even Googlebot indexes the loading shell first, then queues a render that may run hours/days later. Anything in the render-only payload (title, description, structured data, primary content) is invisible to first-pass indexing.
3. **LCP requires the LCP element in the initial HTML.** A client-rendered splash backdrop fails LCP and degrades a confirmed ranking signal. The `perf-baseline.md` work already invested in size budgets caps the SPA at "good" but can't fix the structural ceiling.

Secondary: link previews on Slack, Discord, LinkedIn, iMessage all read the static `<head>`. Today `index.html` ships only `<charset>`, `<viewport>`, a favicon, and a 7-char `<title>`. Even with a one-commit static `<head>` baseline, per-route OG/title/description requires server rendering to be honest about route content.

## Why TanStack Start specifically

The frontend-2026 knowledge base's migration-cost ladder rates **"Vite + React SPA → TanStack Start"** at **1.5/5** — the cheapest React SSR migration on the table. Concretely:

- TanStack Router engine is the same in SPA mode and Start mode; the route tree and `routeTree.gen.ts` carry over unchanged.
- TanStack Query 5 is the canonical Start cache layer — loaders prime the cache server-side and `useQuery` returns primed data synchronously on first render.
- File-based routing convention stays; `@tanstack/router-plugin` swaps to `@tanstack/start-vite-plugin` (superset).
- Vitest 4 + happy-dom + the existing component tests are unaffected.
- Biome, tsconfig, Tailwind v4, Motion `domMax`, Radix — all unchanged.

Alternatives considered and rejected: **Astro** (cost 3, requires rewriting the SPA shell, kills the dashboard-shaped programming model); **React Router 7 Framework Mode** (cost 2, weaker typed search-params story than current TanStack Router, would also lose typed loader inference we'd gain from Start); **Next.js 16** (overkill, App Router migration is medium-to-hard, no RSC story we actually need for chart-heavy interactive surfaces).

Also considered and rejected as a non-SSR mitigation: **`persistQueryClient`** (TanStack Query localStorage/IndexedDB hydration on boot). It would give "instant last-seen data on cold load" without an SSR migration, and is ~30 lines of wire-up. Rejected because server-side loaders are strictly better at the same goal (no cache-key version-drift, no localStorage 5MB quota, no flash of stale data) and adding it now would be replaced by chunk 4. If this migration is ever descoped or deferred indefinitely, revisit `persistQueryClient` as the consolation prize. Parked entry in [library-shortlist.md § persistQueryClient](library-shortlist.md).

## What changes architecturally

**Entry contract changes; route components don't.** The delta is at the boundary:

| Today | After |
|---|---|
| `apps/web/index.html` (static, Vite-owned) | `__root.tsx` owns `<html>`/`<head>`/`<body>` via `shellComponent` |
| `main.tsx` calls `createRoot().render(<App/>)` | `src/router.tsx` exports `getRouter()`; Start generates the server + client entries |
| `vite.config.ts` uses `@tanstack/router-plugin` | Swap to `tanstackStart()` from `@tanstack/react-start/plugin/vite`, placed **before** `@vitejs/plugin-react` |
| Every `useQuery` runs in browser after hydration | Route-level `loader()` runs on server, primes Query cache, `useQuery` returns primed data on first render |
| `pnpm build` → static `dist/` | `pnpm build` → server bundle + client bundle; deploy target is a Node process |
| Per-route `<head>` impossible (one static index.html) | Per-route `head()` function returns `{ meta, links, scripts }` for SSR |

Hooks, `Link`, `useNavigate`, `useParams`, `useSearch`, `useRouterState`, `SplashProvider`, `LazyMotion`, the command palette, every chart component — all unchanged. The SSR boundary lands above the component tree.

**NestJS API: keep as-is.** The architecturally honest split is Start = SSR layer, Nest = domain layer. Loaders call out to Nest over HTTP exactly like browsers do today. This preserves the Riot Bottleneck rate limiter, the Nest exception filters, the validation pipes, and keeps the `apps/api`/`apps/web` package boundary clean. `createServerFn()` is available as a sidecar for narrow cases (status page actions, owner-only endpoints) but is not the default — wholesale RPC-migration would dilute the case-study story without buying enough.

## Hosting impact — the load-bearing question

[hosting.md](../ops/hosting.md) currently assumes the web tier is a static SPA: "Static SPAs are served by Nginx directly, no container. A container around `vite preview` or `serve` is pure overhead. Per site, expect 0–1 backend containers, not 2." The Start migration inverts that — the web tier becomes a long-running Node process behind Nginx.

**This does not change the host pick.** Hetzner stays. The frontend-2026 edge-platform decision table explicitly lists "Self-host on a VPS to control costs → Coolify or Dokploy on Hetzner" as a top-row option, and a CAX31 (8 vCPU ARM / 16 GB / ~€12.49/mo per the existing hosting.md sizing) absorbs a Node SSR process without strain. What changes is the per-site shape:

- Before: 1 Nginx vhost + static `/var/www/<project>/dist/` + 1 Node backend container.
- After: 1 Nginx vhost + 1 Node web container (proxy_pass to `127.0.0.1:20XY`) + 1 Node backend container (proxy_pass to `127.0.0.1:20XX`).

Two Node processes per project instead of one. Memory budget delta: ~150–300 MB RSS for the Start SSR process. On a CAX31 with vyoh.gg as the primary tenant, this is comfortable. If the multi-site layout grows to 4–5 tenants, the static-rsync sites stay static-rsync — only `vyoh.gg` and any other intentionally-SSR'd site pay the SSR cost.

**Deploy mechanics on Hetzner.** Two valid shapes, both compatible with the existing hosting.md "rsync + `docker compose up -d --build`" convention:

1. **Add a `web` container to `vyoh.gg`'s docker-compose stack.** Same Dockerfile pattern as the `api`. Same loopback-port-Nginx-proxies-to-it pattern. No new infrastructure concept introduced.
2. **Static-prerender what can be prerendered.** Start supports per-route `prerender: true`. `/`, `/status`, `/lol/_shared/*` non-data pages, anything not behind a Riot-keyed lookup — can ship as build-time HTML to `dist/static/` and be served by Nginx directly, bypassing the SSR process. Only data-driven routes (`/lol/$accountSlug/*`, `/steam`) hit the Node process. This is the right shape long-term: SSR where it earns its keep, SSG elsewhere.

Coolify is rejected for the same reason the existing hosting.md rejects Watchtower — visible, intentional deploys via `deploy.sh` are more useful than a managed PaaS layer for a few sites. The migration adds zero new operational concepts on top of what hosting.md already plans.

## Migration chunks

Each chunk is independently committable. Chunks 1–2 are net-positive on their own even if Start never lands; chunk 4 is where the SEO payoff is actually won or lost; chunk 6 is operational.

1. **SSR-safety pass (no Start yet).** ✅ Shipped 2026-07-26. Guard the one unguarded module-scope browser read; reshape `QueryClient` + router into a `getRouter()` factory in `src/router.tsx` and move the `Register` augmentation with it. SPA behaviour unchanged.
2. **API base consolidation.** ✅ Shipped 2026-07-26. All 65 sites now import [`src/lib/api-url.ts`](../../../apps/web/src/lib/api-url.ts), split 58 fetch-side (`API_URL`, server-aware) / 7 render-side (`API_PUBLIC_URL`, build-time constant) — anything that lands in markup must be identical on both sides of a server render, so it cannot read the server origin. `index.html` gets the same value through a `transformIndexHtml` plugin, since it can't import from `src/`. A structural lint in `apps/api/src/conventions.spec.ts` fails on a re-declared literal. The 117 test assertions needed no change: the helper falls back to the same dev origin when `VITE_API_URL` is unset. Closes Round 5 item O and hosting.md checklist item 1.
3. **Entry cutover.** ✅ Shipped 2026-07-26. `@tanstack/react-start@1.168.32` added, `TanStackRouterVite` → `tanstackStart()` (which subsumes it, so `@tanstack/router-plugin` was dropped), `__root.tsx` gained a `shellComponent` + a root `head()` carrying index.html's base tags, and `index.html` + `main.tsx` are gone. Verified end to end: the built server bundle returns HTTP 200 with `<html lang="en" class="dark">`, per-route `<title>` merging (`/status` → "Status · vyoh.gg"), stylesheet links, and `<nav>`/`<main>` in the server HTML.

   Four things worth knowing before chunk 4:

   - **The provider stack lives in `createRouter`'s `Wrap`,** not in `__root.tsx`. `Wrap` renders above the route matches, which is what lets the tier-1 error boundary keep catching router crashes and guarantees the `QueryClientProvider` hands out the same instance the loaders read from router context. A `router.test.ts` case asserts that identity.
   - **CSS is imported `?url` and emitted as `links` in `head()`.** A bare side-effect import styles the client but leaves the first server response unstyled, which is a full-page flash on every cold load.
   - **`autoCodeSplitting` is not passable.** Start `omit`s it from its router schema and forces it on; passing it is a type error.
   - **`.size-limit.cjs` was rewritten, not repointed.** It parsed `dist/index.html`, and Start renders the document per request so no build-time HTML exists. It now walks `dist/client/.vite/manifest.json` from the single client entry through its transitive static `imports` (`build.manifest: true` added to vite.config). That walk finds the same 21 chunks the HTML parse did, which is the evidence the swap is faithful.

   **Budget change:** initial JS went from a recorded ~230 kB to a measured 241.65 kB gzip, so the ceiling moved 240 → 250 kB. That ~12 kB is the Start client runtime and hydration path, i.e. the cost of the feature, not a regression. The before/after numbers come from different measurement methods, so treat the delta as approximate.
4. **Hydration + SSR-content pass.** Split into 4a and 4b once measured — see "What chunk 4 turned out to be" below.

   **4a — the data path.** ✅ Shipped 2026-07-26. `@tanstack/react-router-ssr-query` added and wired in `router.tsx`; root route awaits `meQueryOptions()`; both `/lol/patches` routes await their notes through shared `queryOptions` factories; the root scope-fade stops emitting `opacity: 0` on the first paint. Measured against the built server bundle: `/lol/patches` 61 → **1838** characters of server-rendered text, `/` 630 → 801.

   **4b — the render shape.** Not started. The surfaces that render nothing *regardless of data*: the four virtualizers, the section-header portal, `DeferredMount`, the Radix-portal detail panels, and the recap chapters' own `opacity: 0` entrance on `/`.
5. **Loaders + `head()` completion.** Blocking loaders where VT choreography allows; `pendingComponent`/`errorComponent` (zero routes have either today); `lol/index.tsx`'s client-side `<Navigate>` → `beforeLoad` redirect; generated sitemap replacing the hand-maintained 4-URL `public/sitemap.xml`. Re-baseline against [perf-baseline.md](perf-baseline.md).
6. **Deploy.** `Dockerfile.api` (**does not exist** — there is no deploy machinery in-repo at all, so chunk 6 has no api Dockerfile to pattern from), `Dockerfile.web`, prod compose, Nginx vhost, `deploy.sh`, `WEB_ORIGIN` into `.env.example` + `requireEnv` (`main.ts:20` already reads it; it is the plumbing that is missing, not the read). Set `VITE_API_URL` at image-build time and `API_INTERNAL_URL` at container runtime — chunk 2 added both to `.env.example` with the reasoning. Note the vhost shape changes here: `vyoh.gg` stops being an Nginx static root and becomes a second `proxy_pass`, because SSR needs a long-lived Node process. Lands in the same window as hosting.md's pre-launch sweep.

Total estimated scope: **~140 file touches across 6 chunks.** The earlier ~15-modified/~5-new estimate predated the API_URL audit and assumed deploy machinery existed.

### What chunk 4 turned out to be

The chunk was scoped against the render-shape blockers listed below, on the assumption that they were what stood between the app and server-rendered content. **A per-route measurement on 2026-07-26 overturned that.** Every route was emitting 62–865 characters, and the dominant cause was not the portals or the virtualizers: **no route had a loader, so every `useQuery` rendered its pending branch.** Fixing a virtualizer to render on the server buys nothing while the data it would render is absent.

Two things followed, and both were load-bearing:

1. **There was no dehydration wiring at all.** `@tanstack/react-router-ssr-query` was neither installed nor referenced. The note's own claim that "loaders prime the cache server-side and `useQuery` returns primed data synchronously on first render" was true only of the server half. Without the integration the client builds a fresh cache, so a correct server response hydrates into a pending branch and React reports a mismatch. This was the actual precondition for the whole chunk.
2. **The route wrapper in `__root.tsx` was emitting `style="opacity:0"`** on every server-rendered document, from the cross-scope entrance fade. That defeats two of the three motivations verbatim: an HTML-only crawler reads the primary content behind an opacity rule, and LCP does not count an element that has not painted, so the largest element's timestamp slipped to whenever hydration finished. Suppressed for the first paint only; `key={scope}` still remounts on cross-scope navigation, where the fade was always the point.

The ordering in the chunk list was therefore wrong: "blocking loaders" sat in chunk 5 as polish, when data priming is what makes chunk 4 mean anything. The data path moved into 4a and shipped; the render-shape work is 4b.

**Not every route should be primed** — the decision rule, and why the champion table is deliberately excluded, is now a convention in [repo-conventions.md § "Server-render the routes a crawler cares about"](../../repo-conventions.md#server-render-the-routes-a-crawler-cares-about-not-the-ones-the-owner-cares-about).

### What does not render server-side today

Measured 2026-07-26, re-measured after 4a. This is 4b's work list:

- All 4 virtualizers return zero rows — the scroll element is the module singleton `mainScrollRef`, null on the server. This is what keeps `/lol/ahri/matches` at 62 characters, the worst route in the app.
- All 3 `createPortal` sites render `null`, **including the section-header portal that carries every section's title**. Note the constraint: the header is portaled to a slot *above* `<main>` for view-transition reasons, so rendering it in place on the server is a hydration mismatch. The likely shape is resolving the slot in a `useLayoutEffect` so the move happens before the first paint rather than after it.
- `DeferredMount` emits an empty placeholder; the champion splash is entirely client-only via `BackdropPortal`.
- The detail routes (`matches/$matchId`, `champions/$championKey`, `library/$appid`) render inside a Radix `Dialog.Portal`, so they emit ~66 characters despite being real indexable URLs with their own `head()`.
- The recap chapters on `/` run their own `initial={{ opacity: 0 }}` cascade, so `/`'s content is still served invisible even though the root wrapper no longer is. `/` is the highest-value page for the migration's stated goal, so this one matters more than its size suggests.
- 8 Recharts `ResponsiveContainer` sites seed `{width:-1,height:-1}`.

## Priority slot — when to do this

**After the majority of features are built; before the pre-launch sweep starts.** Concrete trigger conditions:

- **Match Review surface complete through MR3 or MR4** ([match-review.md](../lol/match-review.md)). MR1–MR2 are mid-flight as of 2026-05-22; doing the migration mid-arc would make every chunk in MR3+ pay the dual-context tax (SPA mental model vs SSR mental model).
- **Profile Narrative tier (PN1–PN4) shipped** ([lol-owner-data-features.md § Arc 2](../lol/lol-owner-data-features.md#arc-2-profile-narrative-tier)). Same reasoning — these are render-shape changes that interact with how loaders are scoped.
- ~~**Steam S5 / TFT integration shape decided.**~~ **Cut from the trigger 2026-07-26 — TFT does not gate this migration.** The stated reason was that chunk 2's `__root.tsx` document-ownership change "should know about all sections, not retrofit". That does not survive scrutiny. `/steam` was added as a second top-level route long after `/lol` existed and the root absorbed it generically through `topLevelScope()`, so a later section costs the same whenever it lands: a route file, a `head()`, a sitemap entry, a `topLevelScope` case, and `useScrollResetOnNav` in the section root. None of that is cheaper for having been anticipated. Meanwhile the bullet below argues owner-auth should be built once against the final architecture rather than retrofitted from the SPA — that argument applies to TFT with equal force and points the opposite way from the gate. Since TFT is explicitly "warm but not urgent, owner not playing the current set" ([tft-integration.md](../tft/tft-integration.md)), the gate was holding the entire pre-launch sweep against a retrofit cost that isn't real. **TFT now lands after Start, built once against SSR.**
- **Owner-auth not yet started.** Auth and SSR interact (cookie-based session reads in loaders are very different from client-only auth). Doing Start first means owner-auth is built once, against the final architecture.

**What does NOT need to be shipped first:**

- Hosting itself (this migration lands as part of the same pre-launch sweep, not after a prior hosting deploy).
- Phase 4 runtime image proxy (orthogonal — proxy still works the same behind Start or behind the static SPA).
- Command palette expansion (palette is purely client-side; SSR doesn't touch it).
- Sentry / PostHog / RUM gap-fix work (also orthogonal; web-vitals → `POST /rum` works either way).

**Suggested sequence around the pre-launch sweep:**

```
[active feature arcs continue]
        │
        ▼
TanStack Start migration  ◄── this note
        │
        ▼
Owner auth (built against Start, not against SPA)
        │
        ▼
Hosting deploy (web container + api container, per updated hosting.md)
        │
        ▼
Public launch
```

The window is "feature ship cadence has slowed, pre-launch sweep is the next coherent unit of work." Per project CLAUDE.md large-task rules: at ~140 file touches and 6 chunks spanning entry-point + build + deploy, this is a **large task**. It needs a `/compact` before chunk 4 specifically, which is the widest one.

## Settled by probe, 2026-07-26

Built in an isolated scratchpad workspace pinned to this repo's exact versions (react-start 1.168.32, react-router 1.170.18, react 19.2.8, vite 8.1.5, pnpm 11, Node 22.22) rather than inferred from issue trackers:

- **The package this note originally named is dead.** `@tanstack/start` is frozen at 1.120.20. The live package is `@tanstack/react-start`, Vite-native, **no vinxi**.
- **No router bump needed.** `@tanstack/react-start@1.168.32` depends on `@tanstack/react-router@1.170.18`, which is exactly what is installed.
- **The scary open issues do not reproduce.** [#7418](https://github.com/TanStack/router/issues/7418) (`virtual:tanstack-start-client-entry` 404 on vite@8 + pnpm monorepo) returns HTTP 200 — fixed in a patch release, issue is stale-open. [#7614](https://github.com/TanStack/router/issues/7614) ("Cannot GET /", SSR middleware skipped on Vite 8) does not reproduce; dev SSR returns HTTP 200 with the marker in server HTML. [#7589](https://github.com/TanStack/router/issues/7589) is RSC-only and we have no RSC.
- **Deploy artifact shape confirmed.** `pnpm build` emits `dist/client/` + `dist/server/server.js`. That server bundle exports a **`fetch` handler and does not self-listen**, so chunk 6 needs either a ~25-line `node:http` adapter over it or the nitro plugin. A hand-written adapter was verified end-to-end (HTTP 200, SSR marker present).

## Open questions

- **React Compiler composition.** react-compiler runs through `@rolldown/plugin-babel` in this repo; the probe did not test that composing with `tanstackStart()`. This is chunk 3's main uncleared risk.
- **Does `routeTree.gen.ts` regen identically under the Start plugin?** The probe used a fresh route tree, not this repo's. Verify on the chunk 3 cutover.
- **Per-surface SSR decisions.** See "What does not render server-side today" above — each of those is a chunk 4 call, not a blanket policy.
- **Hosting.md update timing.** The "Static SPAs are served by Nginx directly" line in hosting.md becomes wrong the moment chunk 6 lands. Update hosting.md in the same commit window, not separately.

## Cross-references

- [perf-baseline.md](perf-baseline.md) — bundle budgets and LCP ceiling that this migration removes. Re-baseline after chunk 4.
- [case-study-topics.md](case-study-topics.md) — "SPA → SSR migration on a self-hosted Hetzner VPS via Docker Compose" is a sharper case-study line than the static deploy story. Add it as a topic when this note promotes to active.
- [self-portrait-surfaces.md](self-portrait-surfaces.md) — every surface that depends on link previews / SEO benefits from chunk 3 specifically.
- [../ops/hosting.md](../ops/hosting.md) — the "per-site shape" assumption changes; this note and that one must land together.
- [../ops/owner-auth.md](../ops/owner-auth.md) — build auth against Start (cookie-in-loader) rather than the SPA (client-only).
- [../lol/lol-image-pipeline.md](../lol/lol-image-pipeline.md) — Phase 4 runtime proxy is orthogonal and ships independently.
