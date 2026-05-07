import { ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { IdentityService } from "../identity/identity.service";
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
          riotIdGameName: "Vyoh",
          riotIdTagline: "Ahri",
          championName: "Ahri",
          teamId: 100,
          teamPosition: "MIDDLE",
          kills: 1,
          deaths: 2,
          assists: 3,
          win: true,
          item0: 0,
          item1: 0,
          item2: 0,
          item3: 0,
          item4: 0,
          item5: 0,
          item6: 0,
          goldEarned: 0,
          totalDamageDealtToChampions: 0,
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

  const identity = {
    isLolAccountAllowed: vi.fn().mockReturnValue(true),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      LolService,
      { provide: PrismaService, useValue: prisma },
      { provide: RiotService, useValue: riot },
      { provide: IdentityService, useValue: identity },
    ],
  }).compile();

  return {
    service: moduleRef.get(LolService),
    prisma,
    riot,
    identity,
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

  it("rejects accounts that are not in the whitelist", async () => {
    const summoner = makeSummoner(true);
    const { service, identity } = await makeService({
      summoner,
      matchIds: [],
    });
    identity.isLolAccountAllowed.mockReturnValue(false);

    const error = await service
      .getMatchesForSummoner("euw1", "Stranger", "TAG")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
  });

  it("caches the match-IDs list within the TTL window so a repeat call skips Riot", async () => {
    const summoner = makeSummoner(true);
    const matchIds = ["M_1", "M_2"];
    const rowSet = [
      buildRow("M_2", 2_000_000_000_000),
      buildRow("M_1", 1_000_000_000_000),
    ];

    const summonerFindUnique = vi.fn().mockResolvedValue(summoner.value);
    const matchFindMany = vi
      .fn()
      .mockImplementation(async (args: { select?: unknown }) =>
        args.select ? matchIds.map((matchId) => ({ matchId })) : rowSet
      );
    const prisma = {
      summoner: { findUnique: summonerFindUnique, upsert: vi.fn() },
      match: { findMany: matchFindMany, upsert: vi.fn() },
    };
    const riot = {
      getAccountByRiotId: vi.fn(),
      getMatchIdsByPuuid: vi.fn().mockResolvedValue(matchIds),
      getMatchById: vi.fn(),
    };
    const identity = { isLolAccountAllowed: vi.fn().mockReturnValue(true) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LolService,
        { provide: PrismaService, useValue: prisma },
        { provide: RiotService, useValue: riot },
        { provide: IdentityService, useValue: identity },
      ],
    }).compile();
    const service = moduleRef.get(LolService);

    await service.getMatchesForSummoner("euw1", "Vyoh", "EUW");
    await service.getMatchesForSummoner("euw1", "Vyoh", "EUW");

    expect(riot.getMatchIdsByPuuid).toHaveBeenCalledOnce();
  });

  it("serves a smaller window from a larger cached match-IDs result", async () => {
    const summoner = makeSummoner(true);
    const matchIds20 = Array.from({ length: 20 }, (_, i) => `M_${i + 1}`);

    const summonerFindUnique = vi.fn().mockResolvedValue(summoner.value);
    const matchFindMany = vi
      .fn()
      .mockImplementation(async (args: { select?: unknown }) => (args.select ? [] : []));
    const prisma = {
      summoner: { findUnique: summonerFindUnique, upsert: vi.fn() },
      match: { findMany: matchFindMany, upsert: vi.fn() },
    };
    const riot = {
      getAccountByRiotId: vi.fn(),
      getMatchIdsByPuuid: vi.fn().mockResolvedValue(matchIds20),
      getMatchById: vi.fn(),
    };
    const identity = { isLolAccountAllowed: vi.fn().mockReturnValue(true) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LolService,
        { provide: PrismaService, useValue: prisma },
        { provide: RiotService, useValue: riot },
        { provide: IdentityService, useValue: identity },
      ],
    }).compile();
    const service = moduleRef.get(LolService);

    // Prime the cache with 20 IDs, then ask for 10 — should slice from cache.
    await service.getMatchesForSummoner("euw1", "Vyoh", "EUW", 0, 20);
    await service.getMatchesForSummoner("euw1", "Vyoh", "EUW", 0, 10);

    expect(riot.getMatchIdsByPuuid).toHaveBeenCalledOnce();
  });

  it("re-fetches when a wider window is requested after a narrower one", async () => {
    const summoner = makeSummoner(true);

    const summonerFindUnique = vi.fn().mockResolvedValue(summoner.value);
    const matchFindMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      summoner: { findUnique: summonerFindUnique, upsert: vi.fn() },
      match: { findMany: matchFindMany, upsert: vi.fn() },
    };
    const riot = {
      getAccountByRiotId: vi.fn(),
      getMatchIdsByPuuid: vi
        .fn()
        .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => `M_${i + 1}`))
        .mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => `M_${i + 1}`)),
      getMatchById: vi.fn(),
    };
    const identity = { isLolAccountAllowed: vi.fn().mockReturnValue(true) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LolService,
        { provide: PrismaService, useValue: prisma },
        { provide: RiotService, useValue: riot },
        { provide: IdentityService, useValue: identity },
      ],
    }).compile();
    const service = moduleRef.get(LolService);

    // Prime with 10, then ask for 20 — cached prefix isn't long enough.
    await service.getMatchesForSummoner("euw1", "Vyoh", "EUW", 0, 10);
    await service.getMatchesForSummoner("euw1", "Vyoh", "EUW", 0, 20);

    expect(riot.getMatchIdsByPuuid).toHaveBeenCalledTimes(2);
  });

  it("re-fetches when query params differ even within the TTL window", async () => {
    const summoner = makeSummoner(true);
    const matchIds = ["M_1", "M_2"];

    const summonerFindUnique = vi.fn().mockResolvedValue(summoner.value);
    const matchFindMany = vi
      .fn()
      .mockImplementation(async (args: { select?: unknown }) =>
        args.select ? matchIds.map((matchId) => ({ matchId })) : []
      );
    const prisma = {
      summoner: { findUnique: summonerFindUnique, upsert: vi.fn() },
      match: { findMany: matchFindMany, upsert: vi.fn() },
    };
    const riot = {
      getAccountByRiotId: vi.fn(),
      getMatchIdsByPuuid: vi.fn().mockResolvedValue(matchIds),
      getMatchById: vi.fn(),
    };
    const identity = { isLolAccountAllowed: vi.fn().mockReturnValue(true) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LolService,
        { provide: PrismaService, useValue: prisma },
        { provide: RiotService, useValue: riot },
        { provide: IdentityService, useValue: identity },
      ],
    }).compile();
    const service = moduleRef.get(LolService);

    // Same account, different queue filter → must miss the cache.
    await service.getMatchesForSummoner("euw1", "Vyoh", "EUW", 0, 20, 420);
    await service.getMatchesForSummoner("euw1", "Vyoh", "EUW", 0, 20, 440);

    expect(riot.getMatchIdsByPuuid).toHaveBeenCalledTimes(2);
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

