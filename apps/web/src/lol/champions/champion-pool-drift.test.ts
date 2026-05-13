import type { MatchSummary } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { computePoolDrift } from "./champion-pool-drift";

const NOW = new Date("2026-05-13T12:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;

function buildMatch(
  overrides: Partial<MatchSummary> & { playedAt: string }
): MatchSummary {
  return {
    matchId: overrides.matchId ?? "M_1",
    queueType: "Ranked Solo",
    champion: overrides.champion ?? "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win: overrides.win ?? true,
    durationSec: 1800,
    playedAt: overrides.playedAt,
    remake: overrides.remake ?? false,
    teamPosition: overrides.teamPosition ?? "",
    gameVersion: "",
    visionScore: 0,
    damageShare: 0,
    firstBloodKill: false,
    csAt10: 0,
    csAt15: 0,
    goldAt10: 0,
    goldAt15: 0,
    teamGoldDiffAt15: 0,
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
  };
}

function isoDaysAgo(days: number): string {
  return new Date(NOW - days * DAY).toISOString();
}

describe("computePoolDrift", () => {
  it("classifies champions as added / dropped / sustained over 14d windows", () => {
    const drift = computePoolDrift(
      [
        buildMatch({ matchId: "a1", champion: "Ahri", playedAt: isoDaysAgo(2) }),
        buildMatch({ matchId: "a2", champion: "Ahri", playedAt: isoDaysAgo(20) }),
        buildMatch({ matchId: "n1", champion: "Neeko", playedAt: isoDaysAgo(5) }),
        buildMatch({ matchId: "n2", champion: "Neeko", playedAt: isoDaysAgo(7) }),
        buildMatch({ matchId: "j1", champion: "Jhin", playedAt: isoDaysAgo(18) }),
      ],
      NOW
    );

    expect(drift.added.map((e) => e.champion)).toEqual(["Neeko"]);
    expect(drift.added[0]?.count).toBe(2);
    expect(drift.dropped.map((e) => e.champion)).toEqual(["Jhin"]);
    expect(drift.sustained.map((e) => e.champion)).toEqual(["Ahri"]);
    expect(drift.currentGames).toBe(3);
    expect(drift.priorGames).toBe(2);
  });

  it("excludes matches outside both windows", () => {
    const drift = computePoolDrift(
      [
        buildMatch({ matchId: "old", champion: "Lulu", playedAt: isoDaysAgo(40) }),
        buildMatch({ matchId: "now", champion: "Ahri", playedAt: isoDaysAgo(1) }),
      ],
      NOW
    );
    expect(drift.added.map((e) => e.champion)).toEqual(["Ahri"]);
    expect(drift.dropped).toEqual([]);
    expect(drift.priorGames).toBe(0);
  });

  it("places the current/prior boundary at the start of day 14", () => {
    const drift = computePoolDrift(
      [
        buildMatch({ matchId: "edge-c", champion: "Edge", playedAt: isoDaysAgo(14) }),
        buildMatch({
          matchId: "edge-p",
          champion: "EdgePrior",
          playedAt: isoDaysAgo(14.001),
        }),
      ],
      NOW
    );
    expect(drift.added.map((e) => e.champion)).toEqual(["Edge"]);
    expect(drift.dropped.map((e) => e.champion)).toEqual(["EdgePrior"]);
  });

  it("ignores remakes in both windows", () => {
    const drift = computePoolDrift(
      [
        buildMatch({
          matchId: "rem-c",
          champion: "Yone",
          playedAt: isoDaysAgo(3),
          remake: true,
        }),
        buildMatch({
          matchId: "rem-p",
          champion: "Garen",
          playedAt: isoDaysAgo(20),
          remake: true,
        }),
      ],
      NOW
    );
    expect(drift.added).toEqual([]);
    expect(drift.dropped).toEqual([]);
    expect(drift.currentGames).toBe(0);
    expect(drift.priorGames).toBe(0);
  });

  it("returns empty buckets when there are no matches", () => {
    const drift = computePoolDrift([], NOW);
    expect(drift.added).toEqual([]);
    expect(drift.dropped).toEqual([]);
    expect(drift.sustained).toEqual([]);
    expect(drift.currentGames).toBe(0);
    expect(drift.priorGames).toBe(0);
  });

  it("treats an empty prior window as no-drop, all-add", () => {
    const drift = computePoolDrift(
      [
        buildMatch({ matchId: "1", champion: "Ahri", playedAt: isoDaysAgo(2) }),
        buildMatch({ matchId: "2", champion: "Jhin", playedAt: isoDaysAgo(5) }),
      ],
      NOW
    );
    expect(drift.added.map((e) => e.champion).sort()).toEqual(["Ahri", "Jhin"]);
    expect(drift.dropped).toEqual([]);
    expect(drift.priorGames).toBe(0);
  });

  it("sorts entries by count desc, then alphabetical for stability", () => {
    const drift = computePoolDrift(
      [
        buildMatch({ matchId: "a1", champion: "Ahri", playedAt: isoDaysAgo(2) }),
        buildMatch({ matchId: "z1", champion: "Zed", playedAt: isoDaysAgo(2) }),
        buildMatch({ matchId: "z2", champion: "Zed", playedAt: isoDaysAgo(3) }),
        buildMatch({ matchId: "n1", champion: "Neeko", playedAt: isoDaysAgo(3) }),
      ],
      NOW
    );
    expect(drift.added.map((e) => e.champion)).toEqual(["Zed", "Ahri", "Neeko"]);
  });
});
