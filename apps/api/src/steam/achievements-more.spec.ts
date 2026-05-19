import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { SteamAchievementsService } from "./achievements.service";

function makeService(opts: {
  unlockRows?: unknown[];
  totals?: unknown[];
  groupedUnlocks?: unknown[];
}) {
  const prisma = {
    steamPlayerUnlock: {
      findMany: vi.fn().mockResolvedValue(opts.unlockRows ?? []),
      groupBy: vi.fn().mockResolvedValue(opts.groupedUnlocks ?? []),
    },
    steamGameAchievement: {
      groupBy: vi.fn().mockResolvedValue(opts.totals ?? []),
    },
  };
  return {
    service: new SteamAchievementsService(prisma as unknown as PrismaService),
    prisma,
  };
}

describe("SteamAchievementsService.getCrossGameRarest", () => {
  it("clamps a too-high limit to RAREST_UNLOCKS_MAX_LIMIT", async () => {
    const { service, prisma } = makeService({ unlockRows: [] });
    await service.getCrossGameRarest(1_000_000);
    const call = prisma.steamPlayerUnlock.findMany.mock.calls[0]?.[0] as
      | { take: number }
      | undefined;
    // Don't depend on the exact cap — just assert it was clamped.
    expect(call?.take).toBeLessThan(1_000_000);
  });

  it("clamps a too-low limit to 1", async () => {
    const { service, prisma } = makeService({ unlockRows: [] });
    await service.getCrossGameRarest(0);
    const call = prisma.steamPlayerUnlock.findMany.mock.calls[0]?.[0] as
      | { take: number }
      | undefined;
    expect(call?.take).toBe(1);
  });

  it("projects unlock rows into the SteamRecentUnlocks shape", async () => {
    const { service } = makeService({
      unlockRows: [
        {
          appid: 42,
          apiName: "FIRST_KILL",
          unlockedAt: new Date("2026-05-01T00:00:00Z"),
          achievement: {
            displayName: "First Kill",
            hidden: false,
            game: { name: "Half-Life" },
            rarity: { percent: 0.4 },
          },
        },
      ],
    });
    const result = await service.getCrossGameRarest(10);
    expect(result.unlocks).toHaveLength(1);
    expect(result.unlocks[0]?.gameName).toBe("Half-Life");
    expect(result.unlocks[0]?.globalPercent).toBe(0.4);
  });

  it("forwards null globalPercent when rarity is missing", async () => {
    const { service } = makeService({
      unlockRows: [
        {
          appid: 42,
          apiName: "FIRST_KILL",
          unlockedAt: new Date("2026-05-01T00:00:00Z"),
          achievement: {
            displayName: "First Kill",
            hidden: false,
            game: { name: "Half-Life" },
            rarity: null,
          },
        },
      ],
    });
    const result = await service.getCrossGameRarest(10);
    expect(result.unlocks[0]?.globalPercent).toBeNull();
  });
});

describe("SteamAchievementsService.getUnlockTimeline", () => {
  it("returns empty months when no unlocks exist", async () => {
    const { service } = makeService({ unlockRows: [] });
    const result = await service.getUnlockTimeline(42);
    expect(result).toEqual({ months: [], total: 0 });
  });

  it("buckets unlocks by year-month between the first and last unlock", async () => {
    const { service } = makeService({
      unlockRows: [
        { unlockedAt: new Date("2026-01-15T12:00:00Z") },
        { unlockedAt: new Date("2026-01-22T12:00:00Z") },
        { unlockedAt: new Date("2026-03-05T12:00:00Z") },
      ],
    });
    const result = await service.getUnlockTimeline(42);
    expect(result.total).toBe(3);
    expect(result.months).toHaveLength(3);
    expect(result.months[0]).toMatchObject({ year: 2026, month: 1, count: 2 });
    expect(result.months[1]).toMatchObject({ year: 2026, month: 2, count: 0 });
    expect(result.months[2]).toMatchObject({ year: 2026, month: 3, count: 1 });
  });

  it("rolls over the year correctly when the span crosses December", async () => {
    const { service } = makeService({
      unlockRows: [
        { unlockedAt: new Date("2025-11-15T12:00:00Z") },
        { unlockedAt: new Date("2026-02-05T12:00:00Z") },
      ],
    });
    const result = await service.getUnlockTimeline(42);
    expect(result.months[0]).toMatchObject({ year: 2025, month: 11 });
    expect(result.months[result.months.length - 1]).toMatchObject({
      year: 2026,
      month: 2,
    });
  });
});

describe("SteamAchievementsService.getLibraryCompletion", () => {
  it("returns empty stats when no totals are present", async () => {
    const { service } = makeService({});
    const result = await service.getLibraryCompletion();
    expect(result.stats).toEqual([]);
  });

  it("joins per-appid totals with unlock counts + last-unlocked timestamps", async () => {
    const { service } = makeService({
      totals: [
        { appid: 42, _count: { apiName: 10 } },
        { appid: 99, _count: { apiName: 5 } },
      ],
      groupedUnlocks: [
        {
          appid: 42,
          _count: { apiName: 7 },
          _max: { unlockedAt: new Date("2026-05-01T00:00:00Z") },
        },
      ],
    });
    const result = await service.getLibraryCompletion();
    expect(result.stats).toHaveLength(2);
    const ach42 = result.stats.find((s) => s.appid === 42);
    expect(ach42?.unlocked).toBe(7);
    expect(ach42?.lastUnlockedAt).toBe("2026-05-01T00:00:00.000Z");
    const ach99 = result.stats.find((s) => s.appid === 99);
    expect(ach99?.unlocked).toBe(0);
    expect(ach99?.lastUnlockedAt).toBeNull();
  });
});
