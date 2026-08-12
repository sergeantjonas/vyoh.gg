// Reads `SteamAchievementRarityHistory` and reports, per achievement, the span
// it has been watched, its endpoints, and its slope. This is the gate on the
// drift beat: that surface gets built when this probe names a game whose rarity
// visibly moves in the rare band, and not before — twelve flat lines rendered
// as a curve read as a bug, not as a story.
//
// Coverage leads the report on purpose. A series needs two observations before
// it can show movement at all, so a table full of single-point series produces
// the same silence as a library that genuinely does not drift, and the two mean
// opposite things. The rarity poller fires at 05:30 Europe/Brussels against a
// seven-day age and the api only runs on the owner's dev box, so a stretch of
// downtime shows up here as stale games rather than as a flat market.
//
// Constructs `PrismaService` directly instead of booting `AppModule`. That is
// not a shortcut — an application context runs every `onModuleInit`, which
// includes the rarity poller's own boot drain, so a read-only probe would race
// and mutate the very table it is measuring, and would spend the Riot budget
// on live-game polls nobody asked for.
//
// Thresholds are flags because the gate is a judgement call that should be
// argued from output. Steam reports one decimal, so a ±0.1pp move is a single
// quantum and cannot be told apart from rounding at the boundary; `--visible-pp`
// is the size at which a move stops being precision noise. `--visible-ratio`
// sits beside it because the framing this arc reserved itself for is relative:
// 0.3% → 1.9% is a story at 1.6pp because it is also 6.3x.
//
// Reads only. Build first (nest build), then:
//   node dist/src/scripts/probe-rarity-drift.js
//   node dist/src/scripts/probe-rarity-drift.js --rare-band 5 --visible-pp 0.3

import "dotenv/config";
import { PrismaService } from "../prisma/prisma.service";
import { RARITY_MAX_AGE_MS } from "../steam/global-rarity.poller";

export type Thresholds = {
  rareBand: number;
  visiblePp: number;
  visibleRatio: number;
  launchWindowDays: number;
};

// A game's rarity percentages are still finding their level in the days after
// release, as the owned-but-unplayed population works through content nobody
// has reached yet. That curve is an order of magnitude steeper than anything a
// settled title does, so mixing the two produces a verdict that reads as "drift
// is visible" when it means "one game launched last week".
export type Cohort = "launch" | "mature" | "unknown";

export type Observation = {
  appid: number;
  apiName: string;
  percent: number;
  observedAt: Date;
};

export type Series = {
  appid: number;
  apiName: string;
  points: number;
  firstAt: Date;
  lastAt: Date;
  firstPct: number;
  lastPct: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const spanDays = (s: Series): number =>
  (s.lastAt.getTime() - s.firstAt.getTime()) / DAY_MS;

export const delta = (s: Series): number => s.lastPct - s.firstPct;

// Steam's floor is a literal 0, which is a bound rather than a measurement, so
// a series rising off it has no meaningful ratio to report.
export const ratio = (s: Series): number | null =>
  s.firstPct <= 0 ? null : s.lastPct / s.firstPct;

export const perWeek = (s: Series): number => {
  const span = spanDays(s);
  return span <= 0 ? 0 : (delta(s) / span) * 7;
};

export const isVisible = (s: Series, t: Thresholds): boolean => {
  const r = ratio(s);
  return Math.abs(delta(s)) >= t.visiblePp || (r !== null && r >= t.visibleRatio);
};

export const ageDays = (release: Date | null, asOf: Date): number | null =>
  release === null ? null : (asOf.getTime() - release.getTime()) / DAY_MS;

// Unknown age is its own cohort rather than being folded into `mature`. Folding
// it in would let an unenriched new release sit inside the population whose
// whole job is to answer "does a settled game drift", which is the one place a
// wrong answer changes the verdict.
export const cohortOf = (age: number | null, launchWindowDays: number): Cohort => {
  if (age === null) return "unknown";
  return age <= launchWindowDays ? "launch" : "mature";
};

// Folds time-ordered observations into one row per achievement. Callers must
// pass rows already sorted by `observedAt` ascending — the fold takes the first
// row it sees as the series origin and lets every later one overwrite the tail,
// so an unsorted input silently reports the wrong endpoints.
export function foldSeries(rows: readonly Observation[]): Series[] {
  const byKey = new Map<string, Series>();
  for (const row of rows) {
    const key = `${row.appid}:${row.apiName}`;
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, {
        appid: row.appid,
        apiName: row.apiName,
        points: 1,
        firstAt: row.observedAt,
        lastAt: row.observedAt,
        firstPct: row.percent,
        lastPct: row.percent,
      });
      continue;
    }
    existing.points += 1;
    existing.lastAt = row.observedAt;
    existing.lastPct = row.percent;
  }
  return [...byKey.values()];
}

