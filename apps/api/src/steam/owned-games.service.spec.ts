import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { SteamAchievementSchemaService } from "./achievement-schema.service";
import type { SteamEnrichmentService } from "./enrichment.service";
import type { SteamGlobalRarityService } from "./global-rarity.service";
import { SteamOwnedGamesService, diffOwnedGames } from "./owned-games.service";
import type { SteamPlayerUnlocksService } from "./player-unlocks.service";
import type { SteamClientService } from "./steam-client.service";
import type { SteamOwnedGameRaw } from "./types";

function game(appid: number, name = `Game ${appid}`): SteamOwnedGameRaw {
  return { appid, name, playtime_forever: 0 };
}

interface PrismaStubs {
  steamOwnedGame: { count: ReturnType<typeof vi.fn> };
  steamPlaytimeSnapshot: {
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  steamGameEnrichment?: {
    findMany: ReturnType<typeof vi.fn>;
  };
}

function makeService(prisma: PrismaStubs): SteamOwnedGamesService {
  return new SteamOwnedGamesService(
    prisma as unknown as PrismaService,
    {} as SteamClientService,
    {} as SteamEnrichmentService,
    {} as SteamAchievementSchemaService,
    {} as SteamPlayerUnlocksService,
    {} as SteamGlobalRarityService
  );
}

describe("diffOwnedGames", () => {
  it("flags every game as added when the previous set is empty", () => {
    const diff = diffOwnedGames([game(1), game(2)], []);
    expect(diff).toEqual({
      added: [1, 2],
      persisted: [],
      reappeared: [],
      removed: [],
    });
  });

  it("flags overlap as persisted, new ids as added, gone ids as removed", () => {
    const previous = [
      { appid: 1, removedAt: null },
      { appid: 2, removedAt: null },
    ];
    const diff = diffOwnedGames([game(2), game(3)], previous);
    expect(diff).toEqual({
      added: [3],
      persisted: [2],
      reappeared: [],
      removed: [1],
    });
  });

  it("classifies a previously-removed game returning as reappeared, not added", () => {
    const previous = [{ appid: 1, removedAt: new Date("2026-01-01") }];
    const diff = diffOwnedGames([game(1)], previous);
    expect(diff).toEqual({
      added: [],
      persisted: [],
      reappeared: [1],
      removed: [],
    });
  });

  it("does not re-flag an already-removed game as removed again", () => {
    const previous = [
      { appid: 1, removedAt: null },
      { appid: 2, removedAt: new Date("2026-01-01") },
    ];
    const diff = diffOwnedGames([game(1)], previous);
    expect(diff.removed).toEqual([]);
    expect(diff.persisted).toEqual([1]);
  });
});

describe("SteamOwnedGamesService.getLibrarySummary", () => {
  it("returns a never-synced shape when no snapshots exist yet", async () => {
    const prisma: PrismaStubs = {
      steamOwnedGame: { count: vi.fn().mockResolvedValue(0) },
      steamPlaytimeSnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn(),
      },
    };

    await expect(makeService(prisma).getLibrarySummary()).resolves.toEqual({
      ownedCount: 0,
      everLaunchedCount: 0,
      untouchedCount: 0,
      lastSyncedAt: null,
    });
    expect(prisma.steamPlaytimeSnapshot.count).not.toHaveBeenCalled();
  });

  it("treats every owned game as untouched when the latest snapshot has zero playtime", async () => {
    const snapshotDate = new Date("2026-05-16T00:00:00.000Z");
    const prisma: PrismaStubs = {
      steamOwnedGame: { count: vi.fn().mockResolvedValue(5) },
      steamPlaytimeSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ snapshotDate }),
        count: vi.fn().mockResolvedValue(0),
        aggregate: vi.fn(),
        findMany: vi.fn(),
      },
    };

    await expect(makeService(prisma).getLibrarySummary()).resolves.toEqual({
      ownedCount: 5,
      everLaunchedCount: 0,
      untouchedCount: 5,
      lastSyncedAt: snapshotDate.toISOString(),
    });
  });

  it("derives untouchedCount from owned − everLaunched on the latest snapshot", async () => {
    const snapshotDate = new Date("2026-05-16T00:00:00.000Z");
    const prisma: PrismaStubs = {
      steamOwnedGame: { count: vi.fn().mockResolvedValue(142) },
      steamPlaytimeSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ snapshotDate }),
        count: vi.fn().mockResolvedValue(88),
        aggregate: vi.fn(),
        findMany: vi.fn(),
      },
    };

    const summary = await makeService(prisma).getLibrarySummary();
    expect(summary).toEqual({
      ownedCount: 142,
      everLaunchedCount: 88,
      untouchedCount: 54,
      lastSyncedAt: snapshotDate.toISOString(),
    });
    // Scope: ever-launched count must filter both `playtimeForeverMinutes > 0`
    // and `game.removedAt: null`. Verifies the query shape so a future refactor
    // can't accidentally pull refunded titles back into the counter.
    expect(prisma.steamPlaytimeSnapshot.count).toHaveBeenCalledWith({
      where: {
        snapshotDate,
        playtimeForeverMinutes: { gt: 0 },
        game: { removedAt: null },
      },
    });
  });

  it("clamps untouchedCount at 0 when stale snapshot rows out-number the current owned set", async () => {
    // Defensive case: a refund-and-rebuy churn pattern can leave the latest
    // snapshot with rows whose `game.removedAt` flipped after the snapshot
    // was written, so the launched-count read could nominally exceed the
    // currently-owned count. The Math.max guard keeps the projection sane.
    const snapshotDate = new Date("2026-05-16T00:00:00.000Z");
    const prisma: PrismaStubs = {
      steamOwnedGame: { count: vi.fn().mockResolvedValue(2) },
      steamPlaytimeSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ snapshotDate }),
        count: vi.fn().mockResolvedValue(5),
        aggregate: vi.fn(),
        findMany: vi.fn(),
      },
    };

    const summary = await makeService(prisma).getLibrarySummary();
    expect(summary.untouchedCount).toBe(0);
  });
});

