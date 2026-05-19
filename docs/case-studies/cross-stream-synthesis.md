# Cross-stream synthesis on `/` — the self-portrait, not the feed

> The home page is where "the project is a self-portrait" stops being a tagline and becomes an architectural rule. Per-stream routes own their feeds; `/` owns content that *only exists* once the streams are combined. Five tiles, one timezone, one rule: if a tile reads as "this is my X stream's feed," it's wrong-place.

## TL;DR

- **The synthesis rule:** each stream owns its own route subtree (`/lol/...`, `/steam/...`); `/` is reserved for surfaces that combine streams into one verdict. A "latest commit," "top track," or "last match" tile on `/` is wrong-place — those belong on the per-stream routes.
- **Five synthesis tiles shipped.** Chronotype (hour-bucketing across LoL matches + Steam unlocks), weekly totals (rolling 7-day hours), first-played (newest in the rotation), day-split (LoL-vs-Steam evening hours), session-lengths (histogram across both streams).
- **One timezone (`Europe/Brussels`), one bucketing primitive (`Intl.DateTimeFormat`).** Every temporal tile shares the same hour-attribution path — DST transitions fall out for free, no offset tables.
- **Forward-only by design.** Tiles answer "this week," "recent," "rolling 7 days." None of them promise historical depth — that's per-route territory.
- **No tile takes a stream-specific argument.** The web hook ↔ server endpoint ↔ pure-function chain looks the same whether the stream is LoL, Steam, or (eventually) GitHub. New streams plug in by widening the query, not by rewriting the tile.

## The setup

The project aggregates two streams today (LoL + Steam) with more planned (`/code` for GitHub + WakaTime, `/music` for Spotify). The early build of `/` accumulated one tile per stream — "last LoL match," "currently playing on Steam," "wishlist count" — and read as a mixed-bag dashboard rather than a portrait. Every new integration would land another tile-per-stream and the home page would drown in feeds.

