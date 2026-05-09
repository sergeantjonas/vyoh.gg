import { describe, expect, it } from "vitest";
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
    ...overrides,
  };
}

const baseMatch: RiotMatch = {
  metadata: {
    matchId: "EUW1_42",
    participants: ["puuid-vyoh", "puuid-other"],
  },
  info: {
    gameStartTimestamp: 1_700_000_000_000,
    gameDuration: 1834,
    queueId: 420,
    gameEndedInEarlySurrender: false,
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
});
