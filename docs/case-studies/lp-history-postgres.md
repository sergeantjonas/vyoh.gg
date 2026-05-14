# An LP-history chart without a time-series database

## TL;DR

Tracking ranked LP over time is the textbook prompt for a time-series database — irregularly sampled numeric points, a tier-aware Y axis, patch boundaries to overlay, brush-to-zoom on the X axis. The textbook answer is wrong here. The dataset is tiny (a single ranked queue produces a few hundred rows per season, per account), it shares a transactional boundary with the rest of the app, and the interesting engineering is not in storage — it is in two boundary decisions: a *snapshot-on-change* ingest contract that keeps the row count proportional to LP volatility rather than poll frequency, and a *visual-only X-axis compression* that keeps the line continuous across overnight gaps without lying about wall-clock time anywhere the user can read it. One Prisma model, one compound index, one chart component, no extra infrastructure.

## Setup

Riot's `/lol/league/v4/entries/by-puuid/{puuid}` returns the player's current ranked entry — tier, division, LP, wins, losses. Nothing in the API exposes history. To draw an LP-over-time line, the app has to poll, store, and reconstruct it.

The naive shapes both fail:

- **Poll every minute, store every row.** A season of polling at one-minute resolution produces ~130 000 rows per account per queue. The chart cares about state transitions, not poll cadence — 99% of those rows are duplicates of the previous tick.
- **Reach for a time-series database.** TimescaleDB or Influx would index the dataset beautifully, but the project already runs Postgres for everything else (matches, accounts, champion data). Adding a second store to hold a few hundred rows per account would be a tonal mismatch — operational surface area trading against a problem the existing store handles fine.

The shape that survives both objections is *snapshot-on-change* against the existing Postgres instance: poll on whatever cadence the rate limiter allows, write a row only when the tier/division/LP triple has actually moved.

## Snapshot-on-change ingest

The model is intentionally small:

```prisma
model RankSnapshot {
  id            String   @id @default(cuid())
  puuid         String
  queueId       Int
  tier          String
  rank          String
  leaguePoints  Int
  wins          Int?
  losses        Int?
  hotStreak     Boolean?
  capturedAt    DateTime @default(now())

  @@index([puuid, queueId, capturedAt])
}
```

The compound index `(puuid, queueId, capturedAt)` is the only access path the chart needs — fetch a window of one player's one queue, ordered chronologically. No second index, no foreign key into accounts (the `puuid` is the natural join key), no `@unique` over the snapshot triple (duplicate prevention happens at write time, not at the database).

The write path is a single equality check against the most recent row:

```ts
const latest = await this.prisma.rankSnapshot.findFirst({
  where: { puuid, queueId },
  orderBy: { capturedAt: "desc" },
});

const changed =
  !latest ||
  latest.tier !== entry.tier ||
  latest.rank !== entry.rank ||
  latest.leaguePoints !== entry.leaguePoints;

if (changed) {
  await this.prisma.rankSnapshot.create({
    data: {
      puuid,
      queueId,
      tier: entry.tier,
      rank: entry.rank,
      leaguePoints: entry.leaguePoints,
      wins: entry.wins,
      losses: entry.losses,
      hotStreak: entry.hotStreak,
    },
  });
}
```

Two things worth saying about this contract:

- **The triple is `(tier, rank, leaguePoints)`, not just `leaguePoints`.** A promo-series win that flips IV → III at 0 LP must record as a change even though `leaguePoints` is unchanged from a "rounded down to 0" perspective. Including tier and division catches that without special-casing promotions.
- **`wins`, `losses`, and `hotStreak` ride along for free but don't drive change detection.** Their values can fluctuate inside the same tier/rank/LP triple (a win that goes 18→0 LP with division promotion, for example), and binding them into the change-detection key would inflate the row count. They are denormalized into snapshots opportunistically rather than maintained as their own series.

For an active player who plays a dozen games on a Saturday, this writes ~12 rows for the day. For an idle player, it writes 0. The row count is proportional to volatility, which is exactly the shape a "history" chart wants — every row is a frame the user might care about, with no fill.

## Tier-normalized LP as a transport detail

