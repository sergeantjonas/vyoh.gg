import { describe, expect, it } from "vitest";
import { computeStreak } from "./match-stats.ts";
import type { MatchSummary } from "./match.ts";

function fixture(overrides: Partial<MatchSummary> & { matchId: string }): MatchSummary {
  return {
    queueType: "RANKED_SOLO_5x5",
    champion: "Ahri",
    kills: 6,
    deaths: 4,
    assists: 7,
    win: true,
    durationSec: 1800,
    playedAt: "2026-05-30T20:00:00Z",
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "26.9",
    visionScore: 22,
    damageShare: 0.27,
    firstBloodKill: false,
    hasTimeline: true,
    csAt10: 70,
    csAt15: 110,
    goldAt10: 4000,
    goldAt15: 6500,
    teamGoldDiffAt15: 500,
    teamGoldDiffSeries: [],
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
    ...overrides,
  };
}

// computeStreak orders newest-first internally, so `playedAt` decides which
// match anchors the streak regardless of array order.
describe("computeStreak", () => {
  it("returns null for an empty window", () => {
    expect(computeStreak([])).toBeNull();
  });

  it("returns null when every match is a remake", () => {
    expect(
      computeStreak([
        fixture({ matchId: "1", playedAt: "2026-05-30T20:00:00Z", remake: true }),
        fixture({ matchId: "2", playedAt: "2026-05-30T19:00:00Z", remake: true }),
      ])
    ).toBeNull();
  });

  it("returns null for a single match, since one game is not a streak", () => {
    expect(computeStreak([fixture({ matchId: "1" })])).toBeNull();
  });

  it("returns null when the two most recent results differ", () => {
    expect(
      computeStreak([
        fixture({ matchId: "1", playedAt: "2026-05-30T20:00:00Z", win: true }),
        fixture({ matchId: "2", playedAt: "2026-05-30T19:00:00Z", win: false }),
      ])
    ).toBeNull();
  });

  it("counts a run of losses", () => {
    expect(
      computeStreak([
        fixture({ matchId: "1", playedAt: "2026-05-30T20:00:00Z", win: false }),
        fixture({ matchId: "2", playedAt: "2026-05-30T19:00:00Z", win: false }),
        fixture({ matchId: "3", playedAt: "2026-05-30T18:00:00Z", win: false }),
      ])
    ).toEqual({ type: "loss", count: 3 });
  });

  // Stops at the first differing result rather than counting every win in
  // the window.
  it("stops counting at the first result that breaks the run", () => {
    expect(
      computeStreak([
        fixture({ matchId: "1", playedAt: "2026-05-30T20:00:00Z", win: true }),
        fixture({ matchId: "2", playedAt: "2026-05-30T19:00:00Z", win: true }),
        fixture({ matchId: "3", playedAt: "2026-05-30T18:00:00Z", win: false }),
        fixture({ matchId: "4", playedAt: "2026-05-30T17:00:00Z", win: true }),
      ])
    ).toEqual({ type: "win", count: 2 });
  });

  it("ignores remakes when deciding whether the run is unbroken", () => {
    expect(
      computeStreak([
        fixture({ matchId: "1", playedAt: "2026-05-30T20:00:00Z", win: false }),
        fixture({
          matchId: "2",
          playedAt: "2026-05-30T19:00:00Z",
          win: true,
          remake: true,
        }),
        fixture({ matchId: "3", playedAt: "2026-05-30T18:00:00Z", win: false }),
      ])
    ).toEqual({ type: "loss", count: 2 });
  });
});
