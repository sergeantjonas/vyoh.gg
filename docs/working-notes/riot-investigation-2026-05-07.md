# Riot API investigation — 2026-05-07

Internal log from the night the rate-limiter integration got its second pass. Companion to [docs/case-studies/riot-rate-limits.md](../case-studies/riot-rate-limits.md), which is the polished version. This file keeps the diagnostic chronology and dead-ends in case future me needs to re-derive any of it.

## In one sentence

Cold-start sync hangs were caused by a fixed-window vs. rolling-window mismatch in the slow regional Bottleneck — `reservoirRefresh*` made the bucket sit at 0 for up to 120 s after `syncFromHeaders` shrank it. Switching to `reservoirIncrease*` (one slot per 1.2 s) approximates Riot's rolling release rate and resolves the hang.

## Phases

### Phase 1 — pre-tonight setup

- Per-`(regional, family)` method limiter → regional fast (20/s, `maxConcurrent: 8`) → regional slow (100/2 min)
- `syncFromHeaders` shrinks reservoirs from `X-App-Rate-Limit*` / `X-Method-Rate-Limit*` after every response (strictly downward — never inflates)
- `AbortSignal.timeout(10_000)` on every fetch
- 30-second schedule deadline as outer backstop
- Reactive 429 retries with `Retry-After`

Worked under steady load.

### Phase 2 — cold-start hang reproduces after `pnpm reset`

`MatchSyncService.@Cron('*/5 * * * *')` bootstrap fires across 4 whitelisted accounts. First account succeeds. Next three hang. UI sits forever. Refresh button does the same.

Observed trace:

```
01:16:32  TIFΑ Account-V1 succeeded (60ms)
01:16:42  europe:match-ids-by-puuid still pending after 10000ms — 0 queued, 1 in flight
01:17:02  europe:match-ids-by-puuid exceeded 30000ms deadline
```

### Phase 3 — wrong hypotheses

- **AbortSignal isn't being honoured.** Manual `AbortController` in place of `AbortSignal.timeout`: same. Signal flips to aborted, `await fetch(...)` never resolves. Known undici behaviour under stalled connections; particularly common under WSL2.
- **Need to install npm `undici` and call `setGlobalDispatcher`.** Doesn't help. Node bundles its own internal undici copy. `setGlobalDispatcher` from npm undici only affects code that imports `fetch` from `undici` directly — not the built-in `fetch` global. Most online guides predate this split. Removed the dependency.

### Phase 4 — `Promise.race` hard timeout (real fix for in-flight stalls)

Race the fetch against a manual `setTimeout`-driven timeout:

```ts
const res = await Promise.race([fetchPromise, hardTimeout]);
```

If `hardTimeout` wins, our await throws regardless of what fetch is doing. The fetch promise leaks until the TCP layer reaps the socket. Acceptable; the alternative is permanent hang.

Tested in isolation: caller throws within 10 s, limiter slot frees. Works for the in-flight stall case.

### Phase 5 — bootstrap still hangs (Pattern E)

Added `callback dispatched after Nms` log inside the limiter's scheduled function. Reproduced cold-start hang. Trace:

```
01:16:32  TIFΑ Account-V1 callback dispatched after 4ms
01:16:32  TIFΑ Account-V1 callback resolved
[no "callback dispatched" for next match-ids-by-puuid]
01:16:42  europe:match-ids-by-puuid still pending after 10000ms — 0 queued, 1 in flight
01:17:02  europe:match-ids-by-puuid exceeded 30000ms deadline
```

Callback never dispatches. So `Promise.race` never gets a chance — the limiter is starving its own slot.

The `executing: 1` count belongs to the *method* limiter at the top of the chain. With `Bottleneck.chain()`, upstream marks a job as executing the instant it hands off downstream, even if downstream is still queueing. So that counter was structurally misleading.

### Phase 6 — root cause

Slow regional limiter was using `reservoirRefreshAmount: 100, reservoirRefreshInterval: 120_000`. Fixed window. After `syncFromHeaders` shrinks reservoir to ~0, bucket sits at 0 until the next 120-second tick.

Riot's accounting is rolling — capacity dribbles back continuously.

Fix:

```ts
reservoir: 100,
reservoirIncreaseAmount: 1,
reservoirIncreaseInterval: 1_200,
reservoirIncreaseMaximum: 100,
```

One slot per 1.2 s ≈ 100/120 s rolling release. Cold-start sync now completes cleanly across all 4 accounts.

## Side findings

- **AnimatePresence `popLayout` was triggering 3 simultaneous match-window queries per sub-tab nav.** Each child carried its own `useMatchesWindow`; popLayout keeps the exiting child mounted alongside the entering one. Fixed by lifting the query to the layout (`$accountSlug.tsx`) and exposing via `MatchWindowProvider`.
- **15 s schedule deadline > 30 s.** Tightened because 30 s of "still working" feels broken to the user. The deadline now exists only to prevent UI freezes during weird cases — the real fix was upstream of it.
- **Adaptive count selector.** Show only viable presets based on cached `total` + an "All N" cap. Otherwise users click "100" → see 18 → think the app is broken.

## Architecture after tonight

- Riot is no longer in the user-facing critical path.
- All overview screens (Trends, Champions, MatchList) read from `GET /matches/cached` (pure DB).
- `MatchSyncService` runs `@Cron('*/5 * * * *')` + on app bootstrap, walks whitelisted accounts.
- `POST /matches/sync` is the on-demand path triggered by the refresh button.
- Limiter chain unchanged in shape, only the slow regional limiter's reservoir primitive swapped.

## Followups parked

- Per-account cache TTL so stale accounts self-heal if cron wedges
- When moving to production-tier key (500/10 s), re-derive `reservoirIncreaseInterval`
- Sync fairness if accounts ever run in parallel

## Followups resolved

- SSE for refresh button progress — superseded by `00d085c` (live status dashboard). Granular per-account streaming was the original ask, but the status page + tick-completion SSE stream covered the underlying visibility need; reopening only if the coarser signal proves insufficient in practice.