The chart's Y axis can't plot `leaguePoints` directly: SILVER IV at 75 LP and GOLD I at 75 LP are different absolute positions, and a player who goes SILVER I 100 → GOLD IV 0 should see the line continue upward, not jump back to zero.

The normalization is shared between the API and the web app, so it lives in `packages/shared`:

```ts
const TIER_INDEX: Record<string, number> = {
  IRON: 0, BRONZE: 1, SILVER: 2, GOLD: 3,
  PLATINUM: 4, EMERALD: 5, DIAMOND: 6,
  MASTER: 7, GRANDMASTER: 7, CHALLENGER: 7,
};

const RANK_OFFSET: Record<string, number> = {
  IV: 0, III: 100, II: 200, I: 300,
};

export function normalizeLp(tier: string, rank: string, leaguePoints: number): number {
  const tierIdx = TIER_INDEX[tier] ?? 0;
  if (tierIdx >= TIER_INDEX.MASTER) return TIER_INDEX.MASTER * 400 + leaguePoints;
  return tierIdx * 400 + (RANK_OFFSET[rank] ?? 0) + leaguePoints;
}
```

The collapse of MASTER/GRANDMASTER/CHALLENGER to a single index is intentional — above MASTER, division doesn't exist and LP is unbounded. The function returns a single monotonic number anywhere below MASTER and a continuous extension above it.

Two boundary decisions are buried in this 15-line file:

- **It lives in `@vyoh/shared`, not the API.** The web app needs `normalizeLp` to compute Y values, the API needs it for season detection (`SEASON_LP_DROP_MIN = 400` — one tier — is the threshold). Putting it in the API would force a round-trip just to compute a number both sides already know how to compute.
- **Subpath export, not barrel.** `packages/shared/package.json` exposes it as `"./lol/rank-history": "./src/lol/rank-history.ts"` rather than re-exporting through a single index. Barrels in this repo broke with `ERR_MODULE_NOT_FOUND` during NestJS startup when value re-exports interacted badly with TypeScript's `export {}` form under Node ESM resolution; subpath exports sidestep the diagnostic entirely.

The API's `getRankHistory` returns un-normalized snapshots — `{ tier, rank, leaguePoints, capturedAt }`. The web app normalizes on the way into the chart. The transport stays human-readable; the math stays close to the renderer.

## Visual-gap compression — the most interesting bit

The chart has a structural problem the storage layer can't fix: snapshots are written only when LP changes, so a player who doesn't play from Monday night to Friday morning produces zero rows for those three days. Recharts will happily interpolate a straight line across that gap on a wall-clock X axis, which makes the chart say "the player slowly bled LP for 72 hours" when the truth is "the player wasn't playing."

The fix is to keep the line continuous (no broken segments) while *visually* collapsing oversized gaps. Each chart point carries two timestamps — a real one for the tooltip, a compressed one for the X axis:

```ts
const MAX_VISUAL_GAP_MS = 60 * 60 * 1000;

function toChartPoints(points: RankHistoryPoint[]): ChartPoint[] {
  const out: ChartPoint[] = [];
  let visualT = 0;
  let prevRealT = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const realT = new Date(p.capturedAt).getTime();
    if (i === 0) {
      visualT = realT;
    } else {
      visualT += Math.min(realT - prevRealT, MAX_VISUAL_GAP_MS);
    }
    prevRealT = realT;
    out.push({
      ...p,
      t: visualT,
      realT,
      totalLp: normalizeLp(p.tier, p.rank, p.leaguePoints),
    });
  }
  return out;
}
```

`t` is what Recharts plots on the X axis. `realT` is what the tooltip and the date-tick formatter read. The cap is one hour: within-session game-to-game spacing (~25–30 minutes) is preserved untouched, an overnight gap becomes a single visible step roughly twice a normal between-game width, a week-long absence becomes the same single step. The line stays continuous, the visual rhythm of "games" survives, and the X-axis ticks (driven by `realT` formatting) still read as actual calendar days.

This is the lying-vs-displaying boundary the chart has to negotiate. Anywhere a number reaches the user — tooltip, axis label, copy text — it carries `realT`. Anywhere a number positions geometry on a canvas, it carries `t`. The two streams never mix.

## Overlays that live in real time

