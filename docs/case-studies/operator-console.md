# Putting a glass cover on a rate-limiter chain

## TL;DR

The two preceding case studies — [riot-rate-limits.md](./riot-rate-limits.md) and [historical-backfill-and-sse.md](./historical-backfill-and-sse.md) — both diagnose Bottleneck pathology from log archaeology alone: `grep "EXECUTING"`, watch a counter climb across cron ticks, infer the cause. The natural closing chapter is to stop reading the chain from a tail and make its live state visible from a screen, with knobs to actually take action on what you see. This is that chapter. The interesting parts aren't the dashboard pixels — they're the four small architectural decisions underneath: one snapshot method serving two consumers, one SSE backbone carrying two unrelated event shapes, mutation responses that patch the cache rather than invalidate, and a no-persistence MVP that turned out to be honest rather than lazy.

## Setup

The system had everything it needed to *recover* from a bad rate-limit state — header-driven drift correction, abort-on-timeout fetches, an outer schedule deadline, a `reservoirIncrease`-based slow regional limiter. What it didn't have was anywhere to *look* while it was misbehaving. Every debug session in the first two arcs started the same way: SSH into the running container, `tail -f` the logs, `grep` for the counters, eyeball the rate of change. The data was always there — the limiter chain has been logging `dumpCounters()` on a 10-second interval since the very first Bottleneck integration — but reading it from a log tail is a worst-of-both shape: too verbose to scan visually, too unstructured to plot.

The closing piece is a `/status` page that ingests the same numbers as a streamed live state, plus three buttons: **Sync now**, **Pause**, **Resume**. No auth gate yet — the MVP runs against `localhost:2010`; durable hosting is a separate problem.

## Same data, two consumers

`RateLimiterService` already had a `dumpCounters()` private method that logged a digest every ten seconds. Re-shaping it to return a value rather than write a log:

```ts
async getSnapshot(): Promise<RateLimiterSnapshot> {
  const app: AppWindowSnapshot[] = [];
  for (const [regional, windows] of this.appWindows) {
    for (const window of windows) {
      const role = window.windowSec === 1 ? "fast" : "slow";
      app.push({
        regional,
        role,
        windowSec: window.windowSec,
        capacity: role === "fast" ? APP_FAST_RESERVOIR : APP_SLOW_RESERVOIR,
        reservoir: await window.limiter.currentReservoir(),
        counts: window.limiter.counts(),
      });
    }
  }
  // method limiters elided …
  return { app, method, capturedAt: new Date().toISOString() };
}
```

`dumpCounters()` now calls `getSnapshot()` and formats it. Same data, two consumers — incident archaeology and live operation share the source of truth. If the screen ever shows numbers the log doesn't, that's a bug in one of the two formatters, not a bug in the data path.

This is small but load-bearing for the trustworthiness of the surface. A dashboard whose numbers drift from the logs is worse than no dashboard.

## SSE the second time — generalizing the primitive

The first SSE pass in this codebase ([historical-backfill-and-sse.md](./historical-backfill-and-sse.md)) carried per-account match-completion events: a `Subject<MatchUpdatedEvent>` filtered by `puuid` so each connected tab only saw its own rows land. Per-entity signalling.

The operator console wants something else. It's a firehose: every connected operator sees the same snapshot, same tick events, same heartbeats. No filtering, no per-client topology. The two shapes share a backbone — `MatchEventsService` now holds a third `Subject<SyncTick>` alongside the original two — but the controller composes them differently:

```ts
@Sse("stream")
stream(): Observable<MessageEvent> {
  const snapshots: Observable<MessageEvent> = interval(SSE_SNAPSHOT_INTERVAL_MS).pipe(
    startWith(0),
    switchMap(() => from(this.snapshot())),
    map((data) => ({ type: "snapshot", data }))
  );

  const ticks: Observable<MessageEvent> = this.events
    .forSyncTick()
    .pipe(map((tick) => ({ type: "tick", data: tick })));

  const heartbeat: Observable<MessageEvent> = interval(SSE_HEARTBEAT_MS).pipe(
    map(() => ({ type: "heartbeat", data: {} satisfies object }))
  );

  return merge(snapshots, ticks, heartbeat);
}
```

Three observables: a 2-second poll (`reservoir` and `EXECUTING` shift quickly under load — anything coarser hides the interesting transients), a rare tick on cron completion, a 30-second heartbeat so idle proxies don't drop the connection. `startWith(0)` matters more than it looks — without it the page is empty for two seconds on connect, which reads as broken.

The takeaway: the same SSE primitive can carry both *signalling-per-entity* and *operational-firehose* shapes without ceremony. The work is in deciding which subject pipes to filter through `puuid` and which pipes to publish unfiltered. The transport doesn't care.

## Optimistic mutation, authoritative stream

Three POST endpoints sit alongside the SSE stream:

```ts
@Post("sync")        triggerSync(): SyncTriggerResult { return this.matchSync.triggerNow(); }
@Post("sync/pause")  pauseSync():   SyncStatus        { return this.matchSync.setEnabled(false); }
@Post("sync/resume") resumeSync():  SyncStatus        { return this.matchSync.setEnabled(true); }
```

Each returns the new state. The frontend's natural reflex would be `queryClient.invalidateQueries(["status"])` and let a refetch carry the truth — but the SSE stream is already pushing a fresh snapshot every two seconds. Invalidating would force a redundant HTTP round-trip and race the streamed update.

