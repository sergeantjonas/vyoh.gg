# TanStack Start migration — Vite SPA → SSR on Hetzner

**Status:** ✅ Shipped 2026-07-27 — all 6 chunks landed over two days (1–3 + 4a on 07-26; 4b, 5, 6 on 07-27). The app server-renders through TanStack Start, hydrates clean on 12 routes verified against the **containerised production stack**, and the deploy machinery exists in-repo (two Dockerfiles, `compose.prod.yaml`, Nginx vhosts, `deploy.sh`). Nothing here is blocked on the repo any more — launch is blocked on buying the VPS ([hosting.md](../ops/hosting.md) checklist items 4 and 5).

Read the four **"What N turned out to be"** sections below before touching SSR, loaders, or the build: each chunk was scoped against this note's own predictions and each one overturned them. 4a found the blocker was missing loaders and cache dehydration, not render shape. 4b found every route was *failing* hydration, so the SSR was real in the HTML and worth nothing to users. 5 found every page declaring itself a duplicate of the homepage, and that 4b's own production check had been vacuous. 6 found three defects that exist only inside a container. Two follow-ups live in [open-work.md](../open-work.md): the Radix-portal detail routes need a non-portaled server variant, and the date formatters need `timeZone` pinned for visitors outside Europe/Brussels.

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

   **4b — the render shape.** ✅ Shipped 2026-07-27, and it turned into a hydration-correctness chunk once measured — see "What 4b turned out to be". Three more routes primed (`/lol/$accountSlug/matches` 62 → **1506**, `/steam/achievements` 176 → **1302**, `/steam/wishlist` 184 → **628**), the two virtualizers behind them given an `initialRect` so they emit rows without a scroll element, and **three live hydration mismatches fixed** that were causing React to discard the server tree on `/`, all of `/lol`, and all of `/steam`. All 12 routes now hydrate with a clean console against both the dev server and the built bundle.
5. **Loaders + `head()` completion.** ✅ Shipped 2026-07-27. Per-route `<link rel="canonical">` + `og:url` from the shell; `/lol` is a server-issued 307 via `beforeLoad`; `/sitemap.xml` is a Start server route generated from live data (**63 URLs, was 4**); `defaultErrorComponent`/`defaultPendingComponent` on the router with layout-shaped skeletons on the two routes that have one; a loader on `/lol/$accountSlug/`. See "What 5 turned out to be".
6. **Deploy.** ✅ Shipped 2026-07-27. [`apps/api/Dockerfile`](../../../apps/api/Dockerfile) + [`apps/web/Dockerfile`](../../../apps/web/Dockerfile), [`compose.prod.yaml`](../../../compose.prod.yaml), [`deploy/nginx/`](../../../deploy/nginx/), [`scripts/deploy.sh`](../../../scripts/deploy.sh), a `node:http` adapter over the Start bundle at [`apps/web/server/`](../../../apps/web/server/), and `WEB_ORIGIN` required under `NODE_ENV=production`. `vyoh.gg` stops being an Nginx static root and becomes a second `proxy_pass`, because SSR needs a long-lived Node process. The whole stack was brought up locally and probed; see "What 6 turned out to be".

Total estimated scope: **~140 file touches across 6 chunks.** The earlier ~15-modified/~5-new estimate predated the API_URL audit and assumed deploy machinery existed.

### What chunk 4 turned out to be

The chunk was scoped against the render-shape blockers listed below, on the assumption that they were what stood between the app and server-rendered content. **A per-route measurement on 2026-07-26 overturned that.** Every route was emitting 62–865 characters, and the dominant cause was not the portals or the virtualizers: **no route had a loader, so every `useQuery` rendered its pending branch.** Fixing a virtualizer to render on the server buys nothing while the data it would render is absent.

Two things followed, and both were load-bearing:

1. **There was no dehydration wiring at all.** `@tanstack/react-router-ssr-query` was neither installed nor referenced. The note's own claim that "loaders prime the cache server-side and `useQuery` returns primed data synchronously on first render" was true only of the server half. Without the integration the client builds a fresh cache, so a correct server response hydrates into a pending branch and React reports a mismatch. This was the actual precondition for the whole chunk.
2. **The route wrapper in `__root.tsx` was emitting `style="opacity:0"`** on every server-rendered document, from the cross-scope entrance fade. That defeats two of the three motivations verbatim: an HTML-only crawler reads the primary content behind an opacity rule, and LCP does not count an element that has not painted, so the largest element's timestamp slipped to whenever hydration finished. Suppressed for the first paint only; `key={scope}` still remounts on cross-scope navigation, where the fade was always the point.

The ordering in the chunk list was therefore wrong: "blocking loaders" sat in chunk 5 as polish, when data priming is what makes chunk 4 mean anything. The data path moved into 4a and shipped; the render-shape work is 4b.