describe("LolService.getCachedMatches", () => {
  function makeCachedService({
    summoner,
    rows,
    total,
  }: {
    summoner: ReturnType<typeof makeSummoner> | null;
    rows: ReturnType<typeof buildRow>[];
    total: number;
  }) {
    const summonerFindUnique = vi.fn().mockResolvedValue(summoner?.value ?? null);
    const matchFindMany = vi.fn().mockResolvedValue(rows);
    const matchCount = vi.fn().mockResolvedValue(total);
    const prisma = {
      summoner: { findUnique: summonerFindUnique, upsert: vi.fn() },
      match: { findMany: matchFindMany, count: matchCount, upsert: vi.fn() },
    };
    const riot = {
      getAccountByRiotId: vi.fn(),
      getMatchIdsByPuuid: vi.fn(),
      getMatchById: vi.fn(),
    };
    const identity = { isLolAccountAllowed: vi.fn().mockReturnValue(true) };
    return { prisma, riot, identity };
  }

  async function buildService(overrides: ReturnType<typeof makeCachedService>) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LolService,
        { provide: PrismaService, useValue: overrides.prisma },
        { provide: RiotService, useValue: overrides.riot },
        { provide: IdentityService, useValue: overrides.identity },
      ],
    }).compile();
    return moduleRef.get(LolService);
  }

  it("returns matches from the DB and a total count, never calling Riot", async () => {
    const summoner = makeSummoner(true);
    const overrides = makeCachedService({
      summoner,
      rows: [buildRow("M_2", 2_000_000_000_000), buildRow("M_1", 1_000_000_000_000)],
      total: 18,
    });
    const service = await buildService(overrides);

    const result = await service.getCachedMatches("euw1", "Vyoh", "EUW", 0, 20);

    expect(result.total).toBe(18);
    expect(result.matches.map((m) => m.matchId)).toEqual(["M_2", "M_1"]);
    expect(overrides.riot.getAccountByRiotId).not.toHaveBeenCalled();
    expect(overrides.riot.getMatchIdsByPuuid).not.toHaveBeenCalled();
    expect(overrides.riot.getMatchById).not.toHaveBeenCalled();
  });

  it("returns an empty result when the summoner has never been resolved", async () => {
    const overrides = makeCachedService({
      summoner: null,
      rows: [],
      total: 0,
    });
    const service = await buildService(overrides);

    const result = await service.getCachedMatches("euw1", "NewAccount", "EUW", 0, 20);

    expect(result).toEqual({ matches: [], total: 0 });
    expect(overrides.riot.getAccountByRiotId).not.toHaveBeenCalled();
  });

  it("filters by queue when provided, mapping queue ID to queueType label", async () => {
    const summoner = makeSummoner(true);
    const overrides = makeCachedService({
      summoner,
      rows: [],
      total: 5,
    });
    const service = await buildService(overrides);

    await service.getCachedMatches("euw1", "Vyoh", "EUW", 0, 20, 420);

    expect(overrides.prisma.match.count).toHaveBeenCalledWith({
      where: { puuid: "puuid-vyoh", queueType: "Ranked Solo" },
    });
    expect(overrides.prisma.match.findMany).toHaveBeenCalledWith({
      where: { puuid: "puuid-vyoh", queueType: "Ranked Solo" },
      orderBy: { playedAt: "desc" },
      skip: 0,
      take: 20,
    });
  });

  it("paginates via skip + take when start is non-zero", async () => {
    const summoner = makeSummoner(true);
    const overrides = makeCachedService({ summoner, rows: [], total: 50 });
    const service = await buildService(overrides);

    await service.getCachedMatches("euw1", "Vyoh", "EUW", 20, 10);

    expect(overrides.prisma.match.findMany).toHaveBeenCalledWith({
      where: { puuid: "puuid-vyoh" },
      orderBy: { playedAt: "desc" },
      skip: 20,
      take: 10,
    });
  });

  it("rejects accounts that are not in the whitelist", async () => {
    const summoner = makeSummoner(true);
    const overrides = makeCachedService({ summoner, rows: [], total: 0 });
    overrides.identity.isLolAccountAllowed.mockReturnValue(false);
    const service = await buildService(overrides);

    const error = await service
      .getCachedMatches("euw1", "Stranger", "TAG", 0, 20)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
  });
});
