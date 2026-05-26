# TanStack Start migration — Vite SPA → SSR on Hetzner

**Status:** Active — committed direction (2026-05-26). Migration will happen as part of the pre-launch sweep alongside [owner-auth.md](../ops/owner-auth.md) and [hosting.md](../ops/hosting.md). Materially changes the web tier shape that hosting.md currently assumes (static rsync → long-running Node SSR), so the two notes need to land together when the sweep starts. Sequenced after MR3/MR4 + PN1–PN4 ship and TFT shape is decided, before owner-auth implementation begins. Round 5 N (route-loader pilot on match-detail) is the migration-safe Start prep that lands first.

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
| `apps/web/index.html` (static, Vite-owned) | `__root.tsx` owns `<html>`/`<head>`/`<body>` via `RootDocument` |
| `main.tsx` calls `createRoot().render(<App/>)` | `server.ts` (renders to stream) + `client.ts` (hydrates); `app.tsx` shared |
| `vite.config.ts` uses `@tanstack/router-plugin` | Swap to `@tanstack/start-vite-plugin` |
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

Each chunk is independently committable. Chunks 1–3 are net-positive on their own; chunk 4 is the actual perf payoff; chunk 5 is operational.

1. **Add Start, dual-mode.** Install `@tanstack/start`, add `app.tsx`/`server.ts`/`client.ts` alongside `main.tsx`, swap the Vite plugin. Both `pnpm dev` and `vinxi dev` work; no routes touched. Verifies the toolchain alone.
2. **Cut over the entry.** Delete `main.tsx` and `index.html`; `__root.tsx` owns the document via `RootDocument`. Web Vitals plumbing, LazyMotion, QueryClientProvider, RouterProvider all move into `app.tsx`. Closes the dual-mode branch.
3. **Per-route `head()` for SEO baseline.** `/`, `/lol/$accountSlug/*`, `/steam`, `/status` each get title, description, OG, canonical. Generated sitemap.xml from the route tree at build. Closes the SEO gap from the [state-of-app evaluation](#).
4. **Loaders on `/lol/$accountSlug/*` and `/steam`.** Server-prime the account + matches queries on first render. Measure LCP delta against [perf-baseline.md](perf-baseline.md). This is the only chunk that needs an SSR-flavoured test pass — happy-dom can't run loaders.
5. **Deployment cutover.** Dockerfile.web, docker-compose entry on the Hetzner box, Nginx vhost rewrite from static-root to proxy_pass, prerender wiring for static routes. Lands in the same window as hosting.md's pre-launch sweep.

Total estimated scope: ~15 files modified, ~5 new files, all in `apps/web/`. No changes outside that package except adding the web service to the deploy compose file.

## Priority slot — when to do this

**After the majority of features are built; before the pre-launch sweep starts.** Concrete trigger conditions:

- **Match Review surface complete through MR3 or MR4** ([match-review.md](../lol/match-review.md)). MR1–MR2 are mid-flight as of 2026-05-22; doing the migration mid-arc would make every chunk in MR3+ pay the dual-context tax (SPA mental model vs SSR mental model).
- **Profile Narrative tier (PN1–PN4) shipped** ([lol-owner-data-features.md § Arc 2](../lol/lol-owner-data-features.md#arc-2-profile-narrative-tier)). Same reasoning — these are render-shape changes that interact with how loaders are scoped.
- **Steam S5 / TFT integration shape decided.** If TFT lands as a third top-level route, the `__root.tsx` document-ownership change in chunk 2 should know about all sections, not retrofit.
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

The window is "feature ship cadence has slowed, pre-launch sweep is the next coherent unit of work." Per project CLAUDE.md large-task rules: at ~20+ file touches and 5 chunks spanning entry-point + build + deploy, this is a **large task**. It needs a `/compact` before chunk 1 starts and likely another between chunks 3 and 4.

## Open questions to resolve before chunk 1

- **Does `routeTree.gen.ts` regen still work identically under the Start plugin?** Verify by running the dual-mode chunk first — if codegen diverges, the migration cost estimate (1.5/5) needs revisiting.
- **Does `SplashProvider` + `useSplashChampion` survive SSR?** The provider mounts in `__root.tsx` and uses client-only state; needs an SSR guard or a "client:only" wrapping pattern.
- **Recharts `ResponsiveContainer` on the server.** The `width(-1)` warning [suppressed in main.tsx](../../../apps/web/src/main.tsx) is a client-only concern; on the server the container needs explicit dimensions or a client-only wrapper.
- **`localStorage` reads in the perf overlay and any other client-only state.** Must be guarded with `typeof window !== "undefined"` checks or migrated to `useEffect`.
- **Hosting.md update timing.** The "Static SPAs are served by Nginx directly" line in hosting.md becomes wrong the moment chunk 5 lands. Update hosting.md in the same commit window, not separately.

## Cross-references

- [perf-baseline.md](perf-baseline.md) — bundle budgets and LCP ceiling that this migration removes. Re-baseline after chunk 4.
- [case-study-topics.md](case-study-topics.md) — "SPA → SSR migration on a self-hosted Hetzner VPS via Docker Compose" is a sharper case-study line than the static deploy story. Add it as a topic when this note promotes to active.
- [self-portrait-surfaces.md](self-portrait-surfaces.md) — every surface that depends on link previews / SEO benefits from chunk 3 specifically.
- [../ops/hosting.md](../ops/hosting.md) — the "per-site shape" assumption changes; this note and that one must land together.
- [../ops/owner-auth.md](../ops/owner-auth.md) — build auth against Start (cookie-in-loader) rather than the SPA (client-only).
- [../lol/lol-image-pipeline.md](../lol/lol-image-pipeline.md) — Phase 4 runtime proxy is orthogonal and ships independently.
