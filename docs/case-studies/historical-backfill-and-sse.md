# Backfilling Riot history in the background, streaming deltas to the client

## TL;DR

Two arcs in one session. The first was a bug: the matches list stopped growing roughly thirty minutes after the api came up, and the rate-limiter's `EXECUTING` counter climbed monotonically across cron ticks without ever decreasing. Two interacting issues compounded — abandoned promises leaked Bottleneck slots, and the slow regional reservoir's refill ticker drifted because every successful response was poking it via `updateSettings({ reservoir })`. The second was an architectural extension that the rate-limit fix unblocked: a backwards-walking historical worker grows the DB over successive cron ticks, and an SSE stream notifies the web app as new rows land so the matches list lights up live without the user ever leaving the cached endpoint. Companion to [riot-rate-limits.md](./riot-rate-limits.md).

## Setup

The story so far: the api keeps Riot off the user-facing path. A `MatchSyncService` runs `@Cron('*/5 * * * *')`, the cron syncs the latest 20 matches per whitelisted account into Postgres, all overview screens read from `GET /matches/cached` (pure DB), and the rate limiter is a three-tier Bottleneck chain (per-method → regional fast → regional slow) with header-driven drift correction. That earned the app a working warm path.

What it didn't earn: a database that ever held more than the latest twenty matches per account. The cron was head-only; deeper history was never reached. And every five minutes the cron logs grew angrier:

```
01:55:53  europe:match-ids-by-puuid still pending after 10000ms — 0 queued, 29 in flight
01:55:58  europe:match-ids-by-puuid exceeded 15000ms deadline — abandoning (queued: 0, executing: 29)
```

The `executing` count is monotonic across the log: 20, then 1, 2, 3 … climbing past 34. Slots are entering the chain and never leaving it. After enough leaked slots, the regional fast bucket's `maxConcurrent: 8` saturates and nothing dispatches at all.

## What the in-flight counter said

The diagnostic that broke the case last time was that **the inner `callback dispatched after Nms` log was missing**, while the upstream limiter still reported `EXECUTING > 0`. Same shape this time: not a single dispatched-callback log appeared for the wedged jobs. So Bottleneck had accepted the work but the chain never invoked the wrapped function. With the chain stalled, the 15-second outer deadline kept tripping — the user-facing await unwound cleanly each time, but **the limiter job stayed scheduled**. Its slot was still ours; we'd just stopped waiting for it.

Two interacting bugs surfaced from there.

### Bug 1 — abandoning the deadline doesn't cancel the limiter job

```ts
const queued = limiter.schedule(async () => { /* ... */ });
return await Promise.race([queued, deadline]);
```

`Promise.race` rejects the caller's await when `deadline` wins, but `queued` keeps running inside Bottleneck. If the chain is healthy, the wrapped `fn` eventually runs, the slot frees, and we've just spent a Riot call on data nobody is waiting for — wasteful but bounded. If the chain is genuinely stuck, the wrapped `fn` never runs and the slot leaks forever.

Fix: short-circuit *inside* the wrapped callback. The slot is still consumed when the chain finally dispatches, but the work is dropped immediately:

```ts
const queued = limiter.schedule(async () => {
  if (Date.now() - start >= deadlineMs) {
    throw new RateLimiterTimeoutError(regional, family, deadlineMs);
  }
  return fn();
});
queued.catch(() => {}); // swallow late rejection so it isn't unhandled
```

The outer `Promise.race` against the deadline still surfaces the timeout to the caller promptly. The inner check is what frees the slot when the queue drains.

### Bug 2 — `updateSettings({ reservoir })` perturbs the increase ticker

The slow regional limiter is configured with `reservoirIncreaseAmount: 1, reservoirIncreaseInterval: 1200`. A separate ticker calls `incrementReservoir(1)` every 1.2 s, approximating Riot's rolling-window release rate — [the load-bearing fix from the previous case study](./riot-rate-limits.md). `syncFromHeaders` reads the saturated counts off every successful response and shrinks the reservoir via `updateSettings({ reservoir: target })`. Both touch the same value; in steady state, on every Riot response, they're racing.

`updateSettings` is the catch-all settings-update API — it accepts a partial object and merges. It also schedules an internal recalculation of timers, including the increase ticker. If `syncFromHeaders` runs frequently enough to repeatedly call `updateSettings` between ticker fires, the ticker keeps getting nudged and the slow reservoir refills slower than 1.2 s/slot. Over a couple of hours of normal cron traffic, the reservoir settles at zero and stays there.