The reframe (sharpened 2026-05-16 in [self-portrait-surfaces.md § Routing principle](../working-notes/cross-cutting/self-portrait-surfaces.md#routing-principle-sharpened-2026-05-16)) is a single rule:

> Each stream owns its own route, not its own tile on `/`. The home page is for **cross-stream synthesis** — content that combines multiple streams into one verdict — not stream-deep feeds. A "latest commit" or "top track this week" tile on `/` is wrong-place: it belongs on `/code` or `/music`.

This is enforced in [`docs/repo-conventions.md`](../repo-conventions.md#per-stream-routes-is-synthesis-only) — committed, so every future scoping decision starts there. `/` may carry at most a *single curated highlight per stream* that links into the deep route (last match, now-playing chip); everything else must combine streams.

## The shape

```
   ┌───────────────────────────────────────────────────────────────────┐
   │                              /                                    │
   │                                                                   │
   │   tile-chronotype       tile-weekly-totals    tile-first-played   │
   │   (LoL + Steam,         (LoL hours +          (LoL champion       │
   │    hour buckets)         Steam hours,          first-played OR    │
   │                          rolling 7d)           Steam threshold,   │
   │                                                most recent)       │
   │                                                                   │
   │   tile-day-split        tile-session-lengths                      │
   │   (LoL + Steam,         (LoL + Steam,                             │
   │    24h stacked bars)     5-bucket histogram)                      │
   │                                                                   │
   └─────────────────────────────┬─────────────────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
       GET /home/<tile>                    apps/api/src/home/
       (5 endpoints, plain                home-<tile>.service.ts
        Nest controllers)                  ↓
                                         pure carve-out function
                                         (no Prisma, no clock)
                                          ↓
                                         Prisma reads:
                                          Match (LoL)
                                          SteamPlayerUnlock
                                          SteamPlaySession
                                          SteamPlaytimeSnapshot
```

Per-tile structure is identical: a TanStack Query hook (`use-home-<tile>.ts`), a render component (`tile-<tile>.tsx`), a Nest controller route (`@Get('<tile>')`), a service (`home-<tile>.service.ts`) with one pure exported function and one DB-fed orchestrator. Five tiles, no shared base class — the symmetry comes from the rule, not from inheritance.

## The five synthesis tiles

### Chronotype — hour-buckets across both streams

The canonical synthesis shape. Bucket the last 500 LoL match timestamps (`Match.playedAt`) and the last 500 Steam unlock timestamps (`SteamPlayerUnlock.unlockedAt`) into 24 hour-of-day slots in `Europe/Brussels`, sum per slot, render as a stacked bar chart with a Both / LoL / Steam segmented toggle ([apps/api/src/home/home-chronotype.service.ts:51-78](../../apps/api/src/home/home-chronotype.service.ts#L51-L78)).

```ts
const [matchRows, unlockRows] = await Promise.all([
  this.prisma.match.findMany({ where: { remake: false }, take: count,
    orderBy: { playedAt: "desc" }, select: { playedAt: true } }),
  this.prisma.steamPlayerUnlock.findMany({ take: count,
    orderBy: { unlockedAt: "desc" }, select: { unlockedAt: true } }),
]);
```

The per-stream toggle is the part that earns its place — `Both` is the synthesis verdict, `LoL`/`Steam` are diagnostic ("is the late-night peak driven by ranked queue or by Hades runs?"). The DTO carries `{ hour, total, lol, steam }` so the toggle is a render decision, not a refetch.

Empty-Steam falls out naturally: `steamDates.length === 0` → all zero counts on the Steam half → tile renders as LoL-only without any UI branching.

### Weekly totals — rolling 7-day hours, both streams

[`home-weekly-totals.service.ts`](../../apps/api/src/home/home-weekly-totals.service.ts). Rolling 7-day window anchored on `now()`, not a calendar week — avoids the Monday-morning-empty cliff. LoL hours: sum `Match.durationSec` where `playedAt >= weekStart`. Steam hours: per-appid delta of `playtimeForeverMinutes` between the latest snapshot and the latest snapshot at-or-before `weekStart`.

The Steam side is interesting because Steam doesn't give us a "minutes played this week" endpoint. The owned-games snapshotter writes one row per appid per day; the weekly delta is reconstructed from the daily series. Two discipline rules in `diffPlaytimeMinutes` ([home-weekly-totals.service.ts:20-48](../../apps/api/src/home/home-weekly-totals.service.ts#L20-L48)):

```ts
for (const [appid, latest] of latestByAppid) {
  const baseline = baselineByAppid.get(appid);
  if (!baseline) continue;                          // ← (1) appids without a
  const delta = latest.playtimeForeverMinutes       //     pre-window baseline
              - baseline.playtimeForeverMinutes;    //     are excluded; the
  if (delta > 0) total += delta;                    //     true within-window
}                                                   //     playtime is unknown
                                                    // ← (2) negative deltas
                                                    //     clamp to 0 (defends
                                                    //     against family-share
                                                    //     and refund anomalies)
```

If a game appears in the snapshot table for the first time *inside* the week's window, we don't know how much of its `playtime_forever` accrued during the week vs. before tracking started. Excluding it is the only honest answer.

Headline metric is total hours; breakdown beneath is `LoL · N matches · Xh Ym` / `Steam · Zh Wm`. No verdict copy — the numbers are the verdict.

### First-played — newest in the rotation

The only single-event synthesis tile. Picks the most recent of:
- **LoL:** earliest non-remake match on a previously-unplayed champion within the last 30 days ([home-first-played.service.ts:46-92](../../apps/api/src/home/home-first-played.service.ts#L46-L92)).
- **Steam:** first snapshot where `playtimeForeverMinutes >= 30` *after* an earlier snapshot was `< 30` (true threshold-crossing observed, not just "first snapshot above the threshold").

The Steam side carries the same discipline as weekly totals: an appid whose first observed snapshot was already ≥ 30 min is excluded. The lower bound predates our tracking; declaring it "first played" would be a lie.

Copy: "Newest in the rotation: {name} — {time-ago}, {sample-so-far}." Not a list, not a feed — a single highlight that *requires* both streams to be considered to pick the right answer. If we cherry-picked LoL only, a recent Steam discovery would be hidden; cherry-picking Steam would hide a new ranked champion pick.

### Day-split — LoL-vs-Steam evening hours

[`home-day-split.service.ts`](../../apps/api/src/home/home-day-split.service.ts). 24 stacked bars showing minutes-by-hour-of-day split by stream. LoL from `Match.playedAt` + `durationSec`; Steam from closed `SteamPlaySession` rows (the forward-only sessions [derived from poller transitions](./steam-presence-as-signal.md)).

The pure carve-out — `splitIntervalsByHour(intervals, timeZone)` ([day-split.service.ts:26-50](../../apps/api/src/home/home-day-split.service.ts#L26-L50)) — does the DST work:

```ts
for (let i = 0; i < totalMinutes; i++) {
  const sampleMs = startMs + i * MINUTE_MS;
  const hour = Number.parseInt(fmt.format(new Date(sampleMs)), 10);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
  buckets[hour] = (buckets[hour] ?? 0) + 1;
}
```

A per-minute walk through each interval, formatting the wall-clock hour via the same `Intl.DateTimeFormat` instance used by every other tile. DST transitions handle themselves: a session running through the spring-forward jump skips the vanished hour because no sample minute maps to it; a session through fall-back logs the doubled hour twice because two real wall-clock hours have the same local label. Both behaviours are *correct* — the owner did experience the time that way.

The hand-rolled alternative would be per-month DST offset tables. The `Intl` walk is more expensive per interval (one format call per minute) but the cost is bounded — sessions are at most a few hours — and the correctness is free.

### Session-lengths — bursts vs sits histogram

[`home-session-lengths.service.ts`](../../apps/api/src/home/home-session-lengths.service.ts). Five fixed buckets (`<30m`, `30m–1h`, `1h–2h`, `2h–4h`, `4h+`) stacked LoL + Steam.

The asymmetric part: LoL sessions don't exist as rows. They're stitched from `Match` rows with a 30-minute gap rule ([session-lengths.service.ts:50-90](../../apps/api/src/home/home-session-lengths.service.ts#L50-L90)):

```ts
for (const m of rest) {
  const gap = m.playedAt.getTime() - currentEnd.getTime();
  if (gap <= gapMs) {
    currentEnd = new Date(m.playedAt.getTime() + m.durationSec * 1000);
    currentDurationSec += m.durationSec;
  } else {
    sessions.push({ startedAt: currentStart, endedAt: currentEnd,
                    durationMinutes: Math.round(currentDurationSec / 60) });
    /* start next session */
  }
}
```

Steam sessions are already first-class rows from the [presence-as-signal](./steam-presence-as-signal.md) poller — `endedAt - startedAt`. The two pre-processed lengths flow into one histogram via `histogramSessionLengths(lolMinutes, steamMinutes)`.

Length is sum of `durationSec`, not wall-clock span — queue time / champ select / client transitions between matches aren't "playing." The 30-min gap is the only configurable; it survived a quick sensitivity check (15 min was too aggressive, 60 min stitched obvious breaks into one block).

## Three patterns the tiles share

### One timezone, one bucketing primitive

Every temporal tile uses the same `Intl.DateTimeFormat(..., { hour: "2-digit", hourCycle: "h23", timeZone })` instance. Chronotype buckets by hour, day-split walks per-minute through intervals, session-lengths doesn't bucket by time at all. But none of them touch `Date.getHours()` (which returns server-local hours — wrong on any host that isn't Brussels), and none compute UTC offsets by hand.

The owner's timezone is stamped in [`docs/repo-conventions.md`](../repo-conventions.md#owner-timezone-brussels) — `Europe/Brussels`, not Berlin or UTC. Code references the constant; the format object handles DST. Adding a new temporal tile is one import + one format call; getting it right is the default path.

### Pure carve-outs for everything non-trivial

The pattern is consistent across the five services:

```
home-<tile>.service.ts
  ├─ export function <pureCarveOut>(...): <output>
  │     // no Prisma, no clock injection, no NestJS
  │     // exhaustively tested in home-<tile>.service.spec.ts
  └─ @Injectable() class Home<Tile>Service
        async get<Tile>(): Promise<...> {
          const rows = await this.prisma.<table>.findMany(...);
          return shapeDtoFor(<pureCarveOut>(rows, ...));
        }
```

`bucketDates`, `mergePerStream` (chronotype). `diffPlaytimeMinutes` (weekly totals). `detectFirstLolChampion`, `detectFirstSteamCrossing` (first-played). `splitIntervalsByHour` (day-split). `stitchLolSessions`, `histogramSessionLengths` (session-lengths). All exported, all tested at the function level.

The integration test on each service then only has to prove "wires Prisma rows into the carve-out and shapes the DTO." Same shape as `diffOwnedGames` (Steam owned-games) and `computeTransition` (Steam play-sessions) — once you see the pattern, every new service slots into it.

### No tile takes a stream argument

A new stream — GitHub commit timestamps for `/code`, Spotify play timestamps for `/music` — plugs into chronotype by widening the Prisma query and growing the DTO with a third field:

```ts
hours: [{ hour, total, lol, steam, github }]  // future shape
```

The render layer adds a segment to the toggle; the bucketing primitive doesn't change. The architectural test for "is this tile cross-stream-ready" is: *does adding a new stream require touching anything other than (a) the query, (b) the DTO, (c) the toggle?* For all five tiles, the answer is no.

This is the load-bearing claim of the synthesis-rule reframe. If the abstraction lets every new stream join in O(1) tile change, the rule pays for itself. If it didn't — if adding GitHub required rewriting chronotype's internals — the per-stream-feed-on-`/` approach would be cheaper.

## What didn't (surprises worth keeping)

### "Synthesis" only works if at least two streams have data

Empty-Steam is the realistic empty state — a fresh deploy has zero `SteamPlayerUnlock` rows until the first poller tick lands an unlock. The tiles all degrade gracefully (chronotype renders LoL-only, weekly totals reads "Xh Ym · 0 Steam minutes," first-played falls back to the LoL branch, etc.) but a few of them lose their *cross-stream framing* in that state — chronotype-with-only-LoL is just the same panel as `/lol/$accountSlug/recap`'s LoL-chronotype panel.

This is acceptable, not a defect: each tile is correct in the degraded state, and the cross-stream framing returns the moment Steam data exists. But "synthesis on a single stream is just a feed" is a real risk for any future tile, and the architectural defence is "always wire at least two streams *as data*, even if one is empty initially" — never ship a synthesis tile that pulls from one stream and is *labelled* synthesis on a roadmap promise.

### `endedAt: { not: null }` filters out open sessions, which is the right behaviour but counter-intuitive

Day-split and session-lengths both filter `SteamPlaySession` by `endedAt: { not: null }` ([day-split.service.ts:71](../../apps/api/src/home/home-day-split.service.ts#L71)). The currently-open session — the owner is mid-game right now — is excluded from the histogram. The right call: a session with `endedAt: null` has no duration yet, and counting it would either require a `endedAt ?? now()` fallback (inconsistent with how closed sessions were anchored) or a special bucket.

Worth noting because the tile reads "current as of now" but is actually "current as of the most recent session-close transition." A 3-hour Helldivers run in progress shows up as nothing until the owner closes the game. Trade-off accepted; the [presence-as-signal](./steam-presence-as-signal.md) poller's 2-minute tick keeps the gap short.

### Tile composition is by render hook, not by data join

No tile fetches a joined-across-streams DTO from the server. Each tile owns its own endpoint, fetches its own DTO, and the synthesis happens *inside* the tile's service (LoL + Steam queries fired in parallel via `Promise.all`, merged in JS).

This is the right call given two-stream cardinality, but it scales O(streams) at the service level. If a third stream lands and a fourth, the pattern is still fine — the queries parallelise and the merge is per-tile-bounded — but it would not survive ten streams. The alternative (a generic "events with timestamp + kind + amount" union table) was considered and rejected: the streams' data shapes diverge enough (matches have winners, snapshots have cumulative playtime, unlocks have rarity) that the union would lose information for any per-stream drill-down.

### `Match.remake` filtering shows up in every LoL-side query

Every cross-stream tile that touches LoL filters `remake: false`. The constraint is enforced as a domain invariant in [`docs/repo-conventions.md`](../repo-conventions.md#centralise-domain-invariants-that-must-apply-to-every-aggregation-in-a-feature) — "all LoL stat computations filter remakes" — and there's a shared `excludeRemakes()` helper in `@vyoh/shared`. The home-tile services use the Prisma `where` clause directly because they're query-shaping, not array-filtering, but the rule is the same: a new LoL-touching home tile that forgot the filter would be quietly wrong.

## Open questions

**When does `/` get an opinion?** All five tiles read as facts ("you played Xh," "your peak hour is 8pm"). Verdicts — "you grind in bursts, not marathons" — are reserved for `ConclusionCard` surfaces deeper inside each route. The home page could plausibly get *one* verdict-style synthesis card ("this week was a Steam-heavy week") but it hasn't, deliberately. The risk is the page turning into a daily horoscope; the upside is the rule "if you can't say it in numbers, it doesn't belong on `/`" stays sharp.

**Multi-account.** All five tiles read the *single* owner's LoL accounts (multi-account routing is per-`/lol/$accountSlug`; the home tiles aggregate across accounts). For the portfolio framing this is correct — the page is "me," not "an account" — but the math (first-played champion's `puuid` → which account slug to link) gets non-trivial if the synthesis surfaces ever expand into per-account splits.

**Cold-start framing.** A brand-new instance of the project has no LoL matches and no Steam unlocks. Every tile renders an empty/loading state. The home page reads as "this thing has nothing to say yet" rather than as a portrait. Not solved; not really a problem either — the portfolio framing is "the project exists because there's data to portray." A demo deployment would either seed data or accept the empty-state framing.

## Why this earns its place in the portfolio

- **The architectural decision *is* the case study.** The interesting work isn't any one tile's implementation — it's the rule that put them all on the same page. "What goes on `/`" is one of the questions every multi-integration product eventually has to answer; this is one answer with the receipts to back it up.
- **Symmetry without inheritance.** Five tiles share the same shape (hook → endpoint → service → carve-out → DTO) without a shared base class, mixin, or framework. The symmetry comes from the rule + the pure-function pattern. Easier to extend, easier to delete one of without touching the others.
- **DST and timezone correctness fall out of the substrate.** Every temporal tile uses `Intl.DateTimeFormat` + `Europe/Brussels`. No per-tile DST handling, no UTC-offset arithmetic. A new tile gets DST correctness as a side effect of the pattern.
- **The rule is committed, not memorised.** [`docs/repo-conventions.md`](../repo-conventions.md#per-stream-routes-is-synthesis-only) carries the synthesis rule as a portable convention. Future scoping decisions ("should the Spotify integration's now-playing tile go on `/`?") start by reading the rule, not by guessing.

## Connections

- [Steam presence as signal](./steam-presence-as-signal.md) — supplies the `SteamPlaySession` rows that day-split and session-lengths consume. Without the poller's session reconstruction, both tiles would need achievement-anchor heuristics for the Steam side.
- [Conclusion card pattern](./conclusion-card-pattern.md) — the verdict-shape that *isn't* used on `/` by design. Cross-stream synthesis tiles render facts; verdicts live on per-stream routes where the context is rich enough to be opinionated.
- [LP history without a time-series DB](./lp-history-postgres.md) — the same "Postgres + careful query shaping replaces an entire category of database" thread. Cross-stream synthesis uses Postgres aggregations across two-stream tables where a generic events table would have been the cargo-cult choice.
- [Patch-notes pipeline](./patch-notes-pipeline.md) — the other "forward-only, integrate-when-the-time-axis-aligns" piece. Both rely on starting tracking now and committing to "the historical layer is per-stream-deep, not on `/`."
