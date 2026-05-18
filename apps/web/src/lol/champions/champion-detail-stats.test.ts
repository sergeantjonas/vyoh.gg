import type { MatchSummary } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { buildWinRateSeries, computeChampionDetail } from "./champion-detail-stats";

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

describe("computeChampionDetail", () => {
  it("returns null when the champion has no matches", () => {
    expect(computeChampionDetail("Ahri", [])).toBeNull();
    expect(computeChampionDetail("Ahri", [buildMatch({ champion: "Yasuo" })])).toBeNull();
  });

  it("aggregates KDA totals, averages, win rate, and total duration", () => {
    const stats = computeChampionDetail("Ahri", [
      buildMatch({
        matchId: "1",
        champion: "Ahri",
        kills: 10,
        deaths: 2,
        assists: 8,
        durationSec: 1800,
        win: true,
      }),
      buildMatch({
        matchId: "2",
        champion: "Ahri",
        kills: 4,
        deaths: 6,
        assists: 4,
        durationSec: 2400,
        win: false,
      }),
    ]);
    expect(stats).not.toBeNull();
    if (!stats) return;
    expect(stats.games).toBe(2);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(1);
    expect(stats.winRate).toBe(0.5);
    expect(stats.totalKills).toBe(14);
    expect(stats.totalDeaths).toBe(8);
    expect(stats.totalAssists).toBe(12);
    expect(stats.totalDurationSec).toBe(4200);
    expect(stats.avgKills).toBe(7);
    expect(stats.avgDeaths).toBe(4);
    expect(stats.avgAssists).toBe(6);
    expect(stats.avgKda).toBe((14 + 12) / 8);
  });

  it("treats avgKda specially when totalDeaths is 0 (Perfect KDA)", () => {
    const stats = computeChampionDetail("Ahri", [
      buildMatch({ champion: "Ahri", kills: 5, deaths: 0, assists: 3 }),
    ]);
    expect(stats?.avgKda).toBe(8);
  });

  it("matches champion key case-insensitively and preserves the original-case alias", () => {
    const stats = computeChampionDetail("AHRI", [
      buildMatch({ champion: "Ahri" }),
      buildMatch({ champion: "ahri" }),
    ]);
    expect(stats?.champion).toBe("Ahri");
    expect(stats?.games).toBe(2);
  });

  it("picks the dominant role from teamPosition counts", () => {
    const stats = computeChampionDetail("Ahri", [
      buildMatch({ champion: "Ahri", teamPosition: "MIDDLE" }),
      buildMatch({ champion: "Ahri", teamPosition: "MIDDLE" }),
      buildMatch({ champion: "Ahri", teamPosition: "TOP" }),
    ]);
    expect(stats?.position).toBe("MIDDLE");
  });

  it("falls back to MIDDLE when no match has a valid teamPosition", () => {
    const stats = computeChampionDetail("Ahri", [
      buildMatch({ champion: "Ahri", teamPosition: "" }),
      buildMatch({ champion: "Ahri", teamPosition: "INVALID" }),
    ]);
    expect(stats?.position).toBe("MIDDLE");
  });

  it("returns matchHistory in chronological order (oldest first)", () => {
    const stats = computeChampionDetail("Ahri", [
      buildMatch({ champion: "Ahri", playedAt: "2026-05-19T12:00:00Z", win: true }),
      buildMatch({ champion: "Ahri", playedAt: "2026-05-19T10:00:00Z", win: false }),
      buildMatch({ champion: "Ahri", playedAt: "2026-05-19T11:00:00Z", win: true }),
    ]);
    expect(stats?.matchHistory).toEqual([{ win: false }, { win: true }, { win: true }]);
  });
});

describe("buildWinRateSeries", () => {
  it("returns an empty array for empty history", () => {
    expect(buildWinRateSeries([])).toEqual([]);
  });

  it("computes the rolling cumulative win rate after each game", () => {
    expect(
      buildWinRateSeries([{ win: true }, { win: false }, { win: true }, { win: true }])
    ).toEqual([
      { game: 1, winRate: 1 },
      { game: 2, winRate: 0.5 },
      { game: 3, winRate: 2 / 3 },
      { game: 4, winRate: 0.75 },
    ]);
  });
});
