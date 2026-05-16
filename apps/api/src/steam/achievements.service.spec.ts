import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import {
  RECENT_UNLOCKS_MAX_LIMIT,
  SteamAchievementsService,
} from "./achievements.service";

interface PrismaStubs {
  steamGameAchievementMeta: { findUnique: ReturnType<typeof vi.fn> };
  steamGameAchievement: { findMany: ReturnType<typeof vi.fn> };
  steamPlayerUnlock: { findMany: ReturnType<typeof vi.fn> };
}

function makeService(prisma: PrismaStubs): SteamAchievementsService {
  return new SteamAchievementsService(prisma as unknown as PrismaService);
}

function makePrisma(): PrismaStubs {
  return {
    steamGameAchievementMeta: { findUnique: vi.fn() },
    steamGameAchievement: { findMany: vi.fn() },
    steamPlayerUnlock: { findMany: vi.fn() },
  };
}

const META_CHECKED = {
  lastSchemaCheckedAt: new Date("2026-05-10T00:00:00.000Z"),
  lastUnlocksCheckedAt: new Date("2026-05-15T00:00:00.000Z"),
  lastRarityCheckedAt: new Date("2026-05-14T00:00:00.000Z"),
};

describe("SteamAchievementsService.getGameAchievements", () => {
  it("returns achievements: null when no meta row exists for the appid", async () => {
    const prisma = makePrisma();
    prisma.steamGameAchievementMeta.findUnique.mockResolvedValue(null);

    const result = await makeService(prisma).getGameAchievements(367520);
    expect(result).toEqual({
      appid: 367520,
      achievements: null,
      lastSchemaCheckedAt: null,
      lastUnlocksCheckedAt: null,
      lastRarityCheckedAt: null,
    });
    expect(prisma.steamGameAchievement.findMany).not.toHaveBeenCalled();
  });

  it("returns achievements: null when the game has no schema (achievementCount 0)", async () => {
    const prisma = makePrisma();
    prisma.steamGameAchievementMeta.findUnique.mockResolvedValue({
      achievementCount: 0,
      ...META_CHECKED,
    });

    const result = await makeService(prisma).getGameAchievements(730);
    expect(result.achievements).toBeNull();
    expect(result.lastSchemaCheckedAt).toBe(
      META_CHECKED.lastSchemaCheckedAt.toISOString()
    );
    expect(prisma.steamGameAchievement.findMany).not.toHaveBeenCalled();
  });

  it("returns achievements: null when achievementCount is null (meta-only row)", async () => {
    const prisma = makePrisma();
    prisma.steamGameAchievementMeta.findUnique.mockResolvedValue({
      achievementCount: null,
      ...META_CHECKED,
    });

    const result = await makeService(prisma).getGameAchievements(367520);
    expect(result.achievements).toBeNull();
  });

  it("sorts unlocked-first (desc by unlockedAt), then locked alpha by displayName", async () => {
    const prisma = makePrisma();
    prisma.steamGameAchievementMeta.findUnique.mockResolvedValue({
      achievementCount: 4,
      ...META_CHECKED,
    });
    prisma.steamGameAchievement.findMany.mockResolvedValue([
      {
        apiName: "ACH_LOCKED_B",
        displayName: "Zealot",
        description: "Beat the Pantheon of the Sage.",
        iconUrl: "ach_b.png",
        iconGrayUrl: "ach_b_gray.png",
        hidden: false,
        unlock: null,
        rarity: { percent: 5.2 },
      },
      {
        apiName: "ACH_LOCKED_A",
        displayName: "Acolyte",
        description: "Beat the Pantheon of the Master.",
        iconUrl: "ach_a.png",
        iconGrayUrl: "ach_a_gray.png",
        hidden: false,
        unlock: null,
        rarity: null,
      },
      {
        apiName: "ACH_UNLOCKED_OLD",
        displayName: "First Steps",
        description: "",
        iconUrl: "ach_o.png",
        iconGrayUrl: "ach_o_gray.png",
        hidden: false,
        unlock: { unlockedAt: new Date("2024-12-01T00:00:00.000Z") },
        rarity: { percent: 80.0 },
      },
      {
        apiName: "ACH_UNLOCKED_NEW",
        displayName: "Mantis Mauler",
        description: "",
        iconUrl: "ach_n.png",
        iconGrayUrl: "ach_n_gray.png",
        hidden: true,
        unlock: { unlockedAt: new Date("2026-05-15T12:00:00.000Z") },
        rarity: { percent: 22.4 },
      },
    ]);

    const result = await makeService(prisma).getGameAchievements(367520);
    expect(result.achievements?.map((a) => a.apiName)).toEqual([
      "ACH_UNLOCKED_NEW",
      "ACH_UNLOCKED_OLD",
      "ACH_LOCKED_A",
      "ACH_LOCKED_B",
    ]);
    expect(result.achievements?.[0]).toEqual({
      apiName: "ACH_UNLOCKED_NEW",
      displayName: "Mantis Mauler",
      description: "",
      iconUrl: "ach_n.png",
      iconGrayUrl: "ach_n_gray.png",
      hidden: true,
      unlockedAt: "2026-05-15T12:00:00.000Z",
      globalPercent: 22.4,
    });
    // Missing rarity row → globalPercent null; missing unlock → unlockedAt null
    expect(result.achievements?.[2]).toMatchObject({
      apiName: "ACH_LOCKED_A",
      unlockedAt: null,
      globalPercent: null,
    });
  });
});