Fix: target the operation. `incrementReservoir(delta)` is the API designed to compose with the increase ticker. Negative deltas drain the reservoir without touching any other setting:

```ts
async function shrinkReservoir(limiter: Bottleneck, target: number) {
  const current = await limiter.currentReservoir();
  if (current === null || target >= current) return;
  await limiter.incrementReservoir(target - current);
}
```

With both fixes in, `EXECUTING` decrements normally across ticks. A periodic `logger.debug` of every limiter's counts + reservoir was added at the same time so the next regression is visible from the log without re-instrumenting.

## The architectural arc — walking history backwards in time

Fixing the wedge unblocks the actual feature work. The cron has always been head-only: `getMatchIdsByPuuid({ count: 20 })`, no offset, no time bound. New games appear at the head and get backfilled; old games never enter the DB. So if a fresh user lands on the matches page, scrolls past twenty rows, the cached endpoint hits its ceiling and TanStack stops paginating — because the DB *is* the ceiling.

The deepening had to be a background concern. The user-facing path has to stay DB-only; that's what makes browsing snappy and resilient to Riot's tail latency. So a separate `syncAccountHistorical` step runs alongside head sync each tick, walking each account's match history one page deeper.

The naive design is offset-based: each tick, fetch `start: cursor, count: 20`, advance `cursor += 20`. This drifts. Riot's match-IDs endpoint returns matches in playedAt-descending order, and `start` is a window into that ordering. New games played between ticks shift the entire ordering forward, so games that were at position 21 last tick are at position 26 next tick — and we'd skip rows 21–25 entirely.

Time-based is robust:

```ts
const oldest = await this.prisma.match.findFirst({
  where: { puuid: summoner.puuid },
  orderBy: { playedAt: "asc" },
  select: { playedAt: true },
});
const endTime = Math.floor(oldest.playedAt.getTime() / 1000) - 1;
const ids = await this.riot.getMatchIdsByPuuid(summoner.puuid, regional, {
  endTime,
  count: HISTORICAL_PAGE_SIZE,
});
```

Riot's `endTime` parameter is exclusive: it returns matches strictly older than the boundary. Anchoring on the oldest match in the DB and walking backwards by `endTime` is invariant under any churn at the head. Each tick advances the floor; eventually Riot returns fewer than `HISTORICAL_PAGE_SIZE` IDs, which the worker treats as "reached genesis" and persists as `historicalDoneAt: DateTime?` on the `Summoner` row so future ticks skip the call entirely.

For four accounts × 21 Riot calls/tick (1 ID + up to 20 backfill) every 5 min, total throughput is well under the 100 calls / 120 s app-slow ceiling, and Bottleneck paces the burst. A 1000-game account fully backfills in ~4 hours of unattended uptime.

## Live updates via SSE

With the worker running, the matches page total grows in the background but only refreshes on TanStack's stale boundaries. The portfolio shape called for something better: when new rows land, light up the UI. NestJS's `@Sse` decorator and a tiny RxJS `Subject` were enough.

A `MatchEventsService` exposes a single `Subject<MatchUpdatedEvent>` plus a `forPuuid(puuid)` filter helper. Both `syncAccountMatches` and `syncAccountHistorical` `emit({ puuid, added, source: "head" | "historical" })` after each successful backfill (only when `added > 0` — silent ticks stay silent). The controller route resolves the requested account to a puuid, returns a merged observable of filtered events plus a 30 s heartbeat, and the heartbeat stream alone (no real events) keeps the connection alive when no summoner row exists yet:

```ts
@Sse("matches/events")
async matchEvents(@Param() params): Promise<Observable<MessageEvent>> {
  return this.lol.subscribeToMatchEvents(params.region, params.gameName, params.tagLine);
}
```

The frontend hook is small. It opens an `EventSource` scoped to the active account, listens for `match-updated`, and calls `queryClient.invalidateQueries` with a predicate that matches the relevant cached keys:

```ts
source.addEventListener("match-updated", () => {
  queryClient.invalidateQueries({
    predicate: (q) => {
      const key = q.queryKey;
      if (!Array.isArray(key) || key[0] !== "lol") return false;
      const kind = key[1];
      if (kind !== "matches-cached" && kind !== "matches-cached-infinite") return false;
      return key[2] === region && key[3] === gameName && key[4] === tagLine;
    },
  });
});
```

