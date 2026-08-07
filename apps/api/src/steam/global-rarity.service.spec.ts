import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { SteamGlobalRarityService } from "./global-rarity.service";
import type { SteamClientService } from "./steam-client.service";

interface PrismaStubs {
  steamAchievementGlobalRarity: {
    upsert: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  steamAchievementRarityHistory: { createMany: ReturnType<typeof vi.fn> };
  steamGameAchievementMeta: { update: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
}

function makePrisma(stored: { apiName: string; percent: number }[] = []): PrismaStubs {
  const stubs: PrismaStubs = {
    steamAchievementGlobalRarity: {
      upsert: vi.fn().mockResolvedValue(undefined),
      findMany: vi.fn().mockResolvedValue(stored),
    },
    steamAchievementRarityHistory: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
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

    expect(result).toEqual({
      checked: 0,
      rowsWritten: 0,
      historyRowsAppended: 0,
      failed: 0,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("upserts each percentage and stamps meta.lastRarityCheckedAt", async () => {
    const prisma = makePrisma();
    const fetch = vi.fn().mockResolvedValue([
      { name: "ACH_A", percent: 22.4 },
      { name: "ACH_B", percent: 5.2 },
    ]);

    const result = await makeService(prisma, fetch).refreshRarity([367520]);

    expect(result).toEqual({
      checked: 1,
      rowsWritten: 2,
      historyRowsAppended: 2,
      failed: 0,
    });
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

    expect(result).toEqual({
      checked: 1,
      rowsWritten: 0,
      historyRowsAppended: 0,
      failed: 0,
    });
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

    expect(result).toEqual({
      checked: 1,
      rowsWritten: 1,
      historyRowsAppended: 1,
      failed: 1,
    });
    expect(prisma.steamAchievementGlobalRarity.upsert).toHaveBeenCalledOnce();
  });

  it("gives a never-seen achievement an origin history row", async () => {
    const prisma = makePrisma();
    const fetch = vi.fn().mockResolvedValue([{ name: "ACH_A", percent: 22.4 }]);

    const result = await makeService(prisma, fetch).refreshRarity([367520]);

    expect(result.historyRowsAppended).toBe(1);
    expect(prisma.steamAchievementRarityHistory.createMany).toHaveBeenCalledWith({
      data: [
        { appid: 367520, apiName: "ACH_A", percent: 22.4, observedAt: expect.any(Date) },
      ],
    });
  });

  it("appends only the achievements whose percentage moved", async () => {
    const prisma = makePrisma([
      { apiName: "ACH_MOVED", percent: 22.4 },
      { apiName: "ACH_STILL", percent: 5.2 },
    ]);
    const fetch = vi.fn().mockResolvedValue([
      { name: "ACH_MOVED", percent: 22.5 },
      { name: "ACH_STILL", percent: 5.2 },
    ]);

    const result = await makeService(prisma, fetch).refreshRarity([367520]);

    expect(result).toEqual({
      checked: 1,
      rowsWritten: 2,
      historyRowsAppended: 1,
      failed: 0,
    });
    expect(prisma.steamAchievementRarityHistory.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ apiName: "ACH_MOVED", percent: 22.5 })],
    });
  });

  it("does not append when only the float32 representation differs", async () => {
    // Steam publishes one decimal but serialises it through a float32, so an
    // unchanged 47.9 comes back as 47.900001525878906. Comparing the raw
    // doubles would record that as drift on every single pass.
    const prisma = makePrisma([{ apiName: "ACH_A", percent: 47.9 }]);
    const fetch = vi
      .fn()
      .mockResolvedValue([{ name: "ACH_A", percent: 47.900001525878906 }]);

    const result = await makeService(prisma, fetch).refreshRarity([367520]);

    expect(result.historyRowsAppended).toBe(0);
    expect(prisma.steamAchievementRarityHistory.createMany).not.toHaveBeenCalled();
    // The current-value row still takes the fresh reading either way.
    expect(prisma.steamAchievementGlobalRarity.upsert).toHaveBeenCalledOnce();
  });

  it("reads the outgoing values before the upsert overwrites them", async () => {
    // The previous reading exists nowhere else, so reading it after the upsert
    // would compare a value against itself and never append anything.
    const prisma = makePrisma([{ apiName: "ACH_A", percent: 22.4 }]);
    const fetch = vi.fn().mockResolvedValue([{ name: "ACH_A", percent: 22.5 }]);

    await makeService(prisma, fetch).refreshRarity([367520]);

    expect(prisma.steamAchievementGlobalRarity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { appid: 367520 } })
    );
    const read =
      prisma.steamAchievementGlobalRarity.findMany.mock.invocationCallOrder[0] ?? 0;
    const write =
      prisma.steamAchievementGlobalRarity.upsert.mock.invocationCallOrder[0] ?? 0;
    expect(read).toBeGreaterThan(0);
    expect(read).toBeLessThan(write);
  });
});