function numericFlag(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const parsed = Number(process.argv[index + 1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const pp = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}pp`;
const pct = (value: number) => `${value.toFixed(1)}%`;
const day = (date: Date) => date.toISOString().slice(0, 10);

async function main() {
  const thresholds: Thresholds = {
    // "Rare" as the trophy case means it — the band the drift beat would live in.
    rareBand: numericFlag("rare-band", 10),
    // One decimal is Steam's precision, so 0.1pp is a single quantum.
    visiblePp: numericFlag("visible-pp", 0.5),
    visibleRatio: numericFlag("visible-ratio", 2),
    launchWindowDays: numericFlag("launch-window", 60),
  };
  const top = numericFlag("top", 15);

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const [history, games, achievements, unlocks, meta, enrichment] = await Promise.all([
      prisma.steamAchievementRarityHistory.findMany({
        orderBy: { observedAt: "asc" },
        select: { appid: true, apiName: true, percent: true, observedAt: true },
      }),
      prisma.steamOwnedGame.findMany({ select: { appid: true, name: true } }),
      prisma.steamGameAchievement.findMany({
        select: { appid: true, apiName: true, displayName: true },
      }),
      prisma.steamPlayerUnlock.findMany({ select: { appid: true, apiName: true } }),
      prisma.steamGameAchievementMeta.findMany({
        where: { game: { removedAt: null }, achievementCount: { gt: 0 } },
        select: { appid: true, lastRarityCheckedAt: true },
      }),
      prisma.steamGameEnrichment.findMany({
        select: { appid: true, releaseDate: true },
      }),
    ]);

    const gameName = new Map(games.map((g) => [g.appid, g.name]));
    const released = new Map(enrichment.map((e) => [e.appid, e.releaseDate]));
    const now = new Date();
    const cohort = (s: Series): Cohort =>
      cohortOf(ageDays(released.get(s.appid) ?? null, now), thresholds.launchWindowDays);
    const key = (appid: number, apiName: string) => `${appid}:${apiName}`;
    const label = new Map(
      achievements.map((a) => [key(a.appid, a.apiName), a.displayName])
    );
    const unlocked = new Set(unlocks.map((u) => key(u.appid, u.apiName)));

    const describe = (s: Series): string => {
      const r = ratio(s);
      const relative = r === null ? "from the floor" : `${r.toFixed(2)}x`;
      const name = gameName.get(s.appid) ?? `app ${s.appid}`;
      return (
        `  ${pp(delta(s)).padStart(8)}  ${relative.padStart(14)}  ` +
        `${pct(s.firstPct).padStart(6)} → ${pct(s.lastPct).padEnd(6)} ` +
        `${String(Math.round(spanDays(s))).padStart(3)}d ${String(s.points).padStart(2)}pts  ` +
        `${unlocked.has(key(s.appid, s.apiName)) ? "★" : " "} ` +
        `${name} — ${label.get(key(s.appid, s.apiName)) ?? s.apiName}`
      );
    };

    const all = foldSeries(history);
    const moving = all.filter((s) => s.points >= 2);

    console.log("\n=== Coverage ===\n");
    console.log(
      `  ${all.length} series across ${new Set(all.map((s) => s.appid)).size} games`
    );
    console.log(`  ${moving.length} have a second observation and can show movement`);
    console.log(`  ${all.length - moving.length} are a single point — silent, not flat`);

    const observedDays = [...new Set(history.map((r) => day(r.observedAt)))].sort();
    console.log(
      `  observations land on ${observedDays.length} days: ${observedDays.join(", ")}`
    );

    const dueBefore = new Date(Date.now() - RARITY_MAX_AGE_MS);
    const due = meta.filter(
      (m) => m.lastRarityCheckedAt === null || m.lastRarityCheckedAt < dueBefore
    );
    console.log(
      `\n  ${due.length} of ${meta.length} games are past the ${Math.round(RARITY_MAX_AGE_MS / DAY_MS)}-day refresh age`
    );
    for (const m of due
      .sort(
        (a, b) =>
          (a.lastRarityCheckedAt?.getTime() ?? 0) -
          (b.lastRarityCheckedAt?.getTime() ?? 0)
      )
      .slice(0, top)) {
      const last = m.lastRarityCheckedAt;
      const age =
        last === null
          ? "never"
          : `${Math.floor((Date.now() - last.getTime()) / DAY_MS)}d`;
      console.log(
        `    ${age.padStart(6)} ago  ${gameName.get(m.appid) ?? `app ${m.appid}`}`
      );
    }

    // Naming the next one to come due is what makes the report actionable: the
    // drain is boot-triggered in practice, so "restart after X" is the whole
    // instruction, and restarting before it changes nothing.
    const notYetDue = meta
      .filter((m) => m.lastRarityCheckedAt !== null && m.lastRarityCheckedAt >= dueBefore)
      .sort(
        (a, b) =>
          (a.lastRarityCheckedAt?.getTime() ?? 0) -
          (b.lastRarityCheckedAt?.getTime() ?? 0)
      )[0];
    if (notYetDue?.lastRarityCheckedAt != null) {
      const at = new Date(notYetDue.lastRarityCheckedAt.getTime() + RARITY_MAX_AGE_MS);
      console.log(
        `\n  next to come due: ${gameName.get(notYetDue.appid) ?? notYetDue.appid} at ${at.toISOString()}`
      );
    }
    console.log(
      "\n  Due games drain oldest-first on api boot, so a restart is what moves\n" +
        "  them — the 05:30 tick is missed while the dev box is asleep."
    );

    if (moving.length === 0) {
      console.log("\n=== Verdict ===\n");
      console.log("  No series has two observations yet. The gate cannot be judged.");
      return;
    }

    console.log("\n=== Movement, by absolute change ===\n");
    for (const s of [...moving]
      .sort((a, b) => Math.abs(delta(b)) - Math.abs(delta(a)))
      .slice(0, top)) {
      console.log(describe(s));
    }

    console.log("\n=== Movement, by relative change ===\n");
    for (const s of [...moving]
      .filter((s) => ratio(s) !== null)
      .sort((a, b) => (ratio(b) ?? 0) - (ratio(a) ?? 0))
      .slice(0, top)) {
      console.log(describe(s));
    }

    // The quantum histogram is the fastest read on whether anything moves for
    // real: a stack sitting entirely on 0.10pp is Steam's precision floor
    // talking, not the player base.
    console.log("\n=== Absolute move, bucketed ===\n");
    const buckets = new Map<string, number>();
    for (const s of moving) {
      const bucket = Math.abs(delta(s)).toFixed(2);
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
    for (const [bucket, count] of [...buckets].sort(
      (a, b) => Number(b[0]) - Number(a[0])
    )) {
      console.log(`  ${bucket.padStart(6)}pp  ${String(count).padStart(4)} series`);
    }

    console.log("\n=== The gate: visible movement in the rare band ===\n");
    console.log(
      `  rare band < ${pct(thresholds.rareBand)} · visible ≥ ${thresholds.visiblePp}pp or ≥ ${thresholds.visibleRatio}x · ★ = owner-unlocked\n`
    );
    const rare = moving.filter((s) => s.lastPct < thresholds.rareBand);
    const cleared = rare.filter((s) => isVisible(s, thresholds));

    if (cleared.length === 0) {
      console.log(`  ${rare.length} rare-band series move at all; none of them visibly.`);
      const best = [...rare].sort((a, b) => Math.abs(delta(b)) - Math.abs(delta(a)))[0];
      if (best !== undefined) {
        console.log(`  The largest is only ${pp(delta(best))}:\n${describe(best)}`);
      }
    } else {
      for (const s of [...cleared].sort(
        (a, b) => Math.abs(delta(b)) - Math.abs(delta(a))
      )) {
        console.log(describe(s));
        console.log(
          `      ${pp(perWeek(s))} per week over ${Math.round(spanDays(s))} days`
        );
      }
    }

    console.log("\n=== Verdict ===\n");
    if (cleared.length === 0) {
      console.log("  Gate NOT cleared — do not build the drift beat.");
      console.log(
        `  ${all.length - moving.length} of ${all.length} series are still single-point, so
  this reads partly as missing observations rather than as absent drift.`
      );
    } else {
      // Split before declaring anything. A verdict that pools the two cohorts
      // answers "did any series move" when the question is "does a settled
      // library drift" — and those had opposite answers on the first reading.
      const byCohort = (c: Cohort) => moving.filter((s) => cohort(s) === c);
      const summarise = (c: Cohort) => {
        const set = byCohort(c);
        const hit = set.filter((s) => isVisible(s, thresholds));
        const games = new Set(set.map((s) => gameName.get(s.appid) ?? `app ${s.appid}`));
        const worst = set.reduce((max, s) => Math.max(max, Math.abs(delta(s))), 0);
        const span = set.reduce((max, s) => Math.max(max, spanDays(s)), 0);
        return { set, hit, games, worst, span };
      };

      const launch = summarise("launch");
      const mature = summarise("mature");
      const unknown = summarise("unknown");

      const line = (label: string, r: ReturnType<typeof summarise>) =>
        console.log(
          `  ${label.padEnd(34)} ${String(r.hit.length).padStart(3)} of ${String(r.set.length).padEnd(4)} series visible` +
            ` · ${r.games.size} game(s) · max ${pp(r.worst)}`
        );

      console.log(
        `  Movement exists — ${cleared.length} series cleared the bar in the rare band.\n`
      );
      line(`launch window (≤${thresholds.launchWindowDays}d since release)`, launch);
      line("mature (settled titles)", mature);
      if (unknown.set.length > 0) line("unknown release date", unknown);

      if (mature.hit.length === 0 && launch.hit.length > 0) {
        // Deliberately does not say "mature titles do not drift". At this span
        // the mature signal sits on the quantization floor, where the slope's
        // relative error is larger than the slope — 0.1pp over 12 days is
        // anything from noise to ~3pp/year, and the data cannot separate them.
        console.log(
          `\n  Every visible mover is inside the launch window. Launch-window drift is
  established: real, large, and worth building against. The mature cohort is
  NOT established either way — across ${mature.set.length} series the largest move is
  ${pp(mature.worst)} over a ${mature.span.toFixed(0)}-day observation span, which is Steam's own
  quantum. A slope that small is unmeasurable at this span, not absent, and
  stays gated on elapsed time. Scope R3 on the launch window, or keep waiting.`
        );
      } else if (mature.hit.length > 0) {
        const named = new Set(
          mature.hit.map((s) => gameName.get(s.appid) ?? `app ${s.appid}`)
        );
        console.log(
          `\n  Gate CLEARED on settled titles — ${mature.hit.length} series across ${named.size} game(s): ${[...named].join(", ")}.
  This is the reading the beat needs; the launch-window rows are a separate effect.`
        );
      }
      console.log(
        "\n  Record these numbers in achievement-rarity-drift.md before scoping the beat."
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

// `require.main` is absent under ESM but this builds to CJS, so the guard holds
// and keeps the exported helpers importable by the spec without connecting.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
