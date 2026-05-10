import { ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { LolAccount } from "@vyoh/shared";
import { EMPTY, Subject, firstValueFrom, take, toArray } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";
import { RiotService } from "../riot/riot.service";
import type { RiotMatch } from "../riot/types";
import { LiveGamePollerService } from "./live-game-poller.service";
import { LolService } from "./lol.service";
import { MatchEventsService, type MatchUpdatedEvent } from "./match-events.service";

function makeEventsMock() {
  return { emit: vi.fn(), forPuuid: vi.fn(() => EMPTY) };
}

function makeEventsProvider(mock = makeEventsMock()) {
  return { mock, provider: { provide: MatchEventsService, useValue: mock } };
}

function buildMatch(matchId: string, startTs: number): RiotMatch {
  return {
    metadata: { matchId, participants: ["puuid-vyoh"] },
    info: {
      gameStartTimestamp: startTs,
      gameDuration: 1834,
      gameVersion: "14.20.586.5840",
      queueId: 420,
      gameEndedInEarlySurrender: false,
      teams: [],
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
          physicalDamageDealtToChampions: 0,
          magicDamageDealtToChampions: 0,
          trueDamageDealtToChampions: 0,
          totalMinionsKilled: 0,
          neutralMinionsKilled: 0,
          visionScore: 0,
          wardsPlaced: 0,
          wardsKilled: 0,
          detectorWardsPlaced: 0,
          firstBloodKill: false,
          summoner1Id: 0,
          summoner2Id: 0,
          champLevel: 1,
          perks: { styles: [] },
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
    remake: false,
    teamPosition: "MIDDLE",
    snapshotTier: null,
    snapshotRank: null,
    snapshotLp: null,
    laneOpponent: null,
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
  // syncAccountMatches calls count() twice (before + after backfill); getMatchesForSummoner
  // doesn't call it at all. Pre-stub both responses so the helper covers both call sites.
  const matchCount = vi
    .fn()
    .mockResolvedValueOnce(existingMatchIds.length)
    .mockResolvedValueOnce(matchIds.length);
  const matchUpsert = vi.fn().mockResolvedValue(undefined);

  const prisma = {
    summoner: { findUnique: summonerFindUnique, upsert: summonerUpsert },
    match: { findMany: matchFindMany, count: matchCount, upsert: matchUpsert },
    matchDetailCache: { upsert: vi.fn().mockResolvedValue(undefined) },
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

  const events = makeEventsProvider();
  const moduleRef = await Test.createTestingModule({
    providers: [
      LolService,
      { provide: PrismaService, useValue: prisma },
      { provide: RiotService, useValue: riot },
      { provide: IdentityService, useValue: identity },
      events.provider,
      {
        provide: LiveGamePollerService,
        useValue: { getForPuuid: vi.fn().mockReturnValue(null) },
      },
    ],
  }).compile();

  return {
    service: moduleRef.get(LolService),
    prisma,
    riot,
    identity,
    events: events.mock,
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
      .mockImplementation(async (args: { select?: Record<string, boolean> }) =>
        // backfill check: select has only matchId; result fetch: has queueType too
        args.select?.queueType ? rowSet : matchIds.map((matchId) => ({ matchId }))
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
        { provide: MatchEventsService, useValue: makeEventsMock() },
        {
          provide: LiveGamePollerService,
          useValue: { getForPuuid: vi.fn().mockReturnValue(null) },
        },
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
        { provide: MatchEventsService, useValue: makeEventsMock() },
        {
          provide: LiveGamePollerService,
          useValue: { getForPuuid: vi.fn().mockReturnValue(null) },
        },
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
        { provide: MatchEventsService, useValue: makeEventsMock() },
        {
          provide: LiveGamePollerService,
          useValue: { getForPuuid: vi.fn().mockReturnValue(null) },
        },
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
      .mockImplementation(async (args: { select?: Record<string, boolean> }) =>
        args.select?.queueType ? [] : matchIds.map((matchId) => ({ matchId }))
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
        { provide: MatchEventsService, useValue: makeEventsMock() },
        {
          provide: LiveGamePollerService,
          useValue: { getForPuuid: vi.fn().mockReturnValue(null) },
        },
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
        { provide: MatchEventsService, useValue: makeEventsMock() },
        {
          provide: LiveGamePollerService,
          useValue: { getForPuuid: vi.fn().mockReturnValue(null) },
        },
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
      select: {
        matchId: true,
        queueType: true,
        champion: true,
        kills: true,
        deaths: true,
        assists: true,
        win: true,
        durationSec: true,
        playedAt: true,
        remake: true,
        teamPosition: true,
        gameVersion: true,
        visionScore: true,
        damageShare: true,
        firstBloodKill: true,
        csAt10: true,
        csAt15: true,
        goldAt10: true,
        goldAt15: true,
        teamGoldDiffAt15: true,
        deathTimings: true,
        snapshotTier: true,
        snapshotRank: true,
        snapshotLp: true,
        laneOpponent: true,
      },
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
      select: {
        matchId: true,
        queueType: true,
        champion: true,
        kills: true,
        deaths: true,
        assists: true,
        win: true,
        durationSec: true,
        playedAt: true,
        remake: true,
        teamPosition: true,
        gameVersion: true,
        visionScore: true,
        damageShare: true,
        firstBloodKill: true,
        csAt10: true,
        csAt15: true,
        goldAt10: true,
        goldAt15: true,
        teamGoldDiffAt15: true,
        deathTimings: true,
        snapshotTier: true,
        snapshotRank: true,
        snapshotLp: true,
        laneOpponent: true,
      },
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

describe("LolService.syncAccountMatches", () => {
  it("emits a head match-updated event when backfill added rows", async () => {
    const summoner = makeSummoner(true);
    const { service, events } = await makeService({
      summoner,
      matchIds: ["M_1", "M_2"],
      existingMatchIds: [],
      rows: [buildRow("M_2", 2_000_000_000_000), buildRow("M_1", 1_000_000_000_000)],
      riotMatches: {
        M_1: buildMatch("M_1", 1_000_000_000_000),
        M_2: buildMatch("M_2", 2_000_000_000_000),
      },
    });

    await service.syncAccountMatches({
      slug: "ahri",
      region: "euw1",
      gameName: "Vyoh",
      tagLine: "EUW",
    });

    expect(events.emit).toHaveBeenCalledWith({
      puuid: "puuid-vyoh",
      added: 2,
      source: "head",
    });
  });

  it("does not emit when no rows were added", async () => {
    const summoner = makeSummoner(true);
    const { service, events } = await makeService({
      summoner,
      matchIds: ["M_1", "M_2"],
      existingMatchIds: ["M_1", "M_2"],
      rows: [buildRow("M_2", 2_000_000_000_000), buildRow("M_1", 1_000_000_000_000)],
    });

    await service.syncAccountMatches({
      slug: "ahri",
      region: "euw1",
      gameName: "Vyoh",
      tagLine: "EUW",
    });

    expect(events.emit).not.toHaveBeenCalled();
  });
});

describe("LolService.subscribeToMatchEvents", () => {
  async function buildSubscribeService(opts: {
    summoner: { puuid: string } | null;
    whitelisted?: boolean;
    eventStream?: Subject<MatchUpdatedEvent>;
  }) {
    const summonerFindUnique = vi.fn().mockResolvedValue(
      opts.summoner
        ? {
            puuid: opts.summoner.puuid,
            gameName: "Vyoh",
            tagLine: "Ahri",
            region: "euw1",
            fetchedAt: new Date(),
            historicalDoneAt: null,
          }
        : null
    );
    const prisma = {
      summoner: { findUnique: summonerFindUnique, upsert: vi.fn(), update: vi.fn() },
      match: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        upsert: vi.fn(),
      },
    };
    const riot = {
      getAccountByRiotId: vi.fn(),
      getMatchIdsByPuuid: vi.fn(),
      getMatchById: vi.fn(),
    };
    const identity = {
      isLolAccountAllowed: vi.fn().mockReturnValue(opts.whitelisted ?? true),
    };
    const stream = opts.eventStream ?? new Subject<MatchUpdatedEvent>();
    const eventsMock = {
      emit: vi.fn(),
      forPuuid: vi.fn(() => stream.asObservable()),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LolService,
        { provide: PrismaService, useValue: prisma },
        { provide: RiotService, useValue: riot },
        { provide: IdentityService, useValue: identity },
        { provide: MatchEventsService, useValue: eventsMock },
        {
          provide: LiveGamePollerService,
          useValue: { getForPuuid: vi.fn().mockReturnValue(null) },
        },
      ],
    }).compile();
    return { service: moduleRef.get(LolService), stream, eventsMock };
  }

  it("throws ForbiddenException when the account is not whitelisted", async () => {
    const { service } = await buildSubscribeService({
      summoner: { puuid: "puuid-vyoh" },
      whitelisted: false,
    });

    const error = await service
      .subscribeToMatchEvents("euw1", "Stranger", "TAG")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
  });

  it("forwards match-updated events for the resolved puuid", async () => {
    const stream = new Subject<MatchUpdatedEvent>();
    const { service } = await buildSubscribeService({
      summoner: { puuid: "puuid-vyoh" },
      eventStream: stream,
    });

    const observable = await service.subscribeToMatchEvents("euw1", "Vyoh", "Ahri");
    const firstMessage = firstValueFrom(observable.pipe(take(1)));

    stream.next({ puuid: "puuid-vyoh", added: 4, source: "historical" });

    const message = await firstMessage;
    expect(message).toEqual({
      type: "match-updated",
      data: { puuid: "puuid-vyoh", added: 4, source: "historical" },
    });
  });

  it("returns a heartbeat-only stream when the summoner has not been resolved", async () => {
    const stream = new Subject<MatchUpdatedEvent>();
    const { service, eventsMock } = await buildSubscribeService({
      summoner: null,
      eventStream: stream,
    });

    await service.subscribeToMatchEvents("euw1", "NewAccount", "EUW");

    // No puuid — the service should not bother subscribing to the events bus.
    expect(eventsMock.forPuuid).not.toHaveBeenCalled();
  });
});

describe("LolService.syncAccountHistorical", () => {
  type HistoricalDeps = {
    summoner: {
      puuid: string;
      historicalDoneAt: Date | null;
    } | null;
    oldest: { playedAt: Date } | null;
    riotIds?: string[];
    countsBefore?: number;
    // Count returned for the hasNewer check (phase 2). 0 = no newer game →
    // snapshot will be attached; >0 = newer game exists → no snapshot.
    hasNewerCount?: number;
    countsAfter?: number;
  };

  async function buildHistoricalService(deps: HistoricalDeps) {
    const summonerFindUnique = vi.fn().mockResolvedValue(
      deps.summoner
        ? {
            puuid: deps.summoner.puuid,
            gameName: "Vyoh",
            tagLine: "Ahri",
            region: "euw1",
            fetchedAt: new Date(),
            historicalDoneAt: deps.summoner.historicalDoneAt,
          }
        : null
    );
    const summonerUpdate = vi.fn().mockResolvedValue(undefined);
    const matchFindFirst = vi.fn().mockResolvedValue(deps.oldest);
    const matchFindMany = vi.fn().mockResolvedValue([]);
    // Three count() calls when there are ranked matches to process:
    //   1. before backfill
    //   2. hasNewer check inside backfillMissingMatches (one per ranked queue)
    //   3. after backfill
    // Tests that return early (no riotIds) only hit call 1+3 or none at all.
    const matchCount = vi
      .fn()
      .mockResolvedValueOnce(deps.countsBefore ?? 0)
      .mockResolvedValueOnce(deps.hasNewerCount ?? 0)
      .mockResolvedValueOnce(deps.countsAfter ?? 0);
    const matchUpsert = vi.fn().mockResolvedValue(undefined);

    const prisma = {
      summoner: {
        findUnique: summonerFindUnique,
        upsert: vi.fn(),
        update: summonerUpdate,
      },
      match: {
        findFirst: matchFindFirst,
        findMany: matchFindMany,
        count: matchCount,
        upsert: matchUpsert,
      },
      matchDetailCache: { upsert: vi.fn().mockResolvedValue(undefined) },
      rankSnapshot: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const riot = {
      getAccountByRiotId: vi.fn(),
      getMatchIdsByPuuid: vi.fn().mockResolvedValue(deps.riotIds ?? []),
      getMatchById: vi.fn().mockResolvedValue(buildMatch("X", 0)),
    };
    const identity = { isLolAccountAllowed: vi.fn().mockReturnValue(true) };
    const events = makeEventsProvider();

    const moduleRef = await Test.createTestingModule({
      providers: [
        LolService,
        { provide: PrismaService, useValue: prisma },
        { provide: RiotService, useValue: riot },
        { provide: IdentityService, useValue: identity },
        events.provider,
        {
          provide: LiveGamePollerService,
          useValue: { getForPuuid: vi.fn().mockReturnValue(null) },
        },
      ],
    }).compile();
    return {
      service: moduleRef.get(LolService),
      prisma,
      riot,
      identity,
      events: events.mock,
    };
  }

  const account: LolAccount = {
    slug: "ahri",
    region: "euw1",
    gameName: "Vyoh",
    tagLine: "Ahri",
  };

  it("skips when the account isn't whitelisted", async () => {
    const { service, riot, identity } = await buildHistoricalService({
      summoner: { puuid: "puuid-vyoh", historicalDoneAt: null },
      oldest: { playedAt: new Date(2_000_000_000_000) },
    });
    identity.isLolAccountAllowed.mockReturnValue(false);

    const result = await service.syncAccountHistorical(account);

    expect(result).toEqual({ idCount: 0, backfilled: 0, done: false, skipped: true });
    expect(riot.getMatchIdsByPuuid).not.toHaveBeenCalled();
  });

  it("skips when the summoner row doesn't exist yet", async () => {
    const { service, riot } = await buildHistoricalService({
      summoner: null,
      oldest: null,
    });

    const result = await service.syncAccountHistorical(account);

    expect(result.skipped).toBe(true);
    expect(result.done).toBe(false);
    expect(riot.getMatchIdsByPuuid).not.toHaveBeenCalled();
  });

  it("skips and reports done when historicalDoneAt is set", async () => {
    const { service, riot } = await buildHistoricalService({
      summoner: { puuid: "puuid-vyoh", historicalDoneAt: new Date() },
      oldest: { playedAt: new Date(2_000_000_000_000) },
    });

    const result = await service.syncAccountHistorical(account);

    expect(result).toEqual({ idCount: 0, backfilled: 0, done: true, skipped: true });
    expect(riot.getMatchIdsByPuuid).not.toHaveBeenCalled();
  });

  it("skips when no matches are in the DB yet (head sync hasn't filled anything)", async () => {
    const { service, riot } = await buildHistoricalService({
      summoner: { puuid: "puuid-vyoh", historicalDoneAt: null },
      oldest: null,
    });

    const result = await service.syncAccountHistorical(account);

    expect(result.skipped).toBe(true);
    expect(riot.getMatchIdsByPuuid).not.toHaveBeenCalled();
  });

  it("asks Riot for matches strictly older than the oldest DB match (endTime exclusive)", async () => {
    const oldestMs = 2_000_000_000_000;
    const { service, riot } = await buildHistoricalService({
      summoner: { puuid: "puuid-vyoh", historicalDoneAt: null },
      oldest: { playedAt: new Date(oldestMs) },
      riotIds: Array.from({ length: 20 }, (_, i) => `H_${i + 1}`),
      countsBefore: 0,
      countsAfter: 20,
    });

    const result = await service.syncAccountHistorical(account);

    const expectedEndTime = Math.floor(oldestMs / 1000) - 1;
    expect(riot.getMatchIdsByPuuid).toHaveBeenCalledWith("puuid-vyoh", "europe", {
      endTime: expectedEndTime,
      count: 20,
    });
    expect(result).toEqual({
      idCount: 20,
      backfilled: 20,
      done: false,
      skipped: false,
    });
  });

  it("emits a match-updated event when historical backfill added rows", async () => {
    const { service, events } = await buildHistoricalService({
      summoner: { puuid: "puuid-vyoh", historicalDoneAt: null },
      oldest: { playedAt: new Date(2_000_000_000_000) },
      riotIds: Array.from({ length: 20 }, (_, i) => `H_${i + 1}`),
      countsBefore: 0,
      countsAfter: 20,
    });

    await service.syncAccountHistorical(account);

    expect(events.emit).toHaveBeenCalledWith({
      puuid: "puuid-vyoh",
      added: 20,
      source: "historical",
    });
  });

  it("does not emit when nothing was backfilled", async () => {
    const { service, events } = await buildHistoricalService({
      summoner: { puuid: "puuid-vyoh", historicalDoneAt: null },
      oldest: { playedAt: new Date(2_000_000_000_000) },
      riotIds: ["H_1"],
      countsBefore: 1,
      countsAfter: 1,
    });

    await service.syncAccountHistorical(account);

    expect(events.emit).not.toHaveBeenCalled();
  });

  it("marks the summoner done when Riot returns a short page", async () => {
    const { service, prisma } = await buildHistoricalService({
      summoner: { puuid: "puuid-vyoh", historicalDoneAt: null },
      oldest: { playedAt: new Date(2_000_000_000_000) },
      riotIds: ["H_last_1", "H_last_2"],
      countsBefore: 0,
      countsAfter: 2,
    });

    const result = await service.syncAccountHistorical(account);

    expect(result.done).toBe(true);
    expect(result.skipped).toBe(false);
    expect(prisma.summoner.update).toHaveBeenCalledWith({
      where: { puuid: "puuid-vyoh" },
      data: { historicalDoneAt: expect.any(Date) },
    });
  });

  it("does not mark done when Riot returns a full page", async () => {
    const { service, prisma } = await buildHistoricalService({
      summoner: { puuid: "puuid-vyoh", historicalDoneAt: null },
      oldest: { playedAt: new Date(2_000_000_000_000) },
      riotIds: Array.from({ length: 20 }, (_, i) => `H_${i + 1}`),
      countsBefore: 0,
      countsAfter: 20,
    });

    const result = await service.syncAccountHistorical(account);

    expect(result.done).toBe(false);
    expect(prisma.summoner.update).not.toHaveBeenCalled();
  });

  it("attaches snapshot to the newest ranked match when no newer game is in DB", async () => {
    const { service, prisma } = await buildHistoricalService({
      summoner: { puuid: "puuid-vyoh", historicalDoneAt: null },
      oldest: { playedAt: new Date(2_000_000_000_000) },
      riotIds: ["H_1"],
      countsBefore: 0,
      hasNewerCount: 0, // no newer DB game → snapshot should be attached
      countsAfter: 1,
    });
    prisma.rankSnapshot.findFirst.mockResolvedValue({
      tier: "GOLD",
      rank: "I",
      leaguePoints: 75,
    });

    await service.syncAccountHistorical(account);

    expect(prisma.match.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          snapshotTier: "GOLD",
          snapshotRank: "I",
          snapshotLp: 75,
        }),
      })
    );
  });

  it("does not attach snapshot when a newer game already exists in DB for that queue", async () => {
    const { service, prisma } = await buildHistoricalService({
      summoner: { puuid: "puuid-vyoh", historicalDoneAt: null },
      oldest: { playedAt: new Date(2_000_000_000_000) },
      riotIds: ["H_1"],
      countsBefore: 0,
      hasNewerCount: 1, // newer DB game exists → skip snapshot
      countsAfter: 1,
    });
    prisma.rankSnapshot.findFirst.mockResolvedValue({
      tier: "GOLD",
      rank: "I",
      leaguePoints: 75,
    });

    await service.syncAccountHistorical(account);

    expect(prisma.rankSnapshot.findFirst).not.toHaveBeenCalled();
    expect(prisma.match.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          snapshotTier: undefined,
          snapshotRank: undefined,
          snapshotLp: undefined,
        }),
      })
    );
  });
});

