import type { MatchSummary } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { computeKdaSeries, computeQueueCounts, computeTrendSummary } from "./trend-stats";

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
    playedAt: overrides.playedAt ?? new Date().toISOString(),
    remake: overrides.remake ?? false,
    teamPosition: overrides.teamPosition ?? "",
    gameVersion: overrides.gameVersion ?? "",
    visionScore: overrides.visionScore ?? 0,
    damageShare: overrides.damageShare ?? 0,
    firstBloodKill: overrides.firstBloodKill ?? false,
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

describe("computeKdaSeries", () => {
  it("orders points by playedAt ascending and computes KDA per game", () => {
    const points = computeKdaSeries([
      buildMatch({
        matchId: "1",
        playedAt: "2026-05-05T00:00:00Z",
        kills: 10,
        deaths: 5,
        assists: 5,
      }),
      buildMatch({
        matchId: "2",
        playedAt: "2026-05-04T00:00:00Z",
        kills: 4,
        deaths: 4,
        assists: 4,
      }),
    ]);
    expect(points.map((p) => p.game)).toEqual([1, 2]);
    expect(points[0]?.kda).toBe(2);
    expect(points[1]?.kda).toBe(3);
  });
});

describe("computeQueueCounts", () => {
  it("groups matches by queue type and sorts by count descending", () => {
    const counts = computeQueueCounts([
      buildMatch({ matchId: "1", queueType: "Ranked Solo" }),
      buildMatch({ matchId: "2", queueType: "ARAM" }),
      buildMatch({ matchId: "3", queueType: "Ranked Solo" }),
      buildMatch({ matchId: "4", queueType: "Ranked Solo" }),
    ]);
    expect(counts).toEqual([
      { queueType: "Ranked Solo", count: 3 },
      { queueType: "ARAM", count: 1 },
    ]);
  });
});
