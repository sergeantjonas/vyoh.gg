import type { MatchSummary } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import {
  computeGameLengthStats,
  computeHabitsStats,
  computeHourDayStats,
  computePoolStats,
  computeTiltStats,
} from "./use-habits-stats";

function buildMatch(overrides: Partial<MatchSummary>): MatchSummary {
  return {
    matchId: overrides.matchId ?? "M_1",
    queueType: overrides.queueType ?? "Ranked Solo",
    champion: overrides.champion ?? "Ahri",
    kills: overrides.kills ?? 5,
    deaths: overrides.deaths ?? 3,
    assists: overrides.assists ?? 7,
    win: overrides.win ?? true,
    durationSec: overrides.durationSec ?? 1800,
    playedAt: overrides.playedAt ?? "2026-05-19T12:00:00.000Z",
    remake: overrides.remake ?? false,
    teamPosition: overrides.teamPosition ?? "",
    gameVersion: overrides.gameVersion ?? "",
    visionScore: overrides.visionScore ?? 0,
    damageShare: overrides.damageShare ?? 0,
    firstBloodKill: overrides.firstBloodKill ?? false,
    csAt10: overrides.csAt10 ?? 0,
    csAt15: overrides.csAt15 ?? 0,
    goldAt10: overrides.goldAt10 ?? 0,
    goldAt15: overrides.goldAt15 ?? 0,
    teamGoldDiffAt15: overrides.teamGoldDiffAt15 ?? 0,
    deathTimings: overrides.deathTimings ?? [],
    deathXs: overrides.deathXs ?? [],
    deathYs: overrides.deathYs ?? [],
    killTimings: overrides.killTimings ?? [],
    killXs: overrides.killXs ?? [],
    killYs: overrides.killYs ?? [],
    laneOpponent: overrides.laneOpponent ?? null,
  };
}

describe("computeHourDayStats", () => {
  it("returns a full 168-cell grid (7 days × 24 hours)", () => {
    const stats = computeHourDayStats([]);
    expect(stats).toHaveLength(168);
    expect(stats.every((s) => s.games === 0 && s.wins === 0)).toBe(true);
  });

  it("buckets matches by Brussels-local-equivalent hour and Mon-first day", () => {
    // Construct a Date and read its hour/day so the test stays TZ-agnostic.
    const sample = new Date("2026-05-19T12:00:00.000Z");
    const stats = computeHourDayStats([
      buildMatch({ playedAt: sample.toISOString(), win: true }),
      buildMatch({ playedAt: sample.toISOString(), win: false }),
    ]);
    const expectedDay = (sample.getDay() + 6) % 7;
    const expectedHour = sample.getHours();
    const cell = stats.find((s) => s.day === expectedDay && s.hour === expectedHour);
    expect(cell).toMatchObject({ games: 2, wins: 1 });
  });

  it("excludes remakes from the buckets", () => {
    const sample = new Date("2026-05-19T12:00:00.000Z");
    const stats = computeHourDayStats([
      buildMatch({ playedAt: sample.toISOString(), win: true }),
      buildMatch({ playedAt: sample.toISOString(), win: true, remake: true }),
    ]);
    const cell = stats.find(
      (s) => s.day === (sample.getDay() + 6) % 7 && s.hour === sample.getHours()
    );
    expect(cell?.games).toBe(1);
  });
});

