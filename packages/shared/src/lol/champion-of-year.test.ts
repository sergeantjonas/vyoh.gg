import { describe, expect, it } from "vitest";
import { selectChampionOfYear } from "./champion-of-year.ts";
import type { MatchSummary } from "./match.ts";

function fixture(overrides: Partial<MatchSummary> & { matchId: string }): MatchSummary {
  return {
    queueId: 420,
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

describe("selectChampionOfYear", () => {
  it("returns null for an empty window", () => {
    expect(selectChampionOfYear([])).toBeNull();
  });

  it("returns null when every match in the window is a remake", () => {
    expect(
      selectChampionOfYear([
        fixture({ matchId: "1", remake: true }),
        fixture({ matchId: "2", champion: "Lux", remake: true }),
      ])
    ).toBeNull();
  });

  it("totals games and kda per champion", () => {
    const pick = selectChampionOfYear([
      fixture({ matchId: "1", kills: 5, deaths: 2, assists: 3 }),
      fixture({ matchId: "2", kills: 7, deaths: 4, assists: 9 }),
    ]);
    expect(pick).toEqual({
      champion: "Ahri",
      games: 2,
      wins: 2,
      kills: 12,
      deaths: 6,
      assists: 12,
    });
  });

  it("counts only wins toward the wins total", () => {
    const pick = selectChampionOfYear([
      fixture({ matchId: "1", win: true }),
      fixture({ matchId: "2", win: false }),
    ]);
    expect(pick?.games).toBe(2);
    expect(pick?.wins).toBe(1);
  });

  it("picks the champion with the most games, not the best record", () => {
    const pick = selectChampionOfYear([
      fixture({ matchId: "1", champion: "Ahri", win: true }),
      fixture({ matchId: "2", champion: "Ahri", win: true }),
      fixture({ matchId: "3", champion: "Yasuo", win: false }),
      fixture({ matchId: "4", champion: "Yasuo", win: false }),
      fixture({ matchId: "5", champion: "Yasuo", win: false }),
    ]);
    expect(pick?.champion).toBe("Yasuo");
    expect(pick?.games).toBe(3);
    expect(pick?.wins).toBe(0);
  });

  // The remake filter is the standing LoL domain invariant — a remake must not
  // inflate the games count that decides the headline champion.
  it("excludes remakes from the per-champion totals", () => {
    const pick = selectChampionOfYear([
      fixture({ matchId: "1", champion: "Ahri", kills: 5 }),
      fixture({ matchId: "2", champion: "Ahri", kills: 99, remake: true }),
    ]);
    expect(pick?.games).toBe(1);
    expect(pick?.kills).toBe(5);
  });

  // Discriminating on purpose: unfiltered, Yasuo leads 3-2 and wins the pick.
  // With remakes excluded he drops to 1 real game and Ahri takes it.
  it("lets remakes flip which champion wins the pick", () => {
    const pick = selectChampionOfYear([
      fixture({ matchId: "1", champion: "Ahri" }),
      fixture({ matchId: "2", champion: "Ahri" }),
      fixture({ matchId: "3", champion: "Yasuo" }),
      fixture({ matchId: "4", champion: "Yasuo", remake: true }),
      fixture({ matchId: "5", champion: "Yasuo", remake: true }),
    ]);
    expect(pick?.champion).toBe("Ahri");
    expect(pick?.games).toBe(2);
  });
});
