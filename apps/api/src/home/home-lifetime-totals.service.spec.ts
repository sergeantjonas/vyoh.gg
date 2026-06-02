import { describe, expect, it, vi } from "vitest";
import type { IdentityService } from "../identity/identity.service";
import type { PrismaService } from "../prisma/prisma.service";
import {
  HomeLifetimeTotalsService,
  type PlaytimeSnapshotRow,
  sumLatestPlaytimeMinutes,
} from "./home-lifetime-totals.service";

const snap = (
  appid: number,
  iso: string,
  playtimeForeverMinutes: number
): PlaytimeSnapshotRow => ({
  appid,
  snapshotDate: new Date(iso),
  playtimeForeverMinutes,
});

describe("sumLatestPlaytimeMinutes", () => {
  it("returns 0 for empty input", () => {
    expect(sumLatestPlaytimeMinutes([])).toBe(0);
  });

  it("picks the latest snapshot per appid", () => {
    const rows = [
      snap(10, "2025-01-01", 100),
      snap(10, "2025-06-01", 250),
      snap(20, "2025-02-01", 75),
    ];
    // 10 → latest is 250 (2025-06-01); 20 → 75 → total 325.
    expect(sumLatestPlaytimeMinutes(rows)).toBe(325);
  });

  it("is order-independent", () => {
    const a = [snap(10, "2025-01-01", 100), snap(10, "2025-06-01", 250)];
    const b = [snap(10, "2025-06-01", 250), snap(10, "2025-01-01", 100)];
    expect(sumLatestPlaytimeMinutes(a)).toBe(sumLatestPlaytimeMinutes(b));
  });
});

describe("HomeLifetimeTotalsService.getLifetimeTotals", () => {
  let lastPrisma: PrismaService;
  function makeService(opts: {
    matchAggregate?: {
      _count: number;
      _sum: { durationSec: number | null };
      _min: { playedAt: Date | null };
    };
    snapshots?: PlaytimeSnapshotRow[];
    unlockAggregate?: { _min: { unlockedAt: Date | null } };
    ownerPuuids?: string[];
  }) {
    const matchAggregate = opts.matchAggregate ?? {
      _count: 0,
      _sum: { durationSec: 0 },
      _min: { playedAt: null },
    };
    const unlockAggregate = opts.unlockAggregate ?? {
      _min: { unlockedAt: null },
    };
    const prisma = {
      match: { aggregate: vi.fn().mockResolvedValue(matchAggregate) },
      steamPlaytimeSnapshot: {
        findMany: vi.fn().mockResolvedValue(opts.snapshots ?? []),
      },
      steamPlayerUnlock: { aggregate: vi.fn().mockResolvedValue(unlockAggregate) },
    } as unknown as PrismaService;
    const identity = {
      getOwnerPuuids: vi.fn().mockResolvedValue(opts.ownerPuuids ?? ["P_owner"]),
    } as unknown as IdentityService;
    lastPrisma = prisma;
    return new HomeLifetimeTotalsService(prisma, identity);
  }

  it("returns zero totals + null oldest dates when nothing tracked yet", async () => {
    const service = makeService({});
    const result = await service.getLifetimeTotals();
    expect(result).toEqual({
      lolMatchCount: 0,
      lolMinutes: 0,
      steamMinutes: 0,
      oldestMatchAt: null,
      oldestUnlockAt: null,
    });
  });

  it("rolls up alltime counts and converts durations to whole minutes", async () => {
    const service = makeService({
      matchAggregate: {
        _count: 1500,
        _sum: { durationSec: 1500 * 28 * 60 }, // ~42_000 minutes
        _min: { playedAt: new Date("2024-03-15T18:00:00Z") },
      },
      snapshots: [
        snap(10, "2026-05-01", 1200),
        snap(20, "2026-05-02", 800),
        // Older snapshot for appid 10 should be ignored.
        snap(10, "2025-01-01", 100),
      ],
      unlockAggregate: { _min: { unlockedAt: new Date("2024-04-01T12:00:00Z") } },
    });
    const result = await service.getLifetimeTotals();
    expect(result.lolMatchCount).toBe(1500);
    expect(result.lolMinutes).toBe(42_000);
    expect(result.steamMinutes).toBe(2_000); // 1200 + 800
    expect(result.oldestMatchAt).toBe("2024-03-15T18:00:00.000Z");
    expect(result.oldestUnlockAt).toBe("2024-04-01T12:00:00.000Z");
  });

  it("filters matches to owner-resolved puuids", async () => {
    const service = makeService({ ownerPuuids: ["P_A", "P_B"] });
    await service.getLifetimeTotals();
    expect(lastPrisma.match.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          remake: false,
          puuid: { in: ["P_A", "P_B"] },
        }),
      })
    );
  });
});
