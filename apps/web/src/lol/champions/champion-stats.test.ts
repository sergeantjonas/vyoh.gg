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
    playedAt: overrides.playedAt ?? new Date().toISOString(),
    remake: overrides.remake ?? false,
    teamPosition: overrides.teamPosition ?? "MIDDLE",
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

  it("consolidates one champion across roles into a single row with a roles breakdown", () => {
    const stats = aggregateChampionStats([
      buildMatch({ matchId: "1", champion: "Lux", teamPosition: "MIDDLE", win: true }),
      buildMatch({ matchId: "2", champion: "Lux", teamPosition: "MIDDLE", win: false }),
      buildMatch({ matchId: "3", champion: "Lux", teamPosition: "UTILITY", win: true }),
    ]);
    expect(stats).toHaveLength(1);
    // Dominant role is the one with the most games — surfaces on `position`.
    expect(stats[0]).toMatchObject({
      champion: "Lux",
      position: "MIDDLE",
      games: 3,
      wins: 2,
      losses: 1,
    });
    expect(stats[0]?.roles).toEqual([
      { position: "MIDDLE", games: 2, wins: 1, losses: 1, winRate: 0.5 },
      { position: "UTILITY", games: 1, wins: 1, losses: 0, winRate: 1 },
    ]);
  });

  it("orders roles by games desc so the dominant lane is first", () => {
    const stats = aggregateChampionStats([
      buildMatch({ matchId: "1", champion: "Ahri", teamPosition: "TOP" }),
      buildMatch({ matchId: "2", champion: "Ahri", teamPosition: "MIDDLE" }),
      buildMatch({ matchId: "3", champion: "Ahri", teamPosition: "MIDDLE" }),
      buildMatch({ matchId: "4", champion: "Ahri", teamPosition: "MIDDLE" }),
    ]);
    expect(stats[0]?.position).toBe("MIDDLE");
    expect(stats[0]?.roles.map((r) => r.position)).toEqual(["MIDDLE", "TOP"]);
  });

  it("drops matches with no teamPosition (ARAM / Arena)", () => {
    const stats = aggregateChampionStats([
      buildMatch({ matchId: "1", champion: "Ahri", teamPosition: "" }),
      buildMatch({ matchId: "2", champion: "Ahri", teamPosition: "MIDDLE" }),
    ]);
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ champion: "Ahri", position: "MIDDLE", games: 1 });
  });

  it("emits a chronological rolling win rate over the last up-to-10 games per champion", () => {
    const stats = aggregateChampionStats([
      buildMatch({
        matchId: "1",
        champion: "Ahri",
        win: true,
        playedAt: "2026-05-01T00:00:00Z",
      }),
      buildMatch({
        matchId: "2",
        champion: "Ahri",
        win: false,
        playedAt: "2026-05-02T00:00:00Z",
      }),
      buildMatch({
        matchId: "3",
        champion: "Ahri",
        win: true,
        playedAt: "2026-05-03T00:00:00Z",
      }),
      buildMatch({
        matchId: "4",
        champion: "Ahri",
        win: true,
        playedAt: "2026-05-04T00:00:00Z",
      }),
    ]);
    expect(stats[0]?.recentWinRates).toEqual([1, 0.5, 2 / 3, 0.75]);
  });

  it("caps recentWinRates at the 10 most recent games per champion", () => {
    const matches = Array.from({ length: 14 }, (_, i) =>
      buildMatch({
        matchId: `M_${i}`,
        champion: "Ahri",
        win: i % 2 === 0,
        // Older first; newest are the higher indices.
        playedAt: new Date(2026, 4, i + 1).toISOString(),
      })
    );
    const stats = aggregateChampionStats(matches);
    expect(stats[0]?.recentWinRates).toHaveLength(10);
    // Most recent 10 are indices 4..13 → wins: even ⇒ [T,F,T,F,T,F,T,F,T,F]
    expect(stats[0]?.recentWinRates[0]).toBe(1);
    expect(stats[0]?.recentWinRates[9]).toBe(0.5);
  });
});
