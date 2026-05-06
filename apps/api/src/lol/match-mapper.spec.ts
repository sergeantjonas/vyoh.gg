import { describe, expect, it } from "vitest";
import type { RiotMatch } from "../riot/types";
import { riotMatchToSummary } from "./match-mapper";

const baseMatch: RiotMatch = {
  metadata: {
    matchId: "EUW1_42",
    participants: ["puuid-vyoh", "puuid-other"],
  },
  info: {
    gameStartTimestamp: 1_700_000_000_000,
    gameDuration: 1834,
    queueId: 420,
    participants: [
      {
        puuid: "puuid-vyoh",
        championName: "Ahri",
        kills: 8,
        deaths: 3,
        assists: 12,
        win: true,
      },
      {
        puuid: "puuid-other",
        championName: "Lux",
        kills: 4,
        deaths: 6,
        assists: 9,
        win: false,
      },
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
    });
  });

  it("falls back to 'Queue N' for unmapped queue ids", () => {
    const summary = riotMatchToSummary(
      { ...baseMatch, info: { ...baseMatch.info, queueId: 9999 } },
      "puuid-vyoh"
    );
    expect(summary.queueType).toBe("Queue 9999");
  });

  it("throws when the puuid is not in the participants", () => {
    expect(() => riotMatchToSummary(baseMatch, "puuid-not-in-match")).toThrow(
      /puuid-not-in-match/
    );
  });
});
