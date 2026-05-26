# API client consolidation — deferred decision

**Status:** Reference — decision record from a 2026-05-25 analysis comparing the Riot and Steam upstream clients in `apps/api/`. Conclusion: keep them separate today; revisit when a third upstream (Spotify, GitHub, WakaTime) lands.

Decision record from a 2026-05-25 analysis comparing the Riot and Steam upstream clients in `apps/api/`. Conclusion: keep them separate today; revisit when a third upstream lands.

Surface this note any time a new upstream API integration is being scoped (Spotify, GitHub, WakaTime, or any other third-party fetcher beyond Riot + Steam).

## Current state (2026-05-25)

Two upstream clients, fully separate code paths.

**Riot** — [apps/api/src/riot/rate-limiter.service.ts](../../../apps/api/src/riot/rate-limiter.service.ts) (~300 lines)
- Bottleneck, per-region chains (americas/europe/asia/sea) with fast (20/1s) + slow (100/2min) tiers
- Per-method limiters seeded from `METHOD_LIMITS`, dynamically updated from `X-Method-Rate-Limit` response headers
- 15s deadline + Bottleneck-callback short-circuit
- 429 + Retry-After retry loop in [riot.service.ts](../../../apps/api/src/riot/riot.service.ts)
- Global `RiotExceptionFilter` ([riot.exception-filter.ts](../../../apps/api/src/riot/riot.exception-filter.ts)) wired in [main.ts](../../../apps/api/src/main.ts)
- Auth: `X-Riot-Token` header
- No request caching (rate limiter is the constraint)

**Steam** — [apps/api/src/steam/rate-limiter.service.ts](../../../apps/api/src/steam/rate-limiter.service.ts) (~100 lines)
- Bottleneck, single flat reservoir: 100k calls/24h, minTime 200ms, maxConcurrent 4
- No per-endpoint differentiation, no 429 handling (Steam has no per-second ceiling)
- Same 15s deadline pattern
- No exception filter; errors handled ad-hoc per call site via inline `SteamClientError`
- Auth: query string `key=` parameter
- In-memory TTL caches in [steam.service.ts](../../../apps/api/src/steam/steam.service.ts): wishlist 60min, name 24h

## What actually duplicates today

| Pattern | Lines | Files |
|---|---|---|
| `Promise.race(fetch, setTimeout)` timeout block, AbortController dance, undici-ignores-signal workaround | ~90 lines × 2 | [riot.service.ts:193-214](../../../apps/api/src/riot/riot.service.ts#L193-L214), [steam-client.service.ts:232-240](../../../apps/api/src/steam/steam-client.service.ts#L232-L240) |
| Custom Error subclass shape | ~15 lines × 2 | `RiotError`, `SteamClientError` (inline) |
| `FETCH_TIMEOUT_MS = 10_000` | 1 line × 2 | both client files |

Total savings if extracted to a shared utility: ~100 lines (out of ~940). ~11% of upstream-client code.

## Decision: keep separate

Not worth consolidating today.

- The duplication is **stable** — these files don't get touched often.
- The drift risk is **real but low-probability** — the riskiest detail (undici ignoring AbortSignal on stalls) is already worked around in both copies, and any future fix is a small patch in two places, not a refactor.
- A shared `fetchWithTimeout` utility today is a thin wrapper with one second-consumer, which violates the "three similar lines is better than a premature abstraction" rule.
- The **rate limiter topologies are fundamentally incompatible** (Riot's per-region × per-method chain vs. Steam's flat bucket). Any abstraction over them today would be a leaky base class.

## Triggers to revisit

Land the extraction when **any** of the following becomes true:

1. **A third upstream is being scoped.** Spotify, GitHub, WakaTime, or anything else on the elevation backlog ([elevation-arcs.md](elevation-arcs.md), [self-portrait-surfaces.md](self-portrait-surfaces.md)). At three consumers the wrapper earns its keep.
2. **A timeout bug is found in one client that has to be ported to the other.** Concrete drift incident, not hypothetical — extract in the same change as the fix.
3. **Riot stops being the only client with per-method limits.** GitHub and Spotify both have Riot-shaped semantics (per-app/per-user quotas, 429 + Retry-After, secondary limits). If either lands, Steam becomes the outlier, and the right refactor flips: promote the Riot limiter pattern to a base, leave Steam flat. That's a different change than "share code between Riot and Steam."

## What to extract when a trigger fires

In rough order of value:

1. **`apps/api/src/_shared/http/fetch-with-timeout.ts`** — the `Promise.race(fetch, setTimeout)` block, AbortController setup, the undici-AbortSignal workaround, and the `FETCH_TIMEOUT_MS` constant. Pure utility, no upstream knowledge.
2. **`apps/api/src/_shared/http/upstream-error.ts`** — base `UpstreamError` class with `status`, `path`, `upstream` fields. `RiotError` and `SteamClientError` (and the new one) extend it. Keeps the global filter shape uniform.
3. **Limiter base only if 2+ upstreams have Riot-shaped semantics.** Do not generalise Bottleneck wiring with only one Riot-shaped consumer — the abstraction will fork the moment the second consumer needs a slightly different tier topology.

## What NOT to abstract prematurely

- **Auth injection.** Header vs query string vs OAuth header vs signed request — every upstream is different. Keep auth at the call-site or in a per-upstream client.
- **Response normalization.** Schemas differ; normalize per-upstream.
- **Cache layers.** Steam has TTL caches because Steam exposes mostly-static data (game names, wishlist). Riot doesn't because rate limits already constrain overuse. Don't lift this without per-upstream justification.
- **429 retry.** Only Riot needs it today. Steam doesn't have per-second throttling. Adding a no-op 429 handler to Steam to "be consistent" is cargo culting.

## Checklist when adding a new upstream integration

Before writing the new client:

1. Re-read this note.
2. Inventory the new upstream's constraints: rate limit shape (flat/per-method/per-region), auth shape (header/query/OAuth), error shape (429? Retry-After? secondary limits?), data volatility (cacheable?).
3. Decide which trigger above (if any) the new integration activates.
4. If a trigger fires: land the extraction as **the first chunk** of the integration work, not the last. The new client becomes the second consumer that validates the abstraction shape.
5. If no trigger fires: build the new client standalone, following the existing per-upstream layout. Add a row to the "Current state" table here.
