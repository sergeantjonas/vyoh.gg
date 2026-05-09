import type { MatchSummary } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { aggregateChampionStats } from "./champion-stats";

function buildMatch(overrides: Partial<MatchSummary>): MatchSummary {
  return {
    matchId: overrides.matchId ?? "M_1",
    queueType: "Ranked Solo",
    champion: overrides.champion ?? "Ahri",
    kills: overrides.kills ?? 5,
    deaths: overrides.deaths ?? 3,
    assists: overrides.assists ?? 7,
    win: overrides.win ?? true,
    durationSec: overrides.durationSec ?? 1800,
    playedAt: new Date().toISOString(),
    remake: overrides.remake ?? false,
    laneOpponent: overrides.laneOpponent ?? null,
  };
}

describe("aggregateChampionStats", () => {
  it("groups matches by champion", () => {
    const stats = aggregateChampionStats([
      buildMatch({ matchId: "1", champion: "Ahri" }),
      buildMatch({ matchId: "2", champion: "Ahri" }),
      buildMatch({ matchId: "3", champion: "Jhin" }),
    ]);

    expect(stats).toHaveLength(2);
    expect(stats.find((s) => s.champion === "Ahri")?.games).toBe(2);
    expect(stats.find((s) => s.champion === "Jhin")?.games).toBe(1);
  });

  it("computes win rate correctly", () => {
    const stats = aggregateChampionStats([
      buildMatch({ matchId: "1", champion: "Ahri", win: true }),
      buildMatch({ matchId: "2", champion: "Ahri", win: true }),
      buildMatch({ matchId: "3", champion: "Ahri", win: false }),
      buildMatch({ matchId: "4", champion: "Ahri", win: false }),
    ]);

    expect(stats[0]?.wins).toBe(2);
    expect(stats[0]?.losses).toBe(2);
    expect(stats[0]?.winRate).toBe(0.5);
  });

  it("computes KDA as (kills + assists) / deaths", () => {
    const stats = aggregateChampionStats([
      buildMatch({
        matchId: "1",
        champion: "Ahri",
        kills: 8,
        deaths: 4,
        assists: 12,
      }),
    ]);
    expect(stats[0]?.avgKda).toBe(5);
  });

  it("treats zero deaths as perfect KDA equal to kills + assists", () => {
    const stats = aggregateChampionStats([
      buildMatch({
        matchId: "1",
        champion: "Ahri",
        kills: 8,
        deaths: 0,
        assists: 12,
      }),
    ]);
    expect(stats[0]?.avgKda).toBe(20);
  });

  it("sorts by games played descending", () => {
    const stats = aggregateChampionStats([
      buildMatch({ matchId: "1", champion: "Ahri" }),
      buildMatch({ matchId: "2", champion: "Jhin" }),
      buildMatch({ matchId: "3", champion: "Jhin" }),
      buildMatch({ matchId: "4", champion: "Jhin" }),
      buildMatch({ matchId: "5", champion: "Lulu" }),
      buildMatch({ matchId: "6", champion: "Lulu" }),
    ]);
    expect(stats.map((s) => s.champion)).toEqual(["Jhin", "Lulu", "Ahri"]);
  });

  it("returns an empty array when no matches", () => {
    expect(aggregateChampionStats([])).toEqual([]);
  });
});