describe("SteamOwnedGamesService.getPlatformMix", () => {
  function aggregateResult(sums: {
    windows?: number | null;
    mac?: number | null;
    linux?: number | null;
    deck?: number | null;
  }) {
    return {
      _sum: {
        playtimeWindowsMinutes: sums.windows ?? null,
        playtimeMacMinutes: sums.mac ?? null,
        playtimeLinuxMinutes: sums.linux ?? null,
        playtimeDeckMinutes: sums.deck ?? null,
      },
    };
  }

  it("returns a never-synced shape when no snapshots exist yet", async () => {
    const prisma: PrismaStubs = {
      steamOwnedGame: { count: vi.fn() },
      steamPlaytimeSnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn(),
      },
    };

    await expect(makeService(prisma).getPlatformMix()).resolves.toEqual({
      totalMinutes: 0,
      windowsMinutes: 0,
      macMinutes: 0,
      linuxMinutes: 0,
      deckMinutes: 0,
      dominantPlatform: null,
      lastSyncedAt: null,
    });
    expect(prisma.steamPlaytimeSnapshot.aggregate).not.toHaveBeenCalled();
  });

  it("coerces null Prisma sums to zero and reports dominantPlatform null when nothing played", async () => {
    const snapshotDate = new Date("2026-05-16T00:00:00.000Z");
    const prisma: PrismaStubs = {
      steamOwnedGame: { count: vi.fn() },
      steamPlaytimeSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ snapshotDate }),
        count: vi.fn(),
        aggregate: vi.fn().mockResolvedValue(aggregateResult({})),
        findMany: vi.fn(),
      },
    };

    await expect(makeService(prisma).getPlatformMix()).resolves.toEqual({
      totalMinutes: 0,
      windowsMinutes: 0,
      macMinutes: 0,
      linuxMinutes: 0,
      deckMinutes: 0,
      dominantPlatform: null,
      lastSyncedAt: snapshotDate.toISOString(),
    });
  });

  it("picks the largest-minutes platform as dominantPlatform", async () => {
    const snapshotDate = new Date("2026-05-16T00:00:00.000Z");
    const prisma: PrismaStubs = {
      steamOwnedGame: { count: vi.fn() },
      steamPlaytimeSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ snapshotDate }),
        count: vi.fn(),
        aggregate: vi
          .fn()
          .mockResolvedValue(
            aggregateResult({ windows: 9_500, deck: 2_000, linux: 500 })
          ),
        findMany: vi.fn(),
      },
    };

    const mix = await makeService(prisma).getPlatformMix();
    expect(mix).toEqual({
      totalMinutes: 12_000,
      windowsMinutes: 9_500,
      macMinutes: 0,
      linuxMinutes: 500,
      deckMinutes: 2_000,
      dominantPlatform: "windows",
      lastSyncedAt: snapshotDate.toISOString(),
    });
  });

  it("reports deck as dominantPlatform when its minutes exceed every other platform", async () => {
    const snapshotDate = new Date("2026-05-16T00:00:00.000Z");
    const prisma: PrismaStubs = {
      steamOwnedGame: { count: vi.fn() },
      steamPlaytimeSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ snapshotDate }),
        count: vi.fn(),
        aggregate: vi
          .fn()
          .mockResolvedValue(aggregateResult({ windows: 100, deck: 4_000 })),
        findMany: vi.fn(),
      },
    };

    const mix = await makeService(prisma).getPlatformMix();
    expect(mix.dominantPlatform).toBe("deck");
  });

  it("scopes the aggregate to currently-owned rows (game.removedAt: null)", async () => {
    const snapshotDate = new Date("2026-05-16T00:00:00.000Z");
    const aggregate = vi.fn().mockResolvedValue(aggregateResult({ windows: 1 }));
    const prisma: PrismaStubs = {
      steamOwnedGame: { count: vi.fn() },
      steamPlaytimeSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ snapshotDate }),
        count: vi.fn(),
        aggregate,
        findMany: vi.fn(),
      },
    };

    await makeService(prisma).getPlatformMix();
    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { snapshotDate, game: { removedAt: null } },
      })
    );
  });
});

