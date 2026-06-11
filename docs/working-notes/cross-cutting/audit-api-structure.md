# API structure findings — 2026-06-11 audit

**Status:** Active — four chunks scoped, none started. A1/A2 are sub-session quick wins, land anytime. A3 (structured logging) is bundled into the hosting pre-deploy sweep, not before. A4 is a judgement call at next Steam-endpoint touch.

Parent index: [audit-2026-06-11.md](audit-2026-06-11.md). Baseline verdict: `apps/api` is structurally healthy — 8 focused modules, no god-services (largest files are logic-dense but single-purpose), Prisma select/transaction discipline good, no N+1 hotspots, 11 pollers with proper running-guards, response types consistently shared via `@vyoh/shared`, 85 spec files at ~1.2:1 test:code on critical paths.

## A1 — Global fallback exception filter

Only [riot.exception-filter.ts](../../../apps/api/src/riot/riot.exception-filter.ts) exists. Non-Riot failures (SteamClientError, Prisma errors, plain throws) fall through to Nest defaults — inconsistent response shapes and no log hook. Add a global catch-all filter that: maps `SteamClientError` the way the Riot filter maps `RiotError` (404/429 pass-through, upstream flake → 502 with a user-facing message), logs unexpected errors with stack, and returns a consistent error body shape. Register alongside the Riot filter (Riot filter stays — it's more specific and runs first). Tests in the same commit, mirroring `riot.exception-filter` spec patterns.

## A2 — Validate env at startup

[env.ts](../../../apps/api/src/env.ts) is `requireEnv()` throw-on-first-use — a missing var surfaces mid-request, possibly hours after boot. Replace with a Zod schema (`RIOT_API_KEY`, `STEAM_API_KEY`, `DATABASE_URL`, optional `PORT`/`NODE_ENV`) parsed once in `main.ts` before `NestFactory.create`, exporting a typed `env` object. Keep `requireEnv` callers swapped to the typed object in the same change. ~1 hour including tests. Zod is already in the dependency graph posture (check before adding; if absent, a 10-line hand-rolled validator is acceptable — don't add a dep for this alone).

## A3 — Structured logging + request correlation (hosting-gated)

27% of services carry a `Logger`; format is plain Nest console; no request IDs, so a Riot 429 in the rate limiter can't be traced to the request that triggered it. The fix (Pino via `nestjs-pino`, request-id middleware, AsyncLocalStorage context) only pays off once the app is hosted and logs are aggregated — **bundle into the [hosting.md](../ops/hosting.md) pre-deploy sweep**, not before. Decision recorded: do not land piecemeal logger additions ahead of that; plain `Logger` remains the interim standard for new services.

## A4 — Steam interactive-endpoint retry gap

Riot calls retry explicitly (`fetchWithRetry`, MAX_RETRIES=2); Steam calls don't — pollers self-heal on the next tick (fine), but interactive endpoints (wishlist, game-detail enrichment on first view) surface one-shot upstream flake straight to the user. At the next touch of [steam-client.service.ts](../../../apps/api/src/steam/steam-client.service.ts), add a bounded retry (1 retry, idempotent GETs only) for calls on interactive paths, or deliberately record here that the web-side TanStack Query retry already covers it (it retries the whole API call, so a flaky Steam upstream gets re-attempted end-to-end — verify the QueryClient retry config counts these as retryable before closing this as no-op).

## Explicitly not chunked

- **lol-moments.service.ts size (1,195 lines)** — heavily-commented constants + ~650 lines of logic, cohesive, best-tested file in the api (1,632-line spec). Leave.
- **Shared promotion of api static data** (queue-types, regions, method-families) — promote only when the web actually needs one, per the shared-package convention. No speculative move.
- **Redis/BullMQ** — standing decision unchanged (project CLAUDE.md): wire only when a historical backfill worker actually needs a queue.
