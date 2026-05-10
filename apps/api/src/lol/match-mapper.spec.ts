import { assert, describe, expect, it } from "vitest";
import type { RiotMatch, RiotMatchParticipant } from "../riot/types";
import { riotMatchToDetail, riotMatchToSummary } from "./match-mapper";

function buildParticipant(
  overrides: Partial<RiotMatchParticipant>
): RiotMatchParticipant {
  return {
    puuid: "puuid-vyoh",
    riotIdGameName: "Vyoh",
    riotIdTagline: "Ahri",
    championName: "Ahri",
    teamId: 100,
    teamPosition: "MIDDLE",
    kills: 8,
    deaths: 3,
    assists: 12,
    win: true,
    item0: 0,
    item1: 0,
    item2: 0,
    item3: 0,
    item4: 0,
    item5: 0,
    item6: 0,
    goldEarned: 12000,
    totalDamageDealtToChampions: 25000,
    physicalDamageDealtToChampions: 15000,
    magicDamageDealtToChampions: 8000,
    trueDamageDealtToChampions: 2000,
    totalMinionsKilled: 180,
    neutralMinionsKilled: 20,
    visionScore: 30,
    wardsPlaced: 10,
    wardsKilled: 5,
    detectorWardsPlaced: 3,
    firstBloodKill: false,
    summoner1Id: 4,
    summoner2Id: 14,
    champLevel: 18,
    perks: { styles: [{ selections: [{ perk: 8214 }] }] },
    ...overrides,
  };
}

const baseTeam = {
  teamId: 100,
  win: true,
  objectives: {
    baron: { first: false, kills: 0 },
    champion: { first: true, kills: 8 },
    dragon: { first: true, kills: 2 },
    inhibitor: { first: false, kills: 0 },
    riftHerald: { first: true, kills: 1 },
    tower: { first: true, kills: 5 },
  },
};

const baseMatch: RiotMatch = {
  metadata: {
    matchId: "EUW1_42",
    participants: ["puuid-vyoh", "puuid-other"],
  },
  info: {
    gameStartTimestamp: 1_700_000_000_000,
    gameDuration: 1834,
    gameVersion: "14.20.586.5840",
    queueId: 420,
    gameEndedInEarlySurrender: false,
    teams: [baseTeam, { ...baseTeam, teamId: 200, win: false }],
    participants: [
      buildParticipant({ puuid: "puuid-vyoh" }),
      buildParticipant({
        puuid: "puuid-other",
        championName: "Lux",
        teamId: 200,
        teamPosition: "BOTTOM",
        kills: 4,
        deaths: 6,
        assists: 9,
        win: false,
      }),
    ],
  },
};

describe("riotMatchToSummary", () => {
  it("extracts the requested participant's stats", () => {
    const summary = riotMatchToSummary(baseMatch, "puuid-vyoh");
    expect(summary).toEqual({
      matchId: "EUW1_42",
      queueType: "Ranked Solo",
      champion: "Ahri",
      kills: 8,
      deaths: 3,
      assists: 12,
      win: true,
      durationSec: 1834,
      playedAt: "2023-11-14T22:13:20.000Z",
      remake: false,
      teamPosition: "MIDDLE",
      gameVersion: "14.20.586.5840",
      visionScore: 30,
      damageShare: 1,
      firstBloodKill: false,
      laneOpponent: null,
    });
  });

  it("populates laneOpponent when a matching position exists on the enemy team", () => {
    const matchWithOpponent: RiotMatch = {
      ...baseMatch,
      info: {
        ...baseMatch.info,
        participants: [
          buildParticipant({ puuid: "puuid-vyoh", teamPosition: "MIDDLE" }),
          buildParticipant({
            puuid: "puuid-enemy-mid",
            riotIdGameName: "Faker",
            riotIdTagline: "KR1",
            championName: "Syndra",
            teamId: 200,
            teamPosition: "MIDDLE",
          }),
        ],
      },
    };
    const summary = riotMatchToSummary(matchWithOpponent, "puuid-vyoh");
    expect(summary.laneOpponent).toEqual({
      puuid: "puuid-enemy-mid",
      championName: "Syndra",
      gameName: "Faker",
      tagLine: "KR1",
    });
  });

  it("falls back to 'Queue N' for unmapped queue ids", () => {
    const summary = riotMatchToSummary(
      { ...baseMatch, info: { ...baseMatch.info, queueId: 9999 } },
      "puuid-vyoh"
    );
    expect(summary.queueType).toBe("Queue 9999");
  });

  it("flags remake when gameEndedInEarlySurrender and duration < 210s", () => {
    const remakeMatch: RiotMatch = {
      ...baseMatch,
      info: { ...baseMatch.info, gameEndedInEarlySurrender: true, gameDuration: 180 },
    };
    const summary = riotMatchToSummary(remakeMatch, "puuid-vyoh");
    expect(summary.remake).toBe(true);
  });

  it("does not flag remake when duration >= 210s even if gameEndedInEarlySurrender", () => {
    const surrenderMatch: RiotMatch = {
      ...baseMatch,
      info: { ...baseMatch.info, gameEndedInEarlySurrender: true, gameDuration: 900 },
    };
    const summary = riotMatchToSummary(surrenderMatch, "puuid-vyoh");
    expect(summary.remake).toBe(false);
  });

  it("throws when the puuid is not in the participants", () => {
    expect(() => riotMatchToSummary(baseMatch, "puuid-not-in-match")).toThrow(
      /puuid-not-in-match/
    );
  });
});

describe("riotMatchToDetail", () => {
  it("returns the full participant list with mapped fields", () => {
    const detail = riotMatchToDetail({
      ...baseMatch,
      info: {
        ...baseMatch.info,
        teams: [baseTeam],
        participants: [
          buildParticipant({
            puuid: "p1",
            championName: "Ahri",
            item0: 100,
            item1: 200,
            item2: 300,
            item3: 0,
            item4: 0,
            item5: 0,
            item6: 0,
          }),
        ],
      },
    });

    expect(detail.matchId).toBe("EUW1_42");
    expect(detail.participants).toHaveLength(1);
    expect(detail.participants[0]?.items).toEqual([100, 200, 300, 0, 0, 0, 0]);
    expect(detail.participants[0]?.championName).toBe("Ahri");
    expect(detail.participants[0]?.teamId).toBe(100);
  });

  it("projects CS, vision, keystone, and champion level", () => {
    const detail = riotMatchToDetail(baseMatch);
    const p = detail.participants[0];
    assert(p !== undefined);
    expect(p.csTotal).toBe(200);
    expect(p.csPerMin).toBeCloseTo(200 / (1834 / 60), 1);
    expect(p.visionScore).toBe(30);
    expect(p.keystone).toBe(8214);
    expect(p.championLevel).toBe(18);
  });

  it("computes damage and gold share relative to team totals", () => {
    const detail = riotMatchToDetail(baseMatch);
    const vyoh = detail.participants.find((p) => p.puuid === "puuid-vyoh");
    const other = detail.participants.find((p) => p.puuid === "puuid-other");
    assert(vyoh !== undefined && other !== undefined);
    // vyoh is the only member of team 100, so damageShare should be 1
    expect(vyoh.damageShare).toBeCloseTo(1);
    // other is the only member of team 200, so damageShare should also be 1
    expect(other.damageShare).toBeCloseTo(1);
  });

  it("projects the teams block with objectives", () => {
    const detail = riotMatchToDetail(baseMatch);
    expect(detail.teams).toHaveLength(2);
    expect(detail.teams[0]?.teamId).toBe(100);
    expect(detail.teams[0]?.objectives.tower.first).toBe(true);
  });
});
