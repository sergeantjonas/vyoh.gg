import { NotFoundException } from "@nestjs/common";
import type {
  SteamGameAchievements,
  SteamGameScreenshots,
  SteamOwnedGame,
  SteamOwnedGames,
} from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";

import type { SteamAchievementsService } from "./achievements.service";
import { SteamGameRecapService } from "./game-recap.service";
import type { SteamOwnedGamesService } from "./owned-games.service";

function makeOwnedGame(overrides: Partial<SteamOwnedGame> = {}): SteamOwnedGame {
  return {
    appid: 367520,
    name: "Hollow Knight",
    playtimeForeverMinutes: 2800,
    playtime2WeeksMinutes: 360,
    assetUrlFormat: "https://example.test/${FILENAME}",
    assetTimestamp: 12345,
    libraryCapsulePath: "lib_cap.jpg",
    libraryCapsule2xPath: "lib_cap_2x.jpg",
    libraryHeroPath: "lib_hero.jpg",
    libraryHero2xPath: "lib_hero_2x.jpg",
    headerPath: "header.jpg",
    heroCapsulePath: "hero_cap.jpg",
    logoPath: "logo.png",
    appType: 0,
    tagIds: [],
    rtimeLastPlayedAt: "2026-05-30T20:00:00Z",
    shortDescription: "Forge your own path in Hollow Knight!",
    steamDeckCompat: 3,
    platformWindows: true,
    platformMac: true,
    platformLinux: true,
    platformVr: false,
    reviewSummary: null,
    gameRating: null,
    publisherNames: ["Team Cherry"],
    developerNames: ["Team Cherry"],
    franchiseNames: [],
    subjectXPercent: 50,
    subjectYPercent: 50,
    flipHero: false,
    dominantHex: "#1a1a2e",
    microtrailerWebm: null,
    microtrailerMp4: null,
    microtrailerPoster: null,
    microtrailerName: null,
    trailers: null,
    recentPlaytimeMinutes: [0, 30, 45, 90, 120],
    ...overrides,
  };
}

function makeOwnedGames(games: SteamOwnedGame[]): SteamOwnedGames {
  return { games, lastSyncedAt: "2026-05-31T04:00:00Z" };
}

function makeAchievements(
  achievements: SteamGameAchievements["achievements"] = []
): SteamGameAchievements {
  return {
    appid: 367520,
    achievements,
    lastSchemaCheckedAt: "2026-05-31T00:00:00Z",
    lastUnlocksCheckedAt: "2026-05-31T00:00:00Z",
    lastRarityCheckedAt: "2026-05-31T00:00:00Z",
  };
}

function makeScreenshots(count: number, mature = 0): SteamGameScreenshots {
  return {
    appid: 367520,
    allAges: Array.from({ length: count }, (_, i) => ({
      filename: `steam/apps/367520/ss_${i}.jpg`,
      ordinal: i,
    })),
    mature: Array.from({ length: mature }, (_, i) => ({
      filename: `steam/apps/367520/mature_${i}.jpg`,
      ordinal: i,
    })),
  };
}

function makeService(
  ownedGames: Pick<SteamOwnedGamesService, "getOwnedGames" | "getGameScreenshots">,
  achievements: Pick<SteamAchievementsService, "getGameAchievements">
): SteamGameRecapService {
  return new SteamGameRecapService(
    ownedGames as SteamOwnedGamesService,
    achievements as SteamAchievementsService
  );
}