**Not every route should be primed** — the decision rule, and why the champion table is deliberately excluded, is now a convention in [repo-conventions.md § "Server-render the routes a crawler cares about"](../../repo-conventions-web.md#server-render-the-routes-a-crawler-cares-about-not-the-ones-the-owner-cares-about).

### What 4b turned out to be

4b was scoped as "make the empty surfaces render". Probing a real browser against the server response first — rather than reading HTML, which is all 4a had done — found something the character counts could not show: **every route was failing hydration.** React was reporting `Hydration failed because the server rendered HTML didn't match the client`, which means it discarded the server-rendered tree and re-rendered the route on the client. The markup a crawler reads still shipped, so the measurement in 4a was honest; but no *user* was getting any benefit from it, on any route.

Three separate causes, all the same shape — a value read during render that differs between the server and the client's first render:

1. **`BackdropPortal`** opted out with `if (typeof document === "undefined") return null`. Server rendered nothing, client's first render rendered the portal. Hit `/` and every `/lol` and `/steam` route, since all of them mount a backdrop.
2. **`useMediaQuery`** initialised from `matchMedia` in a lazy `useState`, so the server said `false` and any desktop browser said `true`. Consumers branch structurally on it — the match row only mounts its hover popover under `(hover: hover)` — so the trees genuinely differed.
3. **`SeriousQueuesProvider`** seeded state from `localStorage` in a lazy initialiser. This one only fires once the owner has customised the queue selection, which is why it survives any empty-storage smoke test.

Plus `use-audio`'s `getServerSnapshot` returning a fresh object literal per call, which React flags as a potential infinite loop.

The rule and the correct shape per case are now a convention: [repo-conventions.md § "A server/client branch during render is a hydration bug"](../../repo-conventions-web.md#a-serverclient-branch-during-render-is-a-hydration-bug-not-a-safety-guard). `apps/web/src/lib/ssr-hydration.test.tsx` pins it per-hook; each assertion was checked against a reverted fix to confirm it fails.

**Two items were deliberately not done, on measurement rather than on time:**

- **The section-header portal stays client-only.** Rendering it in place on the server and moving it into the slot at hydration works, but the header contributes height inside `<main>` and none above it, so the move shifts everything below it — a CLS hit on every route, against the same ranking signal the migration is protecting. What it would buy is ~5 internal links per section route, and chunk 5's generated sitemap covers link discovery without the layout shift.
- **The recap chapters' `opacity: 0` cascade on `/` stays.** The concern was LCP, and a probe answered it: `/`'s LCP element is the `<p>` masthead at **228 ms, equal to FCP**. It paints in the first frame and is not opacity-gated, so the cascade below it costs nothing measurable. Suppressing the entrance would have traded the site's signature opening for a metric that was already fine.

### What 5 turned out to be

Two of the four planned items were the ones on the list. The other half of the chunk was found by reading what the server actually served.

**Every page in the app was declaring itself a duplicate of the homepage.** The root's `head()` carried a hardcoded `<link rel="canonical" href="https://vyoh.gg/">` and a matching `og:url`, inherited unchanged by all 29 routes — so `/lol/patches/26.14`, the exact page the migration exists to get indexed, told crawlers to index `/` instead. It cannot be fixed per-route: router merges `links` by exact JSON equality rather than by `rel`, so a leaf canonical is a *second* conflicting tag, not an override, and `/lol/x/matches/y/timeline` has three ancestors with a `head()`. It is now emitted once from the shell — full rule in [repo-conventions.md § "Exactly one `<link rel="canonical">`"](../../repo-conventions-web.md#exactly-one-link-relcanonical-emitted-from-the-shell). Verified one tag per document, correct per route, on the built bundle.

**Two more hydration mismatches, of a class the 4b sweep structurally could not find.** No `typeof window` anywhere in them: `PresenceMounts` polls live-game and Steam presence from the root layout, which is not code-split, while every route component is — so the root's fetch resolves before the route chunk arrives to hydrate, and the hydrating render sees data the server render never had. It only reproduces **while the owner is actually playing something**, which is why a full 12-route sweep passed over it twice. It was discarding the server tree on `/lol/$accountSlug` (the whole LoL landing page, which `/` and the new `/lol` redirect both feed into) and on `/`. Fixed by priming on the profile route and by a `useHydrated()` gate on `/`'s now-playing strip; the reasoning for which fix goes where is a convention now.

**The 4b production-hydration check had been vacuous, and this is what exposed it.** The scratchpad harness that serves the built bundle never served `dist/client`, so every asset 404'd, no client JS evaluated, and "clean console" meant hydration had not run at all. The harness now serves static files first. Both this chunk's sweep and 4b's claims are re-verified against it: 14 routes, production build, real client JS, clean.

Also shipped as planned: `/lol` returns a **307 with `Location: /lol/ahri`** instead of delivering a full document, hydrating it, and only then redirecting; `/sitemap.xml` is a server route built from `/me` + the patch list (63 URLs against the hand-maintained file's 4, with `lastmod` from each patch's date, and degrading to the static paths rather than 500ing if the api is down); and the router carries `defaultErrorComponent` + `defaultPendingComponent` so a rejected loader fails the region instead of the document (measured 2026-08-08: the shell, nav and palette do survive, but the response still carries **HTTP 500** — which is why whether a given prime is allowed to reject became a per-loader decision, recorded in [repo-conventions.md](../../repo-conventions.md)).

Measured: `/lol/$accountSlug` server text 234 → 269 characters, but the number understates it — the server used to render "Ranked Solo Unranked / Ranked Flex Unranked" against a real Emerald account, and now renders `822 · Emerald I 92 LP · 48W 47L · 51% · In Game`. It was serving a *wrong* identity, not a missing one.

### What 6 turned out to be

The machinery itself was the easy half. Both images build, the stack comes up (postgres healthy → 60 migrations applied → api healthy → web healthy), and Nginx `-t` passes. What made the chunk worth doing carefully is that **building the app in a container ran it, for the first time, in an environment that was not the dev container** — and three defects fell out of that difference alone. None of them is reachable from a local build, a passing test suite, or a code review.

1. **The production site would have shipped without its stylesheet.** Tailwind's automatic source detection skips whatever `.gitignore` excludes, and `dist/` is in ours, so locally it never scans build output. A Docker image has no `.git`. `pnpm build` runs the client pass first, so by the time the server pass generated CSS, `dist/client` existed and got scanned — the two passes produced different stylesheets, and the server render linked the hash only *it* had computed. `/assets/index-D-yqfqa_.css` 404'd on every page. Fixed with an explicit `@source not "../dist"` in `index.css`, which makes the output independent of a `.git` directory being present. After the fix the container build produces the same hash as the local one.

2. **Every canonical URL, `og:url` and sitemap entry came out relative.** `SITE_URL` read `import.meta.env.VITE_SITE_URL ?? "https://vyoh.gg"`, and a Docker `ARG` that the build was not given arrives as an **empty string**, which `??` passes straight through. This is chunk 5's bug reintroduced by chunk 6's plumbing, one week later, through a completely different mechanism. Fixed in [`env-origin.ts`](../../../apps/web/src/lib/env-origin.ts), which all three origin constants now go through.

3. **A hydration mismatch that only exists when the server and the browser are in different timezones.** Containers are UTC; the browser is not. Any `Intl.DateTimeFormat` without an explicit `timeZone` resolves to the process zone, so an unlock timestamp near midnight rendered "Jul 12" on the server and "Jul 13" in the browser, and React discarded the tree. It reproduced on `/steam/achievements` every single run and on no other route, because that was the only page with a timestamp close enough to midnight to straddle the offset. `TZ=Europe/Brussels` on the containers fixes it for the owner's zone, which is the zone every one of those formatters means. **It does not fix it for a visitor elsewhere** — see the follow-up in [open-work.md](../open-work.md).

Verification, through the containerised stack rather than a harness: **12 routes, zero hydration errors, zero failed requests**, and a positive check that the client bundle actually ran (⌘K opens the palette, so hydration wired handlers) — the check 4b's harness was missing when it reported a clean console against a page that had loaded no JS at all.

Two findings worth keeping for the next time this is touched:

- **`tsconfig.base.json` has to be copied into the image.** A missing `extends` target does not fail the build; TypeScript silently drops `skipLibCheck` and `strict`, and `tsc -b` then dies inside third-party `.d.ts` files with errors that have nothing to do with the app.
- **`pnpm deploy --legacy` leaves a symlink that makes its own output uncopyable**: `node_modules/.pnpm/node_modules/@vyoh/web -> /repo/apps/web`. Nothing resolves through it, but BuildKit follows symlinks while resolving a `COPY` source and fails with `resolve : lstat apps: no such file or directory`, which names neither the link nor the stage.

### What still does not render server-side

Each of these is now a decision rather than an omission:

- **The Steam library virtualizers** render rows only after their data arrives, and `/steam/library`'s owned-games query is 664 kB — over the priming threshold by an order of magnitude. `initialRect` was deliberately not added there: with no data it configures nothing.
- **`DeferredMount`** emits an empty placeholder, and is used on exactly one route (`/lol/$accountSlug/trends`) to slice the mount cost of a Recharts grid. Charts are not indexable content, so deferring them costs the migration's goal nothing and the paint budget benefits.
- **The 8 Recharts `ResponsiveContainer` sites** seed `{width:-1,height:-1}` because they size from measurement, which no server render has. Same reasoning: SVG chart geometry is not what an HTML-only reader is after.
- **The detail routes** (`matches/$matchId`, `champions/$championKey`, `library/$appid`) render inside a Radix `Dialog.Portal` and still emit ~66 characters despite being real indexable URLs with their own `head()`. This is the one genuinely unfinished item; `react-dom/server` cannot render a portal at all, so it needs a non-portaled server variant of the panel, which is its own chunk.

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
