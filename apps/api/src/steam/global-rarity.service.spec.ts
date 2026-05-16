import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { SteamGlobalRarityService } from "./global-rarity.service";
import type { SteamClientService } from "./steam-client.service";

interface PrismaStubs {
  steamAchievementGlobalRarity: { upsert: ReturnType<typeof vi.fn> };
  steamGameAchievementMeta: { update: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
}

function makePrisma(): PrismaStubs {
  const stubs: PrismaStubs = {
    steamAchievementGlobalRarity: { upsert: vi.fn().mockResolvedValue(undefined) },
    steamGameAchievementMeta: { update: vi.fn().mockResolvedValue(undefined) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(stubs)),
  };
  return stubs;
}

function makeService(
  prisma: PrismaStubs,
  getGlobalAchievementPercentages: ReturnType<typeof vi.fn>
): SteamGlobalRarityService {
  const client = { getGlobalAchievementPercentages } as unknown as SteamClientService;
  return new SteamGlobalRarityService(prisma as unknown as PrismaService, client);
}

describe("SteamGlobalRarityService.refreshRarity", () => {
  it("returns a zeroed result and makes no Steam calls when appids is empty", async () => {
    const prisma = makePrisma();
    const fetch = vi.fn();
    const result = await makeService(prisma, fetch).refreshRarity([]);

    expect(result).toEqual({ checked: 0, rowsWritten: 0, failed: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("upserts each percentage and stamps meta.lastRarityCheckedAt", async () => {
    const prisma = makePrisma();
    const fetch = vi.fn().mockResolvedValue([
      { name: "ACH_A", percent: 22.4 },
      { name: "ACH_B", percent: 5.2 },
    ]);

    const result = await makeService(prisma, fetch).refreshRarity([367520]);

    expect(result).toEqual({ checked: 1, rowsWritten: 2, failed: 0 });
    expect(prisma.steamAchievementGlobalRarity.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.steamGameAchievementMeta.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { appid: 367520 },
        data: expect.objectContaining({ lastRarityCheckedAt: expect.any(Date) }),
      })
    );
  });

  it("skips the transaction but still stamps meta when percentages is empty", async () => {
    // Steam returns an empty array for games whose achievement schema exists
    // but where no player has ever unlocked anything — usually demo or
    // schema-stub apps. Meta should still record the check.
    const prisma = makePrisma();
    const fetch = vi.fn().mockResolvedValue([]);

    const result = await makeService(prisma, fetch).refreshRarity([367520]);

    expect(result).toEqual({ checked: 1, rowsWritten: 0, failed: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.steamGameAchievementMeta.update).toHaveBeenCalledOnce();
  });

  it("counts a single failure and continues to the next appid", async () => {
    const prisma = makePrisma();
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("upstream 500"))
      .mockResolvedValueOnce([{ name: "ACH_A", percent: 50 }]);

    const result = await makeService(prisma, fetch).refreshRarity([404, 367520]);

    expect(result).toEqual({ checked: 1, rowsWritten: 1, failed: 1 });
    expect(prisma.steamAchievementGlobalRarity.upsert).toHaveBeenCalledOnce();
  });
});