Instead, each mutation patches the cache in place:

```ts
export function useSetSyncEnabled() {
  const queryClient = useQueryClient();
  return useMutation<SyncStatus, Error, boolean>({
    mutationFn: (enabled) =>
      post<SyncStatus>(enabled ? "/status/sync/resume" : "/status/sync/pause"),
    onSuccess: (status) => {
      queryClient.setQueryData<StatusSnapshot>(["status"], (prev) =>
        prev ? { ...prev, sync: status } : prev
      );
    },
  });
}
```

If the patched state ever diverges from reality, the next streamed snapshot overwrites it within two seconds. There's no race between optimistic and authoritative — the SSE stream is authoritative, and the optimistic patch is just a courtesy to bridge the gap. Drift self-corrects by construction.

The pattern only works because the snapshot is *complete* — the SSE frame sends the whole `StatusSnapshot`, not a delta. Patching with a partial response and reconciling with a complete stream is the right asymmetry: writes are easy to scope, reads are guaranteed fresh.

## In-memory MVP, no Prisma table

`MatchSyncService` keeps a ring buffer of recent ticks:

```ts
const HISTORY_LIMIT = 10;
// …
this.history.unshift(tick);
if (this.history.length > HISTORY_LIMIT) this.history.length = HISTORY_LIMIT;
```

That's it. No `SyncTick` table, no migration, no retention policy, no query path. A fresh boot starts with an empty history — which is *correct*. The limiter snapshots are already derived from live process state (Bottleneck instances reset on boot); persisting tick history while limiter state is ephemeral would be a tonal mismatch. Either the surface is "what is happening right now," or it's "audit log of all ticks across redeploys" — not both half-heartedly.

Ten ticks at five minutes apart covers the last fifty minutes of cron activity. That's the window an operator actually cares about — long enough to spot a regression in the latest deploy, short enough to fit on screen without scrolling. A historical table would be a different feature, and that feature isn't load-bearing yet.

Worth a line on the meta-pattern: most "operator surfaces" reach for the database reflexively because that's what "real" services do. Ephemeral data + ephemeral storage is the honest contract for live-state views. Skipping the table also skipped a migration, an indexing decision, a retention cron, and a query path the operator would never query.

## Env-seeded, mutable-at-runtime config

`MATCH_SYNC_ENABLED` reads the initial value at boot:

```ts
function isSyncEnabledFromEnv(): boolean {
  const v = process.env.MATCH_SYNC_ENABLED;
  if (v === undefined) return true;
  return v.toLowerCase() !== "false" && v !== "0";
}
```

`setEnabled(boolean)` then becomes the runtime toggle, hit by `/status/sync/pause` and `/status/sync/resume`. The pause is "hard": a manual `triggerNow()` while paused returns `{ triggered: false, reason: "paused", status: … }` rather than auto-resuming.

```ts
triggerNow(): SyncTriggerResult {
  if (!this.enabled) {
    return { triggered: false, reason: "paused", status: this.getStatus() };
  }
  if (this.running) {
    return { triggered: false, reason: "already running", status: this.getStatus() };
  }
  void this.syncAll().catch((err) => {
    this.logger.warn(`manual sync failed: ${err}`);
  });
  return { triggered: true, status: this.getStatus() };
}
```

The temptation is to treat "Sync now" as an override — the operator pressed the button, they obviously want a sync. But pause exists for a reason (a Riot outage, a deploy in progress, a debugging session). If pressing **Sync now** silently resumed, the surface would be lying about its own state. Cleaner contract: pause means paused, and the button reports the refusal honestly so the operator knows they need to resume first.

## What this earns

Three lines of value that the diagnostic arcs didn't:

- **An operator surface that reads from process state, not the log tail.** The numbers are the same numbers the case-study work was extracted from — except now they're scannable.
- **A pattern for layering live state on top of REST without doubling the contract.** The same `StatusSnapshot` shape comes through GET, through SSE frames, and from mutation responses. The cache key is the same. The semantics are the same. Just three transports for the same view.
- **A reusable shape for the SSE backbone.** `MatchEventsService` now hosts three subjects with different visibilities; future per-account or per-region streams compose by adding a fourth.

What it doesn't earn yet: an auth gate, an audit log of who pressed what, a deployed home outside `localhost:2010`. Those are separate features tied to a hosting decision, not to the operator surface itself.

## Looking back at the arc

Three case studies, in order:

1. **[Riot rate limits](./riot-rate-limits.md):** Bottleneck's `reservoirRefresh*` vs Riot's rolling window — a one-word configuration mismatch found by reading `EXECUTING` counters off the log.
2. **[Historical backfill and SSE](./historical-backfill-and-sse.md):** abandoning a `Promise.race` deadline doesn't cancel the limiter job, and `updateSettings({ reservoir })` perturbs the increase ticker — found by watching the same `EXECUTING` counter climb monotonically.
3. **This piece:** stop reading the counters from logs. Surface them. Add the three buttons. Decide what the system is for, decide what *not* to persist, and ship the smallest possible glass cover over the chain.

The first two were diagnostic; the third is operational. The arc is "from grep to glass" — same data, same primitives, increasingly direct ways of touching the system without an `ssh` shell.