Patch boundaries are sourced from match data, not rank snapshots, so they arrive in wall-clock time. To draw a vertical line at "patch 14.10 started here," they must be mapped onto the compressed axis:

```ts
function mapRealToVisual(realT: number, points: ChartPoint[]): number {
  if (points.length === 0) return realT;
  const first = points[0];
  if (first && realT <= first.realT) return first.t;
  for (let i = 1; i < points.length; i++) {
    const curr = points[i];
    const prev = points[i - 1];
    if (curr.realT >= realT) {
      const span = curr.realT - prev.realT;
      const frac = span > 0 ? (realT - prev.realT) / span : 0;
      return prev.t + frac * (curr.t - prev.t);
    }
  }
  return points[points.length - 1].t;
}
```

Linear interpolation between the two bracketing chart points. The boundary "snaps" naturally to wherever the visual axis was when that real instant happened — which, for a boundary that landed mid-absence, is somewhere inside the collapsed overnight step rather than spilling into empty visual space.

The Recharts `ReferenceLine`s for those boundaries pass `ifOverflow="hidden"` so a boundary that falls outside the brush window is clipped silently rather than clamped to the edge of the visible domain.

## Brush, Y-axis fit, derived overlays

The brush is a visx `<Brush>` mounted inside the same SVG as the Recharts chart. The two pieces don't natively cooperate, but they don't need to — visx owns the selection rectangle, React owns `brushDomain`, Recharts reads it via `XAxis domain={xDomain}`:

```ts
const xDomain = useMemo<[number | "dataMin", number | "dataMax"]>(() => {
  if (brushDomain) return brushDomain;
  return ["dataMin", "dataMax"];
}, [brushDomain]);

const yDomain = useMemo<[number | "auto", number | "auto"]>(() => {
  const pool = visiblePoints.length > 0 ? visiblePoints : points;
  let min = pool[0]?.totalLp ?? 0;
  let max = min;
  for (const p of pool) {
    if (p.totalLp < min) min = p.totalLp;
    if (p.totalLp > max) max = p.totalLp;
  }
  const padding = Math.max(20, Math.round((max - min) * 0.1));
  return [Math.max(0, min - padding), max + padding];
}, [visiblePoints, points]);
```

A narrow brush window doesn't just zoom horizontally — it also re-fits the Y axis to the LP range of the selected window. This matters in practice: zooming into a "lost 40 LP" stretch on a chart whose Y range covers 800 LP of season-wide variation makes the dip invisible. Re-fitting Y is what makes the brush actually useful for inspecting local detail.

One state-management seam worth naming: clearing `brushDomain` doesn't clear the visual selection rectangle visx draws — `<Brush>` owns that internally and there's no React-side handle to reset it. A `brushKey` counter, bumped whenever the rectangle needs to clear, force-remounts the component. The same effect is wired to range/queue changes, because a brush window selected over the 90-day view points at timestamps that won't exist in the 30-day view.

Derived overlays — longest win/loss streak, tier-change dots, day ticks — all read from `visiblePoints` (post-brush) rather than the full dataset, so they describe what's currently on the screen rather than what could be on the screen.

## What this earns

The chart is engaging to interact with and the storage path is unremarkable, which is the right asymmetry. Three lines of value:

- **One database, one model.** No second store, no replication concern, no operational surface for a few hundred rows per account. The compound index handles every read pattern the chart needs.
- **A visual axis that never lies.** The compression is in geometry only; every number the user reads is wall-clock. Tooltip, axis label, and overlay copy all agree about what time it is.
- **Derived overlays compose for free.** Streaks, tier changes, patch boundaries, and Y-fit all read from the same post-brush slice. Adding a new overlay is a new `useMemo` over `visiblePoints`, not a new transport.

What it doesn't earn: a real time-series query language, multi-account aggregates ("average LP across my smurfs"), or downsampling for years-of-history views. Those are real features for a future shape of the dataset — they are not features this shape needs.

## Looking back

The instinct on first encountering "rank over time" was to reach for a time-series database. What the problem actually needed was two boundary decisions inside the existing tools: write only on change, and let the X axis carry two parallel timestamps. The unit of skill here isn't picking the right tool — it's noticing when the textbook tool would be load-bearing for a problem you don't have.