describe("computeTiltStats", () => {
  it("returns zeros for fewer than 2 matches", () => {
    expect(computeTiltStats([])).toEqual({
      afterWin: { games: 0, wins: 0 },
      afterLoss: { games: 0, wins: 0 },
    });
  });

  it("counts wins/losses bucketed by the prior match outcome", () => {
    // Chronological: W, W, L, W — after-win has 2 games (W→W: win, W→L: loss),
    // after-loss has 1 game (L→W: win).
    const matches = [
      buildMatch({ matchId: "1", playedAt: "2026-05-19T10:00:00Z", win: true }),
      buildMatch({ matchId: "2", playedAt: "2026-05-19T11:00:00Z", win: true }),
      buildMatch({ matchId: "3", playedAt: "2026-05-19T12:00:00Z", win: false }),
      buildMatch({ matchId: "4", playedAt: "2026-05-19T13:00:00Z", win: true }),
    ];
    expect(computeTiltStats(matches)).toEqual({
      afterWin: { games: 2, wins: 1 },
      afterLoss: { games: 1, wins: 1 },
    });
  });

  it("sorts internally by playedAt — input order does not matter", () => {
    const matches = [
      buildMatch({ matchId: "later", playedAt: "2026-05-19T13:00:00Z", win: true }),
      buildMatch({ matchId: "earlier", playedAt: "2026-05-19T12:00:00Z", win: false }),
    ];
    expect(computeTiltStats(matches)).toEqual({
      afterWin: { games: 0, wins: 0 },
      afterLoss: { games: 1, wins: 1 },
    });
  });

  it("excludes remakes before pairing", () => {
    const matches = [
      buildMatch({ matchId: "1", playedAt: "2026-05-19T10:00:00Z", win: true }),
      buildMatch({
        matchId: "remake",
        playedAt: "2026-05-19T11:00:00Z",
        win: false,
        remake: true,
      }),
      buildMatch({ matchId: "3", playedAt: "2026-05-19T12:00:00Z", win: true }),
    ];
    // After remake removal the pair is W→W, not W→L→W.
    expect(computeTiltStats(matches).afterWin.games).toBe(1);
    expect(computeTiltStats(matches).afterWin.wins).toBe(1);
  });
});

describe("computeGameLengthStats", () => {
  it("always emits the three canonical buckets in order", () => {
    const buckets = computeGameLengthStats([]);
    expect(buckets.map((b) => b.label)).toEqual(["Under 25m", "25–35m", "Over 35m"]);
  });

  it("buckets by durationSec and tracks wins separately", () => {
    const buckets = computeGameLengthStats([
      buildMatch({ durationSec: 20 * 60, win: true }),
      buildMatch({ durationSec: 30 * 60, win: false }),
      buildMatch({ durationSec: 40 * 60, win: true }),
      buildMatch({ durationSec: 25 * 60, win: true }), // exactly 25m → "Under 25m"
    ]);
    expect(buckets).toEqual([
      { label: "Under 25m", games: 2, wins: 2 },
      { label: "25–35m", games: 1, wins: 0 },
      { label: "Over 35m", games: 1, wins: 1 },
    ]);
  });

  it("excludes remakes from bucket counts", () => {
    const buckets = computeGameLengthStats([
      buildMatch({ durationSec: 20 * 60, remake: true }),
      buildMatch({ durationSec: 20 * 60 }),
    ]);
    expect(buckets[0]).toMatchObject({ games: 1 });
  });
});

describe("computePoolStats", () => {
  it("counts unique champions over the last 30 days, excluding remakes", () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const stats = computePoolStats([
      buildMatch({ champion: "Ahri", playedAt: recent }),
      buildMatch({ champion: "Yasuo", playedAt: recent }),
      buildMatch({ champion: "Ahri", playedAt: recent }), // dup
      buildMatch({ champion: "Lux", playedAt: old }), // outside window
      buildMatch({ champion: "Zed", playedAt: recent, remake: true }), // remake dropped
    ]);
    expect(stats).toEqual({ uniqueChampions: 2, totalGames: 3, days: 30 });
  });
});

describe("computeHabitsStats", () => {
  it("computes overallWinRate = wins / non-remake-games", () => {
    const stats = computeHabitsStats([
      buildMatch({ matchId: "1", win: true }),
      buildMatch({ matchId: "2", win: false }),
      buildMatch({ matchId: "3", win: true, remake: true }),
    ]);
    expect(stats.overallWinRate).toBe(0.5);
  });

  it("returns 0 win rate for an all-remake list", () => {
    const stats = computeHabitsStats([
      buildMatch({ matchId: "1", win: true, remake: true }),
    ]);
    expect(stats.overallWinRate).toBe(0);
  });
});
