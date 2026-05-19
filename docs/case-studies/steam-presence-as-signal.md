# Polling presence as the signal source — Steam sessions and event-driven unlocks from one 2-minute tick

> Steam exposes a "now playing" field on `GetPlayerSummaries` but no session history and no unlock webhooks. Polling that field every 2 minutes — and treating the transitions as events — replaces both surfaces with one cron, drops the unlock-sync call budget from ~13.6k/day to ~950, and makes "you just earned X" detection near-realtime.

## TL;DR

- **The cheapest endpoint is the most useful one.** `GetPlayerSummaries` is one call per tick regardless of library size. Polling it every 2 minutes is the substrate; everything else hangs off the state transitions.
- **One tick writes two things.** Session row open/close, then a fire-and-forget per-game unlock refresh on every close. Library-wide unlock sweeps collapse from a 15-minute cron to a 4-hour backstop.
- **The DB's open-session row is the source of truth, not the prior player-state row.** Orphan sessions from a crashed deploy converge on the next tick without any explicit reconciliation pass.
- **Write order is load-bearing.** Transition write runs before the upsert; reversing it produces `endedAt < startedAt` by a few milliseconds (Node's clock vs. Postgres `CURRENT_TIMESTAMP`).
- **The poller-derived `SteamPlaySession` table is now canonical** for downstream cross-stream work — LoL-vs-Steam evening split, session-length histogram — without ever reconstructing sessions from achievement timestamps.

## The setup

Steam publishes three kinds of data we care about:

1. **Live state** — `ISteamUser/GetPlayerSummaries` returns `personastate` + `gameid` + `gameextrainfo` in one tiny payload. Cheap. Real-time-ish. No history.
2. **Unlock log** — `ISteamUserStats/GetPlayerAchievements` per app returns every unlock with a real `unlocktime` epoch. Has history. But: one call *per game*. With ~170 owned games that's ~170 calls per sweep. There's no webhook, no diff endpoint, no batch.
3. **Session history** — doesn't exist. Steam's API never tells you "the owner played Helldivers from 19:42 to 21:58 last night." You get `playtime_forever` (cumulative) and `playtime_2weeks` (rolling), and that's it.

Two questions fall out of this gap:

- **How do you keep the unlock log fresh without burning the budget?** A 15-minute sweep of every game is ~16k calls/day — order of magnitude above any reasonable headroom on a single Steam API key.
- **How do you build session history at all?** The data isn't on the wire. You have to manufacture it.

The earliest plan was achievement-anchor reconstruction — cluster `unlocktime` timestamps to infer "when did you actually play this." It works for games with achievements (Hades, Stardew) and produces nothing for CS2, Dota 2, and every demo. Functional but uneven. Parked once a better lever became visible.

The better lever: poll the live state field, treat transitions as events.

## The shape

```
                         ┌──────────────────────────┐
                         │ GetPlayerSummaries       │  ── one call every 2 min
                         │  (steamid, gameid, …)    │     720 calls/day, ~0.5% of budget
                         └────────────┬─────────────┘
                                      │
                                      ▼
                     ┌────────────────────────────────────┐
                     │ syncPlayerState() — single tick    │
                     │                                    │
                     │   load previous SteamPlayerState   │ ← anchors `endedAt`
                     │   ↓                                │
                     │   recordTransition({ prev, next }) │
                     │     reads open session row         │ ← source of truth
                     │     emits Action: noop / open /    │
                     │       close / closeAndOpen         │
                     │   ↓                                │
                     │   upsert SteamPlayerState          │
                     │     (write order matters!)         │
                     └─────────┬──────────────────┬───────┘
                               │                  │
                               ▼                  ▼
                       SteamPlaySession    fire-and-forget
                       row open/close      refreshUnlocksForGame(closedAppid)
                                                  │
                                                  ▼ (catch + log on failure)
                                       GetPlayerAchievements(appid)
                                       → insert new unlock rows
```

Two reconciliation layers sit behind it:

```
  hourly @15  GetRecentlyPlayedGames → refreshUnlocksForGame() per appid
              (offline-play backstop; proactive owned-games resync
               on previously-unknown appids)

  4-hourly    full library sweep   →  ~850 calls/day
              (defensive catch-all; tightened from /15min cron)
```

The session-close hook is the primary signal. The two backstops absorb whatever it drops on the floor.

## Why polling beats the alternatives here

**Webhooks.** Steam doesn't expose any. Closed.

**Achievement-anchor reconstruction.** Worked, but only for games with achievements. CS2, Dota 2, demos, dedicated-server entries all stay blank. Coverage problem.

**Polling presence at high cadence.** `GetPlayerSummaries` is one call regardless of library size. At 2-minute cadence that's 720 calls/day — a rounding error on the Steam Web API budget. The transition layer is doing the work; the polling is just the heartbeat.

The 2-minute interval falls out of a trade: under 2 minutes is overkill for "Now playing" UX (the chip refreshes within ~30s of the next tick on the client side), over 5 minutes starts to chop short sessions. A 10-minute Phasmophobia investigation logs as "didn't happen" at higher intervals.

## The pure transition function

Sessions could be derived inline in the service method that handles each tick. They're not — the decision lives in a pure function with no Prisma, no clock injection ([apps/api/src/steam/play-sessions.service.ts:38-80](../../apps/api/src/steam/play-sessions.service.ts#L38-L80)):

```ts
export function computeTransition(input: TransitionInput): TransitionAction {
  const { openSession, previous, next, now } = input;
  const targetAppid = next.appid;

  const closeEndedAt =
    previous !== null && openSession !== null && openSession.appid === previous.appid
      ? previous.lastPolledAt
      : now;

  if (openSession === null) {
    if (targetAppid === null) return { type: "noop" };
    return { type: "open", appid: targetAppid, name: next.gameName ?? `App ${targetAppid}` };
  }
  if (openSession.appid === targetAppid) return { type: "noop" };
  if (targetAppid === null) {
    return { type: "close", openId: openSession.id, closedAppid: openSession.appid, endedAt: closeEndedAt };
  }
  return { type: "closeAndOpen", /* ... */ };
}
```

Four states in, four actions out (`noop`, `open`, `close`, `closeAndOpen`). Eight unit tests cover the matrix including both orphan paths — no DB mocks, no clock stubs, no NestJS test module. Same shape as the LoL-side `diffOwnedGames` and `splitIntervalsByHour` helpers — pure carve-outs that test trivially.

## Two design decisions worth keeping in writing

### The DB's open-session row is the source of truth, not the prior player-state row

The natural state machine wants to compare *previous* player-state appid to *current* and emit an event when they differ. That works as long as the prior player-state row is in sync with the open-session row — which it isn't, after any crash or deploy that left an open session behind.

So `computeTransition` reads the open session from the DB instead. The previous player-state row only contributes the `endedAt` anchor (the last moment we observed the owner still in the game). An orphan session left behind from a pre-Chunk-3 deploy converges on the very next tick: the open row's appid doesn't match the prior state's appid, so the transition force-closes it with `endedAt = now`.

No boot reconciliation. No "drain orphans on startup" pass. The state machine just naturally absorbs the inconsistency.

This is one of those design moves that reads obvious in retrospect and is easy to get wrong on the first cut. The asymmetric trust ("previous player-state is hint; open session is truth") is the whole point.

### Write order is load-bearing

`recordTransition` runs *before* the player-state upsert ([player-state.service.ts:62-100](../../apps/api/src/steam/player-state.service.ts#L62-L100)):

```ts
await this.playSessions.recordTransition({
  previous: previousRow !== null
    ? { appid: previousRow.currentAppid, lastPolledAt: previousRow.lastPolledAt }
    : null,
  next: { appid: currentAppid, gameName: currentGameName },
});

await this.prisma.steamPlayerState.upsert({ /* writes lastPolledAt = new Date() */ });
```

Two reasons, and they're independent:

1. **Clock asymmetry.** The upsert writes `lastPolledAt = new Date()` from Node's clock. Session rows take `startedAt` from Postgres's `CURRENT_TIMESTAMP` default. If the upsert ran first, a single-tick session (open at T, close at T+2min) would record `endedAt < startedAt` by a few ms — the next tick's close uses this tick's just-written `lastPolledAt`, which precedes the session row's `startedAt`. Negative-duration sessions are a downstream landmine.
2. **Failure recovery.** If the transition write fails, the upsert doesn't run, so the next tick retries with the same prior state — natural retry. Reverse the order, and a failed transition write silently misses the session event (the upsert already advanced `lastPolledAt`, so the next tick sees no transition).

Both are subtle. Both are also the kind of detail that gets reordered in a "tidy-up" refactor unless they're commented. They are.

## Event-driven unlocks: 13.6k → ~950 calls/day

Pre-S6, unlocks ran on a 15-minute cron sweeping the entire library: `4 sweeps/hour × 24h × ~142 games-with-schema ≈ 13.6k calls/day`. Two-thirds of the Steam API budget on a single read path. Most sweeps returned zero new unlocks; the rest returned one or two.

S6 cut that to three layers:

| Layer | Cadence | Volume | Role |
| --- | --- | --- | --- |
| Session-close hook | event-driven | ~5–20 calls/day typical | Primary realtime signal — fires the moment the owner closes a game |
| Recently-played backstop | hourly | 24 + per-appid (≤10) calls/day | Offline-play coverage where `personastate` never flipped to in-game |
| Full library sweep | 4-hourly | ~852 calls/day (6 × ~142) | Defensive catch-all |

Total: ~950 calls/day. Same coverage, near-realtime detection on the happy path, ~14× drop in volume.

The session-close hook is fire-and-forget ([play-sessions.service.ts:152-156](../../apps/api/src/steam/play-sessions.service.ts#L152-L156)):

```ts
private fireUnlockRefresh(appid: number): void {
  this.playerUnlocks.refreshUnlocksForGame(appid).catch((err) => {
    this.logger.warn(`unlock refresh for closed session appid=${appid} failed: ${err}`);
  });
}
```

Decoupled from the player-state tick on purpose: a slow `GetPlayerAchievements` call or saturated Bottleneck reservoir mustn't delay the next 2-min tick or wedge the anti-overlap guard upstream. If a refresh drops on the floor, the 4-hour sweep and the hourly recently-played poller both reconcile.

The recently-played poller earns its keep on a specific case: the owner plays offline (Steam app in offline mode, or a network blip during the session) — `personastate` never flipped to in-game, so the transition layer saw nothing, so the unlock-refresh never fired. `GetRecentlyPlayedGames` reports `playtime_2weeks > 0` regardless of how the playtime accrued. One hourly call backfills the gap. The same poller also catches newly-owned games launched between daily owned-syncs and triggers a proactive `syncOwnedGames()` so the on-add hooks (enrichment, schema, unlocks, rarity) bootstrap immediately.

## What `SteamPlaySession` unlocks downstream

The session table is now the canonical Steam-side input for cross-stream surfaces. Without it:

- **LoL-vs-Steam evening split** ([apps/api/src/home/home-day-split.service.ts](../../apps/api/src/home/home-day-split.service.ts)) would need an entirely separate session-reconstruction pass. Now: stream both `Match` intervals (`playedAt`, `playedAt + durationSec`) and closed `SteamPlaySession` rows through one `splitIntervalsByHour(intervals, "Europe/Brussels")` and stack the bars.
- **Session-length histogram** ([apps/api/src/home/home-session-lengths.service.ts](../../apps/api/src/home/home-session-lengths.service.ts)) stitches LoL matches into sessions with a 30-min gap rule, but Steam sessions are already first-class rows — just `endedAt − startedAt`. The pre-S6 plan would have leaned on achievement-anchor heuristics for the Steam side; post-S6 it's a `findMany` with `endedAt IS NOT NULL`.

Forward-only is the right shape for both. The cross-stream surfaces don't promise "your entire historical timeline" — they read recent activity ("this week," "rolling 7 days," "evening split") where the poller's accumulated history is sufficient. Achievement-anchor reconstruction stays parked behind a "do we need historical depth here" gate that hasn't tripped yet.

## What didn't (surprises worth keeping)

### The 2-min cadence isn't free

720 calls/day on `GetPlayerSummaries` is cheap, but it's not zero. The Steam Web API key is a single shared budget across every endpoint the API hits (owned games, schemas, unlocks, rarity, recently-played, store browse, PICS — separately). The anti-overlap guard (`if (this.running) return`) on the poller is load-bearing: a slow tick on a saturated reservoir must not stack.

### Sub-minute play turns into a 1-tick session

A 90-second visit to "Wallpaper Engine" lands as a single open→close transition with `endedAt ≈ startedAt + 2 min`. Technically correct (we did observe in-game for one tick), arguably misleading (session lasted less than the tick). Filtered downstream when relevant (sessions under N minutes drop out of the session-length histogram).

### Closed-then-reopened-same-tick is unobservable

If the owner closes Game A and opens Game B within a single 2-min window, the next tick sees `prev=A`, `next=B`, and emits one `closeAndOpen`. The "few seconds of nothing" between them collapses. No way to detect it from a 2-min tick, no plan to care.

### `previousRow` snapshot must be captured before the upsert

The capture happens explicitly ([player-state.service.ts:56-59](../../apps/api/src/steam/player-state.service.ts#L56-L59)) rather than reading the row later in `recordTransition`. Looks like a redundant query — Prisma could find it again — but reading after the upsert returns the *new* row, breaking the transition logic. The early capture is the boundary that keeps "previous" actually previous.

### `gameid` is a string

Steam consistently strings 64-bit IDs (`steamid`, `gameid`) for JSON-safety. `appid` fits in int32, so we parse at the boundary and store as `Int` — but the parse has to happen, and forgetting it produces a column-type mismatch deep in Prisma.

## Open questions

**Multi-account.** The whole pipeline is hardcoded to `STEAM_OWNER_ID` (single account, intentional per the integration's account-model decision). Multi-account would need a queue or staggered polling — not a hard problem, but not one this design has solved.

**Offline+rebooted gap.** If the machine reboots mid-session, the open session's `endedAt` anchors to the pre-reboot `lastPolledAt`, which is correct. But if the owner reboots, plays the same game offline for an hour, then comes back online — that hour gets logged as "we don't know" (the recently-played backstop catches the unlocks but not the session). Acceptable trade.

**Backfill.** Same as the patch-notes pipeline: forward-only, history starts when the poller starts. Backfilling Steam sessions would require achievement-anchor reconstruction for the historical layer, which is the path that was parked. Will reopen if the cross-stream surfaces ever need year-deep depth.

## Why this earns its place in the portfolio

- **Polling-as-signal is a transferable architectural move.** "The cheapest endpoint is the most useful one" generalises to anywhere a vendor exposes liveness but not history — Slack presence, GitHub status, Twitch streams. The pattern of "poll a tiny endpoint, treat transitions as events, fire downstream work fire-and-forget" applies the same way.
- **Pure transition function + DB-as-truth is testable cleanly.** Eight unit tests on `computeTransition` cover the entire state machine. The integration test in `play-sessions.service.spec.ts` only has to validate "service applies the right action" — the action's correctness is settled in the pure function's tests.
- **Concrete before/after.** 13.6k → ~950 calls/day is a real number, and it's a real win — same coverage, faster detection, fewer dropped batches due to limiter saturation. The polling-cron is not free; the savings come from collapsing 4×/hour-full-library to event-driven.
- **The right kind of small surprise.** Two non-obvious choices (DB-as-truth, transition-before-upsert) drive most of the resilience. Both look like nothing in a code review and are load-bearing.

## Connections

- [Riot API rate limiting](./riot-rate-limits.md) — the LoL side of the rate-budget conversation. The Steam rate-limiter is intentionally the same shape (Bottleneck reservoir, named families per endpoint) so the patterns transfer between integrations.
- [Patch-notes pipeline](./patch-notes-pipeline.md) — the other "we built around a missing API" piece. There it's a missing structured feed (parsed from the wiki); here it's a missing session history (manufactured from polling).
- [Backfilling Riot history](./historical-backfill-and-sse.md) — the LoL parallel for forward-only-vs-historical trade-offs. Both pipelines start forward-only and gate backfill on whether a surface actually demands historical depth.
