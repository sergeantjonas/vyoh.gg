import { RUM_RETENTION_DAYS, type RumBeacon } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { RUM_MAX_ROWS, RumService } from "./rum.service";

function makeService(
  opts: { boundary?: { recordedAt: Date }; rows?: Record<string, unknown>[] } = {}
) {
  const prisma = {
    $transaction: vi.fn(async (ops: unknown[]) => ops),
    webVitalSample: {
      upsert: vi.fn((args: unknown) => args),
      deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
      findFirst: vi.fn().mockResolvedValue(opts.boundary ?? null),
    },
    $queryRaw: vi.fn().mockResolvedValue(opts.rows ?? []),
  };
  return { service: new RumService(prisma as unknown as PrismaService), prisma };
}

const BEACON: RumBeacon = {
  route: "/steam/library",
  formFactor: "mobile",
  navigationType: "reload",
  samples: [
    { id: "v6-1790861459105-4815162342108", name: "LCP", value: 1964, rating: "good" },
    {
      id: "v6-1790861459105-1234567890123",
      name: "INP",
      value: 312,
      rating: "needs-improvement",
    },
  ],
};

describe("RumService.record", () => {
  it("upserts each sample by its metric id, in one transaction", async () => {
    const { service, prisma } = makeService();
    await service.record(BEACON);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.webVitalSample.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.webVitalSample.upsert.mock.calls[1]?.[0]).toMatchObject({
      where: { id: "v6-1790861459105-1234567890123" },
      create: {
        id: "v6-1790861459105-1234567890123",
        name: "INP",
        value: 312,
        rating: "needs-improvement",
        route: "/steam/library",
        formFactor: "mobile",
        navigationType: "reload",
      },
    });
  });

  it("moves only the reading when a metric is re-reported", async () => {
    const { service, prisma } = makeService();
    await service.record(BEACON);
    const { update } = prisma.webVitalSample.upsert.mock.calls[0]?.[0] as {
      update: Record<string, unknown>;
    };
    expect(Object.keys(update).sort()).toEqual(["rating", "recordedAt", "value"]);
  });
});

describe("RumService.prune", () => {
  it(`deletes samples recorded more than ${RUM_RETENTION_DAYS} days ago`, async () => {
    const { service, prisma } = makeService();
    const now = new Date("2026-10-01T04:00:00Z");
    await expect(service.prune(now)).resolves.toBe(3);
    expect(prisma.webVitalSample.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.webVitalSample.deleteMany).toHaveBeenCalledWith({
      where: { recordedAt: { lt: new Date("2026-07-03T04:00:00Z") } },
    });
  });

  it(`cuts the table back to ${RUM_MAX_ROWS} rows, whatever their age`, async () => {
    const boundary = { recordedAt: new Date("2026-09-30T12:00:00Z") };
    const { service, prisma } = makeService({ boundary });
    await expect(service.prune(new Date("2026-10-01T04:00:00Z"))).resolves.toBe(6);
    expect(prisma.webVitalSample.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { recordedAt: "desc" }, skip: RUM_MAX_ROWS })
    );
    expect(prisma.webVitalSample.deleteMany).toHaveBeenLastCalledWith({
      where: { recordedAt: { lte: boundary.recordedAt } },
    });
  });
});

describe("RumService.summary", () => {
  const rows = [
    { route: "/", formFactor: "desktop", name: "LCP", p75: 2560, samples: 8, good: 2 },
    { route: "/", formFactor: "desktop", name: "CLS", p75: 0.04, samples: 8, good: 8 },
    { route: "/", formFactor: "mobile", name: "LCP", p75: 3100, samples: 5, good: 1 },
  ];

  it("folds the per-metric rows into one entry per page and form factor", async () => {
    const { service } = makeService({ rows });
    const summary = await service.summary(0);
    expect(summary.routes).toEqual([
      {
        route: "/",
        formFactor: "desktop",
        metrics: {
          LCP: { p75: 2560, samples: 8, goodShare: 0.25 },
          CLS: { p75: 0.04, samples: 8, goodShare: 1 },
        },
      },
      {
        route: "/",
        formFactor: "mobile",
        metrics: { LCP: { p75: 3100, samples: 5, goodShare: 0.2 } },
      },
    ]);
  });

  it("answers from its copy for five minutes, then queries again", async () => {
    const { service, prisma } = makeService({ rows });
    await service.summary(0);
    await service.summary(4 * 60_000);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    await service.summary(5 * 60_000);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
