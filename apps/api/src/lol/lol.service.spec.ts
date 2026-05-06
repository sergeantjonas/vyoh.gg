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

function buildRow(matchId: string, playedAtMs: number) {
  return {
    matchId,
    puuid: "puuid-vyoh",
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 1,
    deaths: 2,
    assists: 3,
    win: true,
    durationSec: 1834,
    playedAt: new Date(playedAtMs),
  };
}

async function makeService({
  summoner,
  matchIds = ["M_1", "M_2"],
  existingMatchIds = [],
  rows = [],
  riotMatches = {},
}: {
  summoner: ReturnType<typeof makeSummoner>;
  matchIds?: string[];
  existingMatchIds?: string[];
  rows?: ReturnType<typeof buildRow>[];
  riotMatches?: Record<string, RiotMatch>;
}) {
  const summonerUpsert = vi.fn().mockImplementation(async () => summoner.value);
  const summonerFindUnique = vi
    .fn()
    .mockResolvedValue(summoner.cached ? summoner.value : null);
  const matchFindMany = vi
    .fn()
    .mockImplementationOnce(async () => existingMatchIds.map((matchId) => ({ matchId })))
    .mockImplementationOnce(async () => rows);
  const matchUpsert = vi.fn().mockResolvedValue(undefined);

  const prisma = {
    summoner: { findUnique: summonerFindUnique, upsert: summonerUpsert },
    match: { findMany: matchFindMany, upsert: matchUpsert },
  };
  const riot = {
    getAccountByRiotId: vi.fn().mockResolvedValue({
      puuid: summoner.value.puuid,
      gameName: "Vyoh",
      tagLine: "EUW",
    }),
    getMatchIdsByPuuid: vi.fn().mockResolvedValue(matchIds),
    getMatchById: vi.fn().mockImplementation(async (id: string) => riotMatches[id]),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      LolService,
      { provide: PrismaService, useValue: prisma },
      { provide: RiotService, useValue: riot },
    ],
  }).compile();

  return {
    service: moduleRef.get(LolService),
    prisma,
    riot,
  };
}

function makeSummoner(cached: boolean) {
  return {
    cached,
    value: {
      puuid: "puuid-vyoh",
      gameName: "Vyoh",
      tagLine: "EUW",
      region: "euw1",
      fetchedAt: new Date(),
    },
  };
}

describe("LolService.getMatchesForSummoner", () => {
  it("on first lookup, fetches account, persists summoner, backfills all matches", async () => {
    const summoner = makeSummoner(false);
    const { service, riot, prisma } = await makeService({
      summoner,
      matchIds: ["M_1", "M_2"],
      existingMatchIds: [],
      rows: [buildRow("M_2", 2_000_000_000_000), buildRow("M_1", 1_000_000_000_000)],
      riotMatches: {
        M_1: buildMatch("M_1", 1_000_000_000_000),
        M_2: buildMatch("M_2", 2_000_000_000_000),
      },
    });

    const result = await service.getMatchesForSummoner("euw1", "Vyoh", "EUW");

    expect(riot.getAccountByRiotId).toHaveBeenCalledOnce();
    expect(prisma.summoner.upsert).toHaveBeenCalledOnce();
    expect(riot.getMatchById).toHaveBeenCalledTimes(2);
    expect(prisma.match.upsert).toHaveBeenCalledTimes(2);
    expect(result.map((r) => r.matchId)).toEqual(["M_2", "M_1"]);
  });

  it("with cached summoner and all matches in db, skips account fetch and backfill", async () => {
    const summoner = makeSummoner(true);
    const { service, riot, prisma } = await makeService({
      summoner,
      matchIds: ["M_1", "M_2"],
      existingMatchIds: ["M_1", "M_2"],
      rows: [buildRow("M_2", 2_000_000_000_000), buildRow("M_1", 1_000_000_000_000)],
    });

    const result = await service.getMatchesForSummoner("euw1", "Vyoh", "EUW");

    expect(riot.getAccountByRiotId).not.toHaveBeenCalled();
    expect(prisma.summoner.upsert).not.toHaveBeenCalled();
    expect(riot.getMatchById).not.toHaveBeenCalled();
    expect(prisma.match.upsert).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("with cached summoner and some new matches, only backfills missing", async () => {
    const summoner = makeSummoner(true);
    const { service, riot, prisma } = await makeService({
      summoner,
      matchIds: ["M_1", "M_2", "M_3"],
      existingMatchIds: ["M_1"],
      rows: [
        buildRow("M_3", 3_000_000_000_000),
        buildRow("M_2", 2_000_000_000_000),
        buildRow("M_1", 1_000_000_000_000),
      ],
      riotMatches: {
        M_2: buildMatch("M_2", 2_000_000_000_000),
        M_3: buildMatch("M_3", 3_000_000_000_000),
      },
    });

    await service.getMatchesForSummoner("euw1", "Vyoh", "EUW");

    expect(riot.getAccountByRiotId).not.toHaveBeenCalled();
    expect(riot.getMatchById).toHaveBeenCalledTimes(2);
    expect(riot.getMatchById).toHaveBeenCalledWith("M_2", "europe");
    expect(riot.getMatchById).toHaveBeenCalledWith("M_3", "europe");
    expect(prisma.match.upsert).toHaveBeenCalledTimes(2);
  });
});