describe("SteamOwnedGamesService.getOwnedGames", () => {
  it("returns an empty list with null lastSyncedAt when no snapshots exist", async () => {
    const prisma: PrismaStubs = {
      steamOwnedGame: { count: vi.fn() },
      steamPlaytimeSnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn(),
      },
    };

    await expect(makeService(prisma).getOwnedGames()).resolves.toEqual({
      games: [],
      lastSyncedAt: null,
    });
    expect(prisma.steamPlaytimeSnapshot.findMany).not.toHaveBeenCalled();
  });

  it("projects rows with full enrichment into SteamOwnedGame shape", async () => {
    const snapshotDate = new Date("2026-05-16T00:00:00.000Z");
    const rtimeLastPlayed = new Date("2026-05-15T20:30:00.000Z");
    const prisma: PrismaStubs = {
      steamOwnedGame: { count: vi.fn() },
      steamPlaytimeSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ snapshotDate }),
        count: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          {
            appid: 367520,
            playtimeForeverMinutes: 2_400,
            playtime2WeeksMinutes: 120,
            game: {
              name: "Hollow Knight",
              rtimeLastPlayed,
            },
          },
        ]),
      },
      steamGameEnrichment: {
        findMany: vi.fn().mockResolvedValue([
          {
            appid: 367520,
            assetUrlFormat: "steam/apps/367520/${FILENAME}?t=1776125684",
            // BigInt → Number coercion at the wire boundary; the projection
            // narrows this so the SteamOwnedGame type can stay number-typed.
            assetTimestamp: BigInt(1_776_125_684),
            libraryCapsulePath: "1eebc7e0/library_capsule.jpg",
            libraryCapsule2xPath: "1eebc7e0/library_capsule_2x.jpg",
            libraryHeroPath: "0daf3933/library_hero.jpg",
            libraryHero2xPath: "0daf3933/library_hero_2x.jpg",
            headerPath: "3c348949/header.jpg",
            heroCapsulePath: "e6cd56db/hero_capsule.jpg",
            logoPath: "abc123/logo.png",
            appType: "game",
            tagIds: [1628, 1625],
          },
        ]),
      },
    };

    const { games, lastSyncedAt } = await makeService(prisma).getOwnedGames();
    expect(lastSyncedAt).toBe(snapshotDate.toISOString());
    expect(games).toEqual([
      {
        appid: 367520,
        name: "Hollow Knight",
        playtimeForeverMinutes: 2_400,
        playtime2WeeksMinutes: 120,
        assetUrlFormat: "steam/apps/367520/${FILENAME}?t=1776125684",
        assetTimestamp: 1_776_125_684,
        libraryCapsulePath: "1eebc7e0/library_capsule.jpg",
        libraryCapsule2xPath: "1eebc7e0/library_capsule_2x.jpg",
        libraryHeroPath: "0daf3933/library_hero.jpg",
        libraryHero2xPath: "0daf3933/library_hero_2x.jpg",
        headerPath: "3c348949/header.jpg",
        heroCapsulePath: "e6cd56db/hero_capsule.jpg",
        logoPath: "abc123/logo.png",
        appType: "game",
        tagIds: [1628, 1625],
        rtimeLastPlayedAt: rtimeLastPlayed.toISOString(),
      },
    ]);
  });

  it("maps missing enrichment + missing rtime to per-field nulls", async () => {
    const snapshotDate = new Date("2026-05-16T00:00:00.000Z");
    const prisma: PrismaStubs = {
      steamOwnedGame: { count: vi.fn() },
      steamPlaytimeSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ snapshotDate }),
        count: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          {
            appid: 730,
            playtimeForeverMinutes: 0,
            playtime2WeeksMinutes: null,
            game: { name: "Counter-Strike 2", rtimeLastPlayed: null },
          },
        ]),
      },
      steamGameEnrichment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const { games } = await makeService(prisma).getOwnedGames();
    expect(games[0]).toMatchObject({
      appid: 730,
      name: "Counter-Strike 2",
      playtimeForeverMinutes: 0,
      playtime2WeeksMinutes: null,
      assetUrlFormat: null,
      assetTimestamp: null,
      libraryCapsulePath: null,
      libraryCapsule2xPath: null,
      libraryHeroPath: null,
      libraryHero2xPath: null,
      headerPath: null,
      heroCapsulePath: null,
      logoPath: null,
      appType: null,
      tagIds: [],
      rtimeLastPlayedAt: null,
    });
  });

  it("requests rows scoped to the latest snapshot and currently-owned games", async () => {
    const snapshotDate = new Date("2026-05-16T00:00:00.000Z");
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma: PrismaStubs = {
      steamOwnedGame: { count: vi.fn() },
      steamPlaytimeSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ snapshotDate }),
        count: vi.fn(),
        aggregate: vi.fn(),
        findMany,
      },
      steamGameEnrichment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    await makeService(prisma).getOwnedGames();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { snapshotDate, game: { removedAt: null } },
        orderBy: { playtimeForeverMinutes: "desc" },
      })
    );
  });
});
