# When the limiter never even tried — a Riot API debugging story

## TL;DR

The Riot integration looked tidy: chained per-region limiters, header-driven drift correction, abort-on-timeout fetches, an outer schedule deadline. It worked under steady load. Then a database reset surfaced a hang on cold-start sync that defeated every safeguard. Three wrong hypotheses and one architecturally important fix later, the actual root cause was a one-word configuration mismatch: Bottleneck's `reservoirRefresh*` is a fixed-window primitive; Riot's accounting is rolling. Switching the slow regional limiter to `reservoirIncrease*` semantics — capacity drips back at the same rate Riot's window releases it — resolved the hang. This is the case study, including all the dead-ends.

## Setup

[vyoh.gg](https://vyoh.gg) is a personal multi-account LoL dashboard. The api integrates with Riot's Account-V1 and Match-V5 endpoints behind a NestJS service, with rate limiting via [Bottleneck](https://github.com/SGrondin/bottleneck). It is locked to a whitelist of ~5 of my own accounts — not a search engine.

Riot enforces two independent rate limits per personal-tier dev key:

- **App-rate-limit**: 20 req/s + 100 req/2 min, per regional cluster (`americas`/`europe`/`asia`/`sea`). Both apply globally across the whole app.
- **Method-rate-limit**: per-endpoint family. `MATCH-V5 /by-puuid/{puuid}/ids` is ~2000 req/10 s. `ACCOUNT-V1` is 1000/min. Different endpoints, different ceilings.

A warm match-list fetch with a populated cache is one Riot call (the match-IDs list refresh). A cold one fans out up to ~30 — Account-V1 lookup, match-IDs list, then Match-V5 detail per uncached match.

By the time the evening's debugging started in earnest, the integration looked clean:

- Three Bottlenecks chained per regional cluster: per-`(regional, method-family)` method limiter → regional fast app (20 req/s, `maxConcurrent: 8`) → regional slow app (100 req/2 min)
- `RateLimiterService.syncFromHeaders` parsing `X-App-Rate-Limit{,-Count}` and `X-Method-Rate-Limit{,-Count}` after every response, shrinking the matching reservoir to whatever Riot says we have left
- `AbortSignal.timeout(10_000)` on every fetch
- A 30-second schedule deadline as an outer backstop
- Reactive 429 retries with `Retry-After`

It had numbers behind it and worked under steady load. Then I ran `pnpm reset` (drop the Postgres volume + re-migrate) to verify a cold-start scenario.

## The symptom

The api boots, a `MatchSyncService` `@Cron('*/5 * * * *')` job kicks off the initial sync of the 4 whitelisted accounts. The first account succeeds. The next three hang.

```
01:16:32  TIFΑ Account-V1 succeeded (60ms)
01:16:42  europe:match-ids-by-puuid still pending after 10000ms — 0 queued, 1 in flight
01:17:02  europe:match-ids-by-puuid exceeded 30000ms deadline — abandoning (queued: 0, executing: 1)
```

The web app's matches page sits indefinitely. The refresh button does nothing — same 30-second deadline, same silence after. The UI looks frozen.

`executing: 1` is the load-bearing detail. Bottleneck has handed off a slot to fetch, and the fetch hasn't returned. So this is a hung fetch, right?

## Hypothesis 1 — `AbortSignal` should have caught this

We already had `AbortSignal.timeout(10_000)`. Why didn't it abort at 10 seconds?

Replace it with a manual `AbortController` for visibility:

```ts
const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), 10_000);
const res = await fetch(url, { signal: ctrl.signal });
```

Same result. The timer fires (we can log inside it), `ctrl.signal.aborted` flips to `true`, but `await fetch(...)` never resolves or rejects. Node's built-in `fetch`, which is `undici` under the hood, is silently ignoring our abort once the underlying TCP connection has stalled. This is a known behaviour under certain network conditions — particularly common under WSL2, where I'm running. The signal is honoured at the dispatcher layer for *new* requests, but not always for sockets that are already wedged. The signal goes "aborted", and the fetch promise stays pending forever.

## Hypothesis 2 — configure undici properly

If Node's bundled undici won't honour the signal, maybe we need to install npm `undici` and replace the global dispatcher with one that has explicit socket-level timeouts. This is widely-cited advice:

```ts
import { setGlobalDispatcher, Agent } from "undici";
setGlobalDispatcher(
  new Agent({
    connect: { timeout: 5_000 },
    headersTimeout: 5_000,
    bodyTimeout: 10_000,
  })
);
```

It does nothing.

**Node bundles its own internal copy of undici, separate from anything you install via npm.** `setGlobalDispatcher` from the npm `undici` package only affects code that imports `fetch` from `undici` directly — it has no effect on the built-in `fetch` global. Most online guides predate this split and don't mention it. Removed the dependency. Same hang.

## Hypothesis 3 — race the fetch against a hard timeout

If we can't *cancel* the hung fetch, work around it. Race the fetch against a manually-controlled timeout, and let the await throw on timeout regardless of what fetch itself does:

```ts
const ctrl = new AbortController();
const timeoutErr = new Error(`fetch timeout after ${FETCH_TIMEOUT_MS}ms`);
timeoutErr.name = "TimeoutError";

const hardTimeout = new Promise<never>((_, reject) => {
  setTimeout(() => {
    ctrl.abort(timeoutErr);
    reject(timeoutErr);
  }, FETCH_TIMEOUT_MS);
});

const fetchPromise = fetch(url, { headers, signal: ctrl.signal });
const res = await Promise.race([fetchPromise, hardTimeout]);
```

If `hardTimeout` wins, the await throws, we propagate `RiotError(504)`, and the limiter slot frees. The fetch promise itself stays pending in the event loop until Node's TCP layer reaps the socket — a leak, but a bounded one. The `AbortSignal` stays attached so undici can close the socket eagerly *if* it decides to honour it; if not, the race still saves us. Acceptable worst case; the alternative is "the api is hung."

Tested in isolation against a fetch that never resolves: the caller's await throws within 10 seconds, the limiter slot frees, the deadline never fires. Works.

But the bootstrap sync still hangs.

## Hypothesis 4 — the deadline is real, find why

This is the moment I almost said "the api is just slow on cold starts." Bad moment, walked back when challenged: *if `Promise.race` isn't firing, find out why.*

Add the obvious diagnostic — a log inside the limiter callback, fired the moment Bottleneck actually runs the user function:

```ts
const queued = limiter.schedule(async () => {
  const waited = Date.now() - start;
  this.logger.log(`${regional}:${family} callback dispatched after ${waited}ms`);
  try {
    const result = await fn();
    this.logger.log(`${regional}:${family} callback resolved`);
    return result;
  } catch (err) {
    this.logger.warn(`${regional}:${family} callback rejected: ${err.name}`);
    throw err;
  }
});
```

Reset the database. Reproduce. The trace tells the actual story for the first time:

```
01:16:32  TIFΑ Account-V1 callback dispatched after 4ms
01:16:32  TIFΑ Account-V1 callback resolved

[no "callback dispatched" log for the next match-ids-by-puuid]

01:16:42  europe:match-ids-by-puuid still pending after 10000ms — 0 queued, 1 in flight
01:17:02  europe:match-ids-by-puuid exceeded 30000ms deadline
```

The match-IDs callback **never dispatches**. This is not a fetch timeout problem. It is not an undici problem. The limiter is sitting on the job for 30 seconds and never running it.

(Side note on the misleading `executing: 1` count: that count belongs to the *method* limiter at the top of the chain. With `Bottleneck.chain()`, the upstream limiter marks a job as "executing" the moment it hands off downstream — even when the downstream limiter is still queueing it. So a job can be "executing" upstream and "never dispatched" anywhere actually doing work. The diagnostic counter we trusted was structurally wrong for chained limiters.)

Why is the limiter starving its own slot?

## The actual root cause

The slow regional limiter (the 100 req/2 min app bucket) was using Bottleneck's *refresh* semantics:

```ts
const slow = new Bottleneck({
  reservoir: 100,
  reservoirRefreshAmount: 100,
  reservoirRefreshInterval: 120_000,
});
```

Refresh semantics describe a fixed window. Every 120 seconds the reservoir is *replaced* with 100. Capacity comes back in one chunk at the boundary, not continuously.

Riot's accounting is **rolling**. The "100 req per 2 min" ceiling is a count of requests in the last 120 seconds, sliding forward every millisecond. Capacity is released continuously as old requests age out — there is no refresh boundary.

Most of the time this asymmetry doesn't matter. Here is when it does:

- After Account-V1 lookups burst out for 4 accounts in quick succession, the slow window's count climbs past 90 — normal warm-up traffic.
- `syncFromHeaders` reads the saturated `X-App-Rate-Limit-Count` and shrinks our local reservoir to ~0.
- With **refresh** semantics, the bucket now sits at 0 until the next 120-second tick. Up to 119 seconds of zero capacity, even though Riot's rolling window is releasing slots back to us in real time.
- The next match-IDs job is scheduled, queued behind the (now-empty) reservoir, and never runs.
- The 30-second deadline trips first, killing the user-facing promise but leaving the queued job rotting in Bottleneck's internals.

The fix is **increase** semantics, which approximate rolling-window release:

```ts
const slow = new Bottleneck({
  reservoir: 100,
  reservoirIncreaseAmount: 1,
  reservoirIncreaseInterval: 1_200,    // 100 / 120 s = 1 every 1.2 s
  reservoirIncreaseMaximum: 100,
});
```

One slot dribbles back every 1.2 seconds. If `syncFromHeaders` shrinks the reservoir to 0, capacity starts coming back inside ~1.2 seconds, not ~120. That tracks the rate at which Riot's rolling window is releasing capacity.

Reset the database. Reproduce. The 4 bootstrap syncs now complete cleanly across the cold start. No deadlines. No 429s.

## The architectural pivot

The rolling-window fix resolved the immediate hang. But the deeper lesson is that on a personal-tier dev key (100 req / 2 min), you cannot reliably backfill ~30 cold matches synchronously, ever — even with a perfect limiter. Treating Riot as the request-time data source for overview screens was the architectural mistake; the limiter was just the symptom.

The fix removes Riot from the user-facing critical path entirely:

- A `MatchSyncService` runs `@Cron('*/5 * * * *')` plus an `OnApplicationBootstrap` hook that fires once on api start, walking the whitelisted accounts and backfilling missing match details for each — through the same rate-limited `RiotService`, so it cooperates with on-demand traffic. A per-tick re-entrancy lock prevents overlap.
- All overview screens (Trends, Champions, *and the match list*) read from a separate `GET /matches/cached` endpoint that is pure DB. No Riot, no backfill, no possibility of a hang.
- A refresh button on the layout header triggers on-demand sync via `POST /matches/sync` and invalidates the relevant TanStack Query keys on success. Users get the "I want it now" affordance without us coupling page renders to Riot's tail latency.
- An adaptive count selector (20/50/100) shows only options that fit what's actually cached for the account, plus an "All N" cap when the total isn't already a preset. No more "click 100 → see 18 → think the app is broken."

Steady-state Riot traffic for ~5 tracked accounts is roughly **1–3 calls/min**, comfortably under any rate ceiling. The rate limiter still matters — when the cron is doing initial backfill on a fresh account, or when the refresh button is hammered — but it is no longer in the path of every page render.

## Side discovery — three concurrent queries per page nav

While instrumenting the limiter I noticed three near-simultaneous match-window fetches on every navigation between sub-tabs (matches → trends → champions). The cause was the layout's `AnimatePresence mode="popLayout"` keeping the *exiting* child mounted alongside the *entering* one for the duration of the transition — and each child carried its own `useMatchesWindow` hook. Three children mounted briefly = three queries, racing to the same endpoint.

The fix was to lift the query into the parent layout (`apps/web/src/routes/lol/$accountSlug.tsx`) and expose it to children via a `MatchWindowProvider` context. Single source of truth, single fetch, no fanout from the animation primitive. A useful reminder that animation primitives can have query-shape consequences.

## What we learned

1. **Bottleneck's `reservoirRefresh*` and `reservoirIncrease*` are not interchangeable.** Refresh is for fixed-window limiters with a documented refresh boundary. Increase is for rolling windows. Riot is rolling. If your upstream documents "X requests per Y" without specifying *fixed* or *rolling*, assume rolling and use increase.

2. **A "still pending" log is misleading if you don't log inside the actual unit of work.** The pre-existing 10-second warning was honest about the data it had — `QUEUED` and `EXECUTING` counts from Bottleneck — but those counts conflate "running on a slot" with "queued downstream in a chained limiter." Adding a `callback dispatched after Nms` log inside the scheduled function pivoted the entire investigation in one trace.

3. **Node's built-in `fetch` ignores `AbortSignal` under stalled connections.** Race against a hard timeout instead. The fetch promise will leak, but the caller's await throws and the limiter slot frees.

4. **Node bundles its own undici.** Installing the npm `undici` package and calling `setGlobalDispatcher` does **not** affect Node's built-in `fetch` global. Most online guides predate this split and are silently wrong on modern Node.

5. **A bounded outer deadline is necessary but not sufficient.** Tightened from 30 s to 15 s — better UX, no functional difference. The real fix was upstream of the deadline. Deadlines exist to prevent UIs from melting while you debug, not to mask underlying queue starvation.

6. **Take the upstream off the user's critical path.** Not just for rate-limit reasons — for *latency-tail* reasons. Even if every Riot call returned in 200 ms, a 30-call cold backfill is a 30 × 200 ≈ 6-second floor before any limiter friction. Background sync + DB-first reads makes the user-visible path always fast, regardless of upstream weather.

## Where the code lives

| Concern | File |
| --- | --- |
| Chained limiters, header sync, deadline race | [`apps/api/src/riot/rate-limiter.service.ts`](../../apps/api/src/riot/rate-limiter.service.ts) |
| `Promise.race` fetch wrapper, retry on 429 | [`apps/api/src/riot/riot.service.ts`](../../apps/api/src/riot/riot.service.ts) |
| Method-family seed limits | [`apps/api/src/riot/method-families.ts`](../../apps/api/src/riot/method-families.ts) |
| Background sync cron + bootstrap fan-out | [`apps/api/src/lol/match-sync.service.ts`](../../apps/api/src/lol/match-sync.service.ts) |
| Cached-only DB endpoint, on-demand sync mutation | [`apps/api/src/lol/lol.controller.ts`](../../apps/api/src/lol/lol.controller.ts) |
| Layout-level match window + provider | [`apps/web/src/routes/lol/$accountSlug.tsx`](../../apps/web/src/routes/lol/$accountSlug.tsx), [`apps/web/src/lol/match-window-context.tsx`](../../apps/web/src/lol/match-window-context.tsx) |
| Refresh button + sync mutation hook | [`apps/web/src/lol/refresh-account-button.tsx`](../../apps/web/src/lol/refresh-account-button.tsx), [`apps/web/src/lol/use-matches.ts`](../../apps/web/src/lol/use-matches.ts) |
| Adaptive count selector | [`apps/web/src/lol/match-count-selector.tsx`](../../apps/web/src/lol/match-count-selector.tsx) |

## Postscript

The rolling-window fix landed; weeks later the chain still wedged, in a different shape. Two compounding bugs (deadline-abandoned promises leaking Bottleneck slots, and `updateSettings({ reservoir })` drifting the `reservoirIncrease` ticker) had to be untangled before the next architectural arc — a backwards-walking historical worker that grows the DB over time, plus an SSE channel that streams new rows to the client — could land safely. Written up as a follow-up at [historical-backfill-and-sse.md](./historical-backfill-and-sse.md).

## Open

- Per-account TTL on cached results so a stale account self-heals if the cron is wedged.
- When swapping in a production-tier Riot key (500 req / 10 s app limit, very different shape) the `reservoirIncreaseInterval` for the slow bucket needs to be re-derived. The shape of "rolling window" doesn't change but the constants do.
- Sync fairness if accounts ever run in parallel — currently sequential per cron tick, which is fine for ~5 accounts; not fine for ~50.
