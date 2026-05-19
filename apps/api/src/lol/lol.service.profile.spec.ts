import { ForbiddenException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IdentityService } from "../identity/identity.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { RiotService } from "../riot/riot.service";
import type { LiveGamePollerService } from "./live-game-poller.service";
import { LolService } from "./lol.service";
import type { MatchEventsService } from "./match-events.service";

function makeService(opts: {
  identityAllows?: boolean;
  summoner?: unknown;
  snapshots?: unknown[];
  rankEntries?: unknown[];
}) {
  const prisma = {
    summoner: { findUnique: vi.fn().mockResolvedValue(opts.summoner ?? null) },
    rankSnapshot: {
      findFirst: vi
        .fn()
        .mockImplementationOnce(async () => opts.snapshots?.[0] ?? null)
        .mockImplementationOnce(async () => opts.snapshots?.[1] ?? null),
      findMany: vi.fn().mockResolvedValue(opts.snapshots ?? []),
      create: vi.fn().mockResolvedValue(undefined),
    },
  };
  const riot = {
    getLeagueEntriesByPuuid: vi.fn().mockResolvedValue(opts.rankEntries ?? []),
  };
  const identity = {
    isLolAccountAllowed: vi.fn().mockReturnValue(opts.identityAllows ?? true),
  };

  return {
    service: new LolService(
      prisma as unknown as PrismaService,
      riot as unknown as RiotService,
      identity as unknown as IdentityService,
      {} as MatchEventsService,
      {} as LiveGamePollerService
    ),
    prisma,
    riot,
    identity,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LolService.getSummonerProfile", () => {
  it("rejects accounts that are not in the identity whitelist", async () => {
    const { service } = makeService({ identityAllows: false });
    await expect(service.getSummonerProfile("euw1", "Bot", "EUW")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("returns an empty profile when no summoner row exists", async () => {
    const { service } = makeService({ summoner: null });
    const result = await service.getSummonerProfile("euw1", "Vyoh", "EUW");
    expect(result).toEqual({
      profileIconId: null,
      summonerLevel: null,
      rankEntries: [],
    });
  });

  it("returns the profile + rank entries when a summoner has rank snapshots", async () => {
    const { service } = makeService({
      summoner: {
        puuid: "p1",
        profileIconId: 7,
        summonerLevel: 200,
      },
      snapshots: [
        {
          queueId: "RANKED_SOLO_5x5",
          tier: "GOLD",
          rank: "II",
          leaguePoints: 50,
          wins: 100,
          losses: 80,
          hotStreak: false,
        },
        null,
      ],
    });
    const result = await service.getSummonerProfile("euw1", "Vyoh", "EUW");
    expect(result.profileIconId).toBe(7);
    expect(result.summonerLevel).toBe(200);
    expect(result.rankEntries).toHaveLength(1);
    expect(result.rankEntries[0]?.queueId).toBe("RANKED_SOLO_5x5");
  });
});

describe("LolService.getRankHistory", () => {
  it("rejects accounts not in the whitelist", async () => {
    const { service } = makeService({ identityAllows: false });
    await expect(service.getRankHistory("euw1", "Bot", "EUW")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("returns empty arrays when no summoner row exists", async () => {
    const { service } = makeService({ summoner: null });
    const result = await service.getRankHistory("euw1", "Vyoh", "EUW");
    expect(result).toEqual({ solo: [], flex: [] });
  });

  it("partitions snapshots into solo + flex by queueId", async () => {
    const now = new Date("2026-05-01T00:00:00Z");
    const { service } = makeService({
      summoner: { puuid: "p1" },
      snapshots: [
        {
          capturedAt: now,
          queueId: "RANKED_SOLO_5x5",
          tier: "GOLD",
          rank: "II",
          leaguePoints: 50,
        },
        {
          capturedAt: now,
          queueId: "RANKED_FLEX_SR",
          tier: "SILVER",
          rank: "I",
          leaguePoints: 80,
        },
        {
          capturedAt: now,
          queueId: "RANKED_TFT",
          tier: "PLATINUM",
          rank: "IV",
          leaguePoints: 5,
        },
      ],
    });
    const result = await service.getRankHistory("euw1", "Vyoh", "EUW");
    expect(result.solo).toHaveLength(1);
    expect(result.flex).toHaveLength(1);
    // TFT entry is silently dropped
  });

  it("applies the days filter as capturedAt >= (now - days*86400000)", async () => {
    const { service, prisma } = makeService({
      summoner: { puuid: "p1" },
      snapshots: [],
    });
    await service.getRankHistory("euw1", "Vyoh", "EUW", 30);
    const arg = prisma.rankSnapshot.findMany.mock.calls[0]?.[0] as
      | { where: { capturedAt?: { gte: Date } } }
      | undefined;
    expect(arg?.where.capturedAt).toBeDefined();
  });

  it("omits the capturedAt filter when days is undefined", async () => {
    const { service, prisma } = makeService({
      summoner: { puuid: "p1" },
      snapshots: [],
    });
    await service.getRankHistory("euw1", "Vyoh", "EUW");
    const arg = prisma.rankSnapshot.findMany.mock.calls[0]?.[0] as
      | { where: { capturedAt?: unknown } }
      | undefined;
    expect(arg?.where.capturedAt).toBeUndefined();
  });
});

describe("LolService.getLiveGame", () => {
  it("throws when the account isn't whitelisted", async () => {
    const { service } = makeService({ identityAllows: false });
    await expect(service.getLiveGame("euw1", "Bot", "EUW")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("returns null when no summoner row exists", async () => {
    const { service } = makeService({ summoner: null });
    const result = await service.getLiveGame("euw1", "Vyoh", "EUW");
    expect(result).toBeNull();
  });

  it("delegates to livePoller when a summoner exists", async () => {
    const prisma = {
      summoner: { findUnique: vi.fn().mockResolvedValue({ puuid: "p1" }) },
    };
    const live = { getForPuuid: vi.fn().mockReturnValue({ matchId: "G_1" }) };
    const identity = { isLolAccountAllowed: vi.fn().mockReturnValue(true) };
    const service = new LolService(
      prisma as unknown as PrismaService,
      {} as RiotService,
      identity as unknown as IdentityService,
      {} as MatchEventsService,
      live as unknown as LiveGamePollerService
    );
    const result = await service.getLiveGame("euw1", "Vyoh", "EUW");
    expect(live.getForPuuid).toHaveBeenCalledWith("p1");
    expect(result).toEqual({ matchId: "G_1" });
  });
});

describe("LolService.captureRankSnapshot", () => {
  it("no-ops when no summoner row exists", async () => {
    const { service, riot } = makeService({ summoner: null });
    await service.captureRankSnapshot({
      slug: "ahri",
      region: "euw1",
      gameName: "Vyoh",
      tagLine: "EUW",
    });
    expect(riot.getLeagueEntriesByPuuid).not.toHaveBeenCalled();
  });

  it("skips entries that are not RANKED_SOLO_5x5 or RANKED_FLEX_SR", async () => {
    const { service, prisma } = makeService({
      summoner: { puuid: "p1" },
      rankEntries: [
        { queueType: "RANKED_TFT", tier: "GOLD", rank: "IV", leaguePoints: 10 },
      ],
    });
    await service.captureRankSnapshot({
      slug: "ahri",
      region: "euw1",
      gameName: "Vyoh",
      tagLine: "EUW",
    });
    expect(prisma.rankSnapshot.create).not.toHaveBeenCalled();
  });
});