Mounted at the `$accountSlug.tsx` layout, so the stream survives sub-tab navigation and tears down only on account switch or unmount. EventSource handles reconnection on its own; the heartbeat keeps proxies from killing idle connections.

The critical design choice was *what* to push. The payload is intentionally tiny — just `{ puuid, added, source }` — not the new rows themselves. The frontend doesn't apply optimistic updates; it just learns its cache is stale and refetches against `/matches/cached`. That keeps the SSE schema decoupled from the row schema, and it means the same notification works for the matches list, trends, champions, and any future view that watches the same query keys. Push is for *signalling*; DB reads are for *content*.

## What changed for the user

Nothing on the snappy path. The matches page, trends, and champions tabs still read from `GET /matches/cached`. The cached endpoint is still pure DB. The only visible difference is the bottom of the matches list — "Showing all 80 matches" silently flips to "80 loaded · scroll for more" the moment the worker reports a new page, without a manual refresh.

## Lessons

1. **Abandoning a Bottleneck-scheduled promise doesn't cancel the underlying job.** Slots leak indefinitely if the wrapped function never resolves and the chain is wedged. Inner short-circuits free the slot the moment the chain dispatches.
2. **The chained-limiter `EXECUTING` count is structurally misleading in two opposite ways.** Last case study: it climbed without dispatching because an upstream slot was held while waiting downstream. This case study: it climbed without dispatching because abandoned slots stuck around. The diagnostic that pivoted both investigations was the inner `callback dispatched` log — trust that, not the counter.
3. **Bottleneck's `updateSettings` is a wide brush.** When a setting has a dedicated mutator (`incrementReservoir`, `currentReservoir`), prefer it. `updateSettings` recalculates internal timers in ways that compose poorly with `reservoirIncrease*`.
4. **Time-based cursors are robust under head churn.** Offset-based pagination drifts when new rows are appended at the head; `endTime` against `min(playedAt)` doesn't.
5. **Push for signalling, pull for content.** SSE payloads stay small and decoupled from row schemas. TanStack Query's invalidation model handles the rest.

## Where the code lives

| Concern | File |
| --- | --- |
| Deadline short-circuit, `incrementReservoir` drain, periodic counter dump | [`apps/api/src/riot/rate-limiter.service.ts`](../../apps/api/src/riot/rate-limiter.service.ts) |
| `endTime` parameter on the match-IDs fetch | [`apps/api/src/riot/riot.service.ts`](../../apps/api/src/riot/riot.service.ts) |
| `syncAccountHistorical` walk + `historicalDoneAt` persist | [`apps/api/src/lol/lol.service.ts`](../../apps/api/src/lol/lol.service.ts) |
| Cron interleave (head + historical per account per tick) | [`apps/api/src/lol/match-sync.service.ts`](../../apps/api/src/lol/match-sync.service.ts) |
| RxJS pub/sub for backfill events | [`apps/api/src/lol/match-events.service.ts`](../../apps/api/src/lol/match-events.service.ts) |
| `@Sse` route + per-account subscribe | [`apps/api/src/lol/lol.controller.ts`](../../apps/api/src/lol/lol.controller.ts), [`apps/api/src/lol/lol.service.ts`](../../apps/api/src/lol/lol.service.ts) |
| Frontend EventSource hook + invalidation | [`apps/web/src/lol/use-matches.ts`](../../apps/web/src/lol/use-matches.ts) |
| Layout-level subscription mount | [`apps/web/src/routes/lol/$accountSlug.tsx`](../../apps/web/src/routes/lol/$accountSlug.tsx) |

## Open

- **Per-account TTL on `historicalDoneAt`.** Today, once the worker hits genesis, the cursor never re-walks. If Riot retroactively returns more (rare, but possible during their pagination boundary changes), the DB stays stale. A weekly re-walk would catch that.
- **Production-tier rate budget.** With a 500 req / 10 s app-fast key, the cron could land deeper pages per tick or walk more accounts in parallel. The `reservoirIncreaseInterval` constants would need to be re-derived alongside the slow ceiling.
- **Per-account fairness.** The cron walks accounts sequentially, so the last whitelisted account always advances last. Fine for ~5 accounts; not for ~50.
- **SSE on the deploy target.** Long-lived HTTP connections work on container hosts (Railway, Fly, render). Vercel-style serverless or Cloudflare Workers would need a different push primitive (durable objects, websockets via partykit, or a polling fallback).