describe("SteamGameRecapService.getGameRecap", () => {
  it("composes the recap from owned-games + achievements + screenshots", async () => {
    const ownedGames = {
      getOwnedGames: vi.fn().mockResolvedValue(makeOwnedGames([makeOwnedGame()])),
      getGameScreenshots: vi.fn().mockResolvedValue(makeScreenshots(3)),
    };
    const achievements = {
      getGameAchievements: vi.fn().mockResolvedValue(makeAchievements([])),
    };
    const service = makeService(ownedGames, achievements);

    const recap = await service.getGameRecap(367520);

    expect(recap.appid).toBe(367520);
    expect(recap.name).toBe("Hollow Knight");
    expect(recap.dominantHex).toBe("#1a1a2e");
    expect(recap.playtimeForeverMinutes).toBe(2800);
    expect(recap.screenshots).toHaveLength(3);
    expect(ownedGames.getOwnedGames).toHaveBeenCalledOnce();
    expect(ownedGames.getGameScreenshots).toHaveBeenCalledWith(367520);
    expect(achievements.getGameAchievements).toHaveBeenCalledWith(367520);
  });

  it("merges both screenshot buckets with all-ages first", async () => {
    const ownedGames = {
      getOwnedGames: vi.fn().mockResolvedValue(makeOwnedGames([makeOwnedGame()])),
      getGameScreenshots: vi.fn().mockResolvedValue(makeScreenshots(2, 4)),
    };
    const achievements = {
      getGameAchievements: vi.fn().mockResolvedValue(makeAchievements([])),
    };
    const recap = await makeService(ownedGames, achievements).getGameRecap(367520);
    expect(recap.screenshots).toHaveLength(6);
    expect(recap.screenshots[0]?.filename).toContain("ss_0");
    expect(recap.screenshots[2]?.filename).toContain("mature_0");
  });

  it("surfaces mature screenshots when the all-ages bucket is empty", async () => {
    const ownedGames = {
      getOwnedGames: vi.fn().mockResolvedValue(makeOwnedGames([makeOwnedGame()])),
      getGameScreenshots: vi.fn().mockResolvedValue(makeScreenshots(0, 3)),
    };
    const achievements = {
      getGameAchievements: vi.fn().mockResolvedValue(makeAchievements([])),
    };
    const recap = await makeService(ownedGames, achievements).getGameRecap(367520);
    // Without the merge, 17+ titles with only mature screenshots showed
    // an empty closer strip — this asserts the fallback.
    expect(recap.screenshots).toHaveLength(3);
    expect(recap.screenshots[0]?.filename).toContain("mature_0");
  });

  it("throws NotFoundException when the appid is not in the library", async () => {
    const ownedGames = {
      // Library has a different game; the requested appid is missing.
      getOwnedGames: vi
        .fn()
        .mockResolvedValue(makeOwnedGames([makeOwnedGame({ appid: 99999 })])),
      getGameScreenshots: vi.fn().mockResolvedValue(makeScreenshots(0)),
    };
    const achievements = {
      getGameAchievements: vi.fn().mockResolvedValue(makeAchievements(null)),
    };
    const service = makeService(ownedGames, achievements);

    await expect(service.getGameRecap(367520)).rejects.toThrow(NotFoundException);
  });

  it("runs the three upstream calls in parallel", async () => {
    const order: string[] = [];
    const ownedGames = {
      getOwnedGames: vi.fn(async () => {
        order.push("owned-start");
        await new Promise((r) => setTimeout(r, 5));
        order.push("owned-end");
        return makeOwnedGames([makeOwnedGame()]);
      }),
      getGameScreenshots: vi.fn(async () => {
        order.push("screenshots-start");
        await new Promise((r) => setTimeout(r, 5));
        order.push("screenshots-end");
        return makeScreenshots(1);
      }),
    };
    const achievements = {
      getGameAchievements: vi.fn(async () => {
        order.push("achievements-start");
        await new Promise((r) => setTimeout(r, 5));
        order.push("achievements-end");
        return makeAchievements([]);
      }),
    };

    await makeService(ownedGames, achievements).getGameRecap(367520);

    // All three start before any finishes — confirms Promise.all parallelism.
    const startEvents = order.filter((e) => e.endsWith("-start"));
    const endEvents = order.filter((e) => e.endsWith("-end"));
    expect(startEvents).toHaveLength(3);
    const lastStart = startEvents[startEvents.length - 1];
    const firstEnd = endEvents[0];
    expect(lastStart).toBeDefined();
    expect(firstEnd).toBeDefined();
    // First end-event index must come AFTER the last start-event index.
    expect(order.indexOf(firstEnd as string)).toBeGreaterThan(
      order.lastIndexOf(lastStart as string)
    );
  });
});