describe("SteamAchievementsService.getRecentUnlocks", () => {
  it("clamps the limit between 1 and RECENT_UNLOCKS_MAX_LIMIT", async () => {
    const prisma = makePrisma();
    prisma.steamPlayerUnlock.findMany.mockResolvedValue([]);

    await makeService(prisma).getRecentUnlocks(0);
    expect(prisma.steamPlayerUnlock.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 1 })
    );

    await makeService(prisma).getRecentUnlocks(99_999);
    expect(prisma.steamPlayerUnlock.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: RECENT_UNLOCKS_MAX_LIMIT })
    );

    await makeService(prisma).getRecentUnlocks(12.7);
    expect(prisma.steamPlayerUnlock.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 12 })
    );
  });

  it("projects unlock rows into the SteamRecentUnlocks shape", async () => {
    const prisma = makePrisma();
    prisma.steamPlayerUnlock.findMany.mockResolvedValue([
      {
        appid: 367520,
        apiName: "ACH_UNLOCK",
        unlockedAt: new Date("2026-05-15T12:00:00.000Z"),
        achievement: {
          displayName: "Mantis Mauler",
          iconUrl: "ach.png",
          hidden: true,
          game: { name: "Hollow Knight" },
          rarity: { percent: 22.4 },
        },
      },
      {
        appid: 730,
        apiName: "WIN_ROUNDS_LOW_DAMAGE",
        unlockedAt: new Date("2026-05-10T12:00:00.000Z"),
        achievement: {
          displayName: "Damage Dealer",
          iconUrl: "cs.png",
          hidden: false,
          game: { name: "Counter-Strike 2" },
          rarity: null,
        },
      },
    ]);

    const { unlocks } = await makeService(prisma).getRecentUnlocks(10);
    expect(unlocks).toEqual([
      {
        appid: 367520,
        gameName: "Hollow Knight",
        apiName: "ACH_UNLOCK",
        displayName: "Mantis Mauler",
        iconUrl: "ach.png",
        hidden: true,
        unlockedAt: "2026-05-15T12:00:00.000Z",
        globalPercent: 22.4,
      },
      {
        appid: 730,
        gameName: "Counter-Strike 2",
        apiName: "WIN_ROUNDS_LOW_DAMAGE",
        displayName: "Damage Dealer",
        iconUrl: "cs.png",
        hidden: false,
        unlockedAt: "2026-05-10T12:00:00.000Z",
        globalPercent: null,
      },
    ]);
    expect(prisma.steamPlayerUnlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { unlockedAt: "desc" }, take: 10 })
    );
  });
});
