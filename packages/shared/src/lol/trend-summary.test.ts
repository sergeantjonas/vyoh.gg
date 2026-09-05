import { describe, expect, it } from "vitest";
import type { MatchSummary } from "./match.ts";
import { computeTrendSummary } from "./trend-summary.ts";

function buildMatch(overrides: Partial<MatchSummary>): MatchSummary {
  return {
    matchId: overrides.matchId ?? "M_1",
    queueId: overrides.queueId ?? 420,
    champion: overrides.champion ?? "Ahri",
    kills: overrides.kills ?? 5,
    deaths: overrides.deaths ?? 3,
    assists: overrides.assists ?? 7,
    win: overrides.win ?? true,
    durationSec: overrides.durationSec ?? 1800,
    playedAt: overrides.playedAt ?? new Date().toISOString(),
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
    teamGoldDiffSeries: [],
    deathTimings: overrides.deathTimings ?? [],
    deathXs: overrides.deathXs ?? [],
    deathYs: overrides.deathYs ?? [],
    killTimings: overrides.killTimings ?? [],
    killXs: overrides.killXs ?? [],
    killYs: overrides.killYs ?? [],
    laneOpponent: overrides.laneOpponent ?? null,
  };
}

describe("computeTrendSummary", () => {
  it("returns zeros for an empty list", () => {
    const s = computeTrendSummary([]);
    expect(s.games).toBe(0);
    expect(s.winRate).toBe(0);
  });

  it("aggregates wins, KDA, and playtime", () => {
    const s = computeTrendSummary([
      buildMatch({
        matchId: "1",
        win: true,
        kills: 8,
        deaths: 4,
        assists: 12,
        durationSec: 1800,
      }),
      buildMatch({
        matchId: "2",
        win: false,
        kills: 4,
        deaths: 8,
        assists: 6,
        durationSec: 1500,
      }),
    ]);
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(1);
    expect(s.winRate).toBe(0.5);
    expect(s.totalKills).toBe(12);
    expect(s.totalDeaths).toBe(12);
    expect(s.totalAssists).toBe(18);
    expect(s.avgKda).toBeCloseTo(2.5);
    expect(s.totalDurationSec).toBe(3300);
  });
});
