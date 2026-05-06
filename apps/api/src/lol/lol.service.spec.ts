import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { PrismaService } from "../prisma/prisma.service";
import { RiotService } from "../riot/riot.service";
import type { RiotMatch } from "../riot/types";
import { LolService } from "./lol.service";

function buildMatch(matchId: string, startTs: number): RiotMatch {
  return {
    metadata: { matchId, participants: ["puuid-vyoh"] },
    info: {
      gameStartTimestamp: startTs,
      gameDuration: 1834,
      queueId: 420,
      participants: [
        {
          puuid: "puuid-vyoh",
          championName: "Ahri",
          kills: 1,
          deaths: 2,
          assists: 3,
          win: true,
        },
      ],
    },
  };
}

describe("LolService.getMatchesForSummoner", () => {
  it("looks up the account, fetches matches, upserts each, and returns sorted by playedAt desc", async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);

    const prisma = { match: { upsert } };
    const riot = {
      getAccountByRiotId: vi.fn().mockResolvedValue({
        puuid: "puuid-vyoh",
        gameName: "Vyoh",
        tagLine: "EUW",
      }),
      getMatchIdsByPuuid: vi.fn().mockResolvedValue(["M_1", "M_2"]),
      getMatchById: vi.fn().mockImplementation(async (matchId: string) => {
        if (matchId === "M_1") return buildMatch("M_1", 1_000_000_000_000);
        return buildMatch("M_2", 2_000_000_000_000);
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LolService,
        { provide: PrismaService, useValue: prisma },
        { provide: RiotService, useValue: riot },
      ],
    }).compile();

    const service = moduleRef.get(LolService);
    const summaries = await service.getMatchesForSummoner("euw1", "Vyoh", "EUW");

    expect(riot.getAccountByRiotId).toHaveBeenCalledWith("Vyoh", "EUW", "europe");
    expect(riot.getMatchIdsByPuuid).toHaveBeenCalledWith("puuid-vyoh", "europe", {
      count: 10,
    });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(summaries.map((s) => s.matchId)).toEqual(["M_2", "M_1"]);
  });
});