describe("LolService.syncForSummoner", () => {
  it("rejects accounts that are not in the whitelist", async () => {
    const prisma = {
      summoner: { findUnique: vi.fn(), upsert: vi.fn() },
      match: { findMany: vi.fn(), count: vi.fn(), upsert: vi.fn() },
    };
    const riot = {
      getAccountByRiotId: vi.fn(),
      getMatchIdsByPuuid: vi.fn(),
      getMatchById: vi.fn(),
    };
    const identity = { isLolAccountAllowed: vi.fn().mockReturnValue(false) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LolService,
        { provide: PrismaService, useValue: prisma },
        { provide: RiotService, useValue: riot },
        { provide: IdentityService, useValue: identity },
        { provide: MatchEventsService, useValue: makeEventsMock() },
        {
          provide: LiveGamePollerService,
          useValue: { getForPuuid: vi.fn().mockReturnValue(null) },
        },
      ],
    }).compile();
    const service = moduleRef.get(LolService);

    const error = await service
      .syncForSummoner("euw1", "Stranger", "TAG")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect(riot.getAccountByRiotId).not.toHaveBeenCalled();
  });

  it("delegates to syncAccountMatches for whitelisted accounts and reports the result", async () => {
    const summoner = makeSummoner(true);
    const matchIds = ["M_1", "M_2", "M_3"];
    const summonerFindUnique = vi.fn().mockResolvedValue(summoner.value);
    const matchFindMany = vi
      .fn()
      .mockImplementationOnce(async () => [{ matchId: "M_1" }])
      .mockImplementationOnce(async () => [
        buildRow("M_3", 3_000_000_000_000),
        buildRow("M_2", 2_000_000_000_000),
        buildRow("M_1", 1_000_000_000_000),
      ]);
    const matchCount = vi
      .fn()
      .mockResolvedValueOnce(1) // before backfill
      .mockResolvedValueOnce(3); // after backfill
    const prisma = {
      summoner: { findUnique: summonerFindUnique, upsert: vi.fn() },
      match: { findMany: matchFindMany, count: matchCount, upsert: vi.fn() },
    };
    const riot = {
      getAccountByRiotId: vi.fn(),
      getMatchIdsByPuuid: vi.fn().mockResolvedValue(matchIds),
      getMatchById: vi.fn().mockImplementation(async (id: string) => buildMatch(id, 0)),
    };
    const identity = { isLolAccountAllowed: vi.fn().mockReturnValue(true) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LolService,
        { provide: PrismaService, useValue: prisma },
        { provide: RiotService, useValue: riot },
        { provide: IdentityService, useValue: identity },
        { provide: MatchEventsService, useValue: makeEventsMock() },
        {
          provide: LiveGamePollerService,
          useValue: { getForPuuid: vi.fn().mockReturnValue(null) },
        },
      ],
    }).compile();
    const service = moduleRef.get(LolService);

    const result = await service.syncForSummoner("euw1", "Vyoh", "Ahri");

    expect(result).toEqual({ idCount: 3, backfilled: 2 });
    expect(riot.getMatchIdsByPuuid).toHaveBeenCalledOnce();
  });
});
