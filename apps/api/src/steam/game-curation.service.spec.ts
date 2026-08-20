import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { SteamGameCurationService } from "./game-curation.service";

type Row = {
  appid: number;
  hiddenAt: Date | null;
  unfeaturedAt: Date | null;
  reviewedAt: Date | null;
};

const AT = new Date("2026-08-20T12:00:00Z");

function row(appid: number, over: Partial<Row> = {}): Row {
  return { appid, hiddenAt: null, unfeaturedAt: null, reviewedAt: AT, ...over };
}

function serviceWith(rows: Row[]) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const prisma = { steamGameCuration: { findMany } } as unknown as PrismaService;
  return { service: new SteamGameCurationService(prisma), findMany };
}

describe("SteamGameCurationService", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("returns empty sets for an empty table", async () => {
    const { service } = serviceWith([]);
    const curation = await service.getCuration();
    expect(curation.hidden.size).toBe(0);
    expect(curation.unfeatured.size).toBe(0);
    expect(await service.pendingReviewCount()).toBe(0);
  });

  it("sorts rows onto the axis each timestamp marks", async () => {
    const { service } = serviceWith([
      row(1, { hiddenAt: AT }),
      row(2, { unfeaturedAt: AT }),
      row(3, { hiddenAt: AT, unfeaturedAt: AT }),
      row(4),
    ]);
    const { hidden, unfeatured } = await service.getCuration();
    expect([...hidden].sort()).toEqual([1, 3]);
    expect([...unfeatured].sort()).toEqual([2, 3]);
  });

  it("counts only unreviewed rows as pending", async () => {
    const { service } = serviceWith([
      row(1, { hiddenAt: AT, reviewedAt: null }),
      row(2, { hiddenAt: AT, reviewedAt: null }),
      row(3, { hiddenAt: AT }),
    ]);
    expect(await service.pendingReviewCount()).toBe(2);
  });

  it("hides from a visitor and reveals to the owner, editorial axis intact", async () => {
    const { service } = serviceWith([
      row(1, { hiddenAt: AT }),
      row(2, { unfeaturedAt: AT }),
    ]);

    const visitor = await service.getCurationFor(false);
    expect(visitor.hidden.has(1)).toBe(true);
    expect(visitor.unfeatured.has(2)).toBe(true);

    const owner = await service.getCurationFor(true);
    expect(owner.hidden.size).toBe(0);
    expect(owner.unfeatured.has(2)).toBe(true);
  });

  it("serves repeat reads from cache", async () => {
    const { service, findMany } = serviceWith([row(1, { hiddenAt: AT })]);
    await service.getCuration();
    await service.getCuration();
    await service.pendingReviewCount();
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("collapses concurrent cold reads into one query", async () => {
    const { service, findMany } = serviceWith([row(1, { hiddenAt: AT })]);
    await Promise.all([
      service.getCuration(),
      service.getCuration(),
      service.pendingReviewCount(),
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("re-queries after invalidate, so a write lands immediately", async () => {
    const { service, findMany } = serviceWith([]);
    expect((await service.getCuration()).hidden.size).toBe(0);

    findMany.mockResolvedValue([row(1, { hiddenAt: AT })]);
    expect((await service.getCuration()).hidden.size).toBe(0);

    service.invalidate();
    expect((await service.getCuration()).hidden.has(1)).toBe(true);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("re-queries once the TTL lapses, so a psql edit lands without a restart", async () => {
    vi.useFakeTimers({ now: new Date("2026-08-20T12:00:00Z") });
    const { service, findMany } = serviceWith([]);
    await service.getCuration();

    findMany.mockResolvedValue([row(1, { hiddenAt: AT })]);
    vi.advanceTimersByTime(61_000);
    expect((await service.getCuration()).hidden.has(1)).toBe(true);
  });
});
