import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { SteamPlayerUnlocksService } from "./player-unlocks.service";
import type { SteamClientService } from "./steam-client.service";

interface PrismaStubs {
  steamGameAchievementMeta: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  steamPlayerUnlock: { createMany: ReturnType<typeof vi.fn> };
}

function makePrisma(): PrismaStubs {
  return {
    steamGameAchievementMeta: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    },
    steamPlayerUnlock: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

function makeService(
  prisma: PrismaStubs,
  getPlayerAchievements: ReturnType<typeof vi.fn>
): SteamPlayerUnlocksService {
  const client = { getPlayerAchievements } as unknown as SteamClientService;
  return new SteamPlayerUnlocksService(prisma as unknown as PrismaService, client);
}

describe("SteamPlayerUnlocksService.refreshUnlocksForGame", () => {
  it("short-circuits when no meta row exists", async () => {
    const prisma = makePrisma();
    prisma.steamGameAchievementMeta.findUnique.mockResolvedValue(null);
    const fetch = vi.fn();

    const result = await makeService(prisma, fetch).refreshUnlocksForGame(404);
    expect(result).toEqual({ checked: 0, newUnlocks: 0, failed: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("short-circuits when the game's schema is empty (CS2, demos)", async () => {
    const prisma = makePrisma();
    prisma.steamGameAchievementMeta.findUnique.mockResolvedValue({ achievementCount: 0 });
    const fetch = vi.fn();

    const result = await makeService(prisma, fetch).refreshUnlocksForGame(730);
    expect(result).toEqual({ checked: 0, newUnlocks: 0, failed: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("delegates to syncUnlocks when the game has a non-empty schema", async () => {
    const prisma = makePrisma();
    prisma.steamGameAchievementMeta.findUnique.mockResolvedValue({
      achievementCount: 30,
    });
    const fetch = vi.fn().mockResolvedValue([]);

    await makeService(prisma, fetch).refreshUnlocksForGame(367520);
    expect(fetch).toHaveBeenCalledWith(expect.any(String), 367520);
  });
});

describe("SteamPlayerUnlocksService.syncUnlocks", () => {
  it("returns a zeroed result and makes no Steam calls when appids is empty", async () => {
    const prisma = makePrisma();
    const fetch = vi.fn();
    const result = await makeService(prisma, fetch).syncUnlocks([]);

    expect(result).toEqual({ checked: 0, newUnlocks: 0, failed: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("inserts only achieved=1 + unlocktime>0 rows (filters locked & zero-time)", async () => {
    const prisma = makePrisma();
    prisma.steamPlayerUnlock.createMany.mockResolvedValue({ count: 2 });
    const fetch = vi.fn().mockResolvedValue([
      { apiname: "ACH_DONE_A", achieved: 1, unlocktime: 1_715_000_000 },
      { apiname: "ACH_LOCKED", achieved: 0, unlocktime: 0 },
      { apiname: "ACH_DONE_NO_TIME", achieved: 1, unlocktime: 0 },
      { apiname: "ACH_DONE_B", achieved: 1, unlocktime: 1_715_999_999 },
    ]);

    const result = await makeService(prisma, fetch).syncUnlocks([367520]);

    expect(result).toEqual({ checked: 1, newUnlocks: 2, failed: 0 });
    expect(prisma.steamPlayerUnlock.createMany).toHaveBeenCalledWith({
      data: [
        {
          appid: 367520,
          apiName: "ACH_DONE_A",
          unlockedAt: new Date(1_715_000_000 * 1000),
        },
        {
          appid: 367520,
          apiName: "ACH_DONE_B",
          unlockedAt: new Date(1_715_999_999 * 1000),
        },
      ],
      skipDuplicates: true,
    });
    expect(prisma.steamGameAchievementMeta.update).toHaveBeenCalledOnce();
  });

  it("still stamps meta when Steam returns null (success: false / private stats)", async () => {
    const prisma = makePrisma();
    const fetch = vi.fn().mockResolvedValue(null);

    const result = await makeService(prisma, fetch).syncUnlocks([367520]);

    expect(result).toEqual({ checked: 1, newUnlocks: 0, failed: 0 });
    expect(prisma.steamPlayerUnlock.createMany).not.toHaveBeenCalled();
    expect(prisma.steamGameAchievementMeta.update).toHaveBeenCalledOnce();
  });

  it("counts a single failure and continues to the next appid", async () => {
    const prisma = makePrisma();
    prisma.steamPlayerUnlock.createMany.mockResolvedValue({ count: 1 });
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("upstream 500"))
      .mockResolvedValueOnce([
        { apiname: "ACH_A", achieved: 1, unlocktime: 1_715_000_000 },
      ]);

    const result = await makeService(prisma, fetch).syncUnlocks([404, 367520]);

    expect(result).toEqual({ checked: 1, newUnlocks: 1, failed: 1 });
  });
});
