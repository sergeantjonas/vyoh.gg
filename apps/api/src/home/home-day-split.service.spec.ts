import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import {
  type DaySplitInterval,
  HomeDaySplitService,
  splitIntervalsByHour,
} from "./home-day-split.service";

const TZ = "Europe/Brussels";

const iv = (startedAt: string, endedAt: string): DaySplitInterval => ({
  startedAt: new Date(startedAt),
  endedAt: new Date(endedAt),
});

// Sum across all buckets — handy sanity check that minutes don't leak.
const total = (buckets: number[]): number => buckets.reduce((a, b) => a + b, 0);

describe("splitIntervalsByHour", () => {
  it("returns an all-zero, length-24 array for empty input", () => {
    const buckets = splitIntervalsByHour([], TZ);
    expect(buckets).toHaveLength(24);
    expect(total(buckets)).toBe(0);
  });

  it("attributes a within-hour interval to a single bucket", () => {
    // 20:10 → 20:40 Brussels = 18:10 → 18:40 UTC (CET = UTC+1 in January)
    const buckets = splitIntervalsByHour(
      [iv("2026-01-15T19:10:00Z", "2026-01-15T19:40:00Z")],
      TZ
    );
    expect(buckets[20]).toBe(30);
    expect(total(buckets)).toBe(30);
  });

  it("splits a multi-hour span proportionally per minute", () => {
    // 21:50 Brussels → 23:00 Brussels (Jan, UTC+1)
    // 10 min in 21h, 60 min in 22h
    const buckets = splitIntervalsByHour(
      [iv("2026-01-15T20:50:00Z", "2026-01-15T22:00:00Z")],
      TZ
    );
    expect(buckets[21]).toBe(10);
    expect(buckets[22]).toBe(60);
    expect(total(buckets)).toBe(70);
  });

  it("attributes exactly to the starting hour when the interval ends on a boundary", () => {
    // 21:00 → 22:00 Brussels exactly = 60 minutes in 21h
    const buckets = splitIntervalsByHour(
      [iv("2026-01-15T20:00:00Z", "2026-01-15T21:00:00Z")],
      TZ
    );
    expect(buckets[21]).toBe(60);
    expect(total(buckets)).toBe(60);
  });

  it("handles midnight crossings cleanly", () => {
    // 23:30 → 00:30 Brussels = 30 min in 23h + 30 min in 00h
    const buckets = splitIntervalsByHour(
      [iv("2026-01-15T22:30:00Z", "2026-01-15T23:30:00Z")],
      TZ
    );
    expect(buckets[23]).toBe(30);
    expect(buckets[0]).toBe(30);
    expect(total(buckets)).toBe(60);
  });

  it("respects DST: spring-forward (Brussels 2026-03-29 02:00 → 03:00)", () => {
    // Brussels clocks jump from 02:00 CET (UTC+1) directly to 03:00 CEST (UTC+2).
    // 01:30 → 03:30 Brussels local time = 30 min in 01h + 30 min in 03h (02h doesn't exist).
    // 01:30 Brussels CET = 00:30 UTC; 03:30 Brussels CEST = 01:30 UTC.
    const buckets = splitIntervalsByHour(
      [iv("2026-03-29T00:30:00Z", "2026-03-29T01:30:00Z")],
      TZ
    );
    expect(buckets[1]).toBe(30);
    expect(buckets[3]).toBe(30);
    expect(buckets[2]).toBe(0);
    expect(total(buckets)).toBe(60);
  });

  it("respects DST: fall-back (Brussels 2026-10-25 03:00 → 02:00)", () => {
    // Brussels clocks fall from 03:00 CEST (UTC+2) back to 02:00 CET (UTC+1).
    // The local hour "02:00–02:59" happens twice. A 90-minute interval running
    // through the cut-over should attribute 60 + 30 to the 02 bucket (both
    // instances) and total 90 minutes.
    // Start: 02:30 CEST = 00:30 UTC. End: 02:00 CET = 01:00 UTC.
    // Wall-clock minutes touched: 02:30..02:59 CEST (30) + 02:00..02:59 CET (60) = 90.
    const buckets = splitIntervalsByHour(
      [iv("2026-10-25T00:30:00Z", "2026-10-25T02:00:00Z")],
      TZ
    );
    expect(buckets[2]).toBe(90);
    expect(total(buckets)).toBe(90);
  });

  it("rounds sub-minute intervals to at least one minute", () => {
    // 30-second interval should still register as 1 minute.
    const buckets = splitIntervalsByHour(
      [iv("2026-01-15T19:10:00Z", "2026-01-15T19:10:30Z")],
      TZ
    );
    expect(buckets[20]).toBe(1);
    expect(total(buckets)).toBe(1);
  });

  it("ignores zero-length and inverted intervals", () => {
    const buckets = splitIntervalsByHour(
      [
        iv("2026-01-15T19:00:00Z", "2026-01-15T19:00:00Z"),
        iv("2026-01-15T19:30:00Z", "2026-01-15T19:00:00Z"),
      ],
      TZ
    );
    expect(total(buckets)).toBe(0);
  });

  it("accumulates across multiple intervals into the same buckets", () => {
    const buckets = splitIntervalsByHour(
      [
        // 20:00–20:30 Brussels (Jan, UTC+1)
        iv("2026-01-15T19:00:00Z", "2026-01-15T19:30:00Z"),
        // 20:15–20:45 Brussels
        iv("2026-01-16T19:15:00Z", "2026-01-16T19:45:00Z"),
      ],
      TZ
    );
    expect(buckets[20]).toBe(60);
    expect(total(buckets)).toBe(60);
  });
});

describe("HomeDaySplitService.getDaySplit", () => {
  function makeService(
    matches: { playedAt: Date; durationSec: number }[],
    sessions: { startedAt: Date; endedAt: Date | null }[]
  ) {
    const prisma = {
      match: { findMany: vi.fn().mockResolvedValue(matches) },
      steamPlaySession: { findMany: vi.fn().mockResolvedValue(sessions) },
    } as unknown as PrismaService;
    return new HomeDaySplitService(prisma);
  }

  it("returns 24 zero-valued hours when there is no activity", async () => {
    const service = makeService([], []);
    const result = await service.getDaySplit();
    expect(result.hours).toHaveLength(24);
    expect(result.totalLolMinutes).toBe(0);
    expect(result.totalSteamMinutes).toBe(0);
    expect(result.timeZone).toBe("Europe/Brussels");
    expect(result.hours.every((h) => h.lolMinutes === 0 && h.steamMinutes === 0)).toBe(
      true
    );
  });

  it("buckets LoL match duration into Brussels-local hours", async () => {
    const service = makeService(
      // 20:10 → 20:40 Brussels (Jan, UTC+1) = 30 min in hour 20.
      [{ playedAt: new Date("2026-01-15T19:10:00Z"), durationSec: 30 * 60 }],
      []
    );
    const result = await service.getDaySplit();
    expect(result.hours[20]?.lolMinutes).toBe(30);
    expect(result.totalLolMinutes).toBe(30);
    expect(result.totalSteamMinutes).toBe(0);
  });

  it("skips Steam sessions still in flight (endedAt null)", async () => {
    const service = makeService(
      [],
      [
        { startedAt: new Date("2026-01-15T19:10:00Z"), endedAt: null },
        {
          startedAt: new Date("2026-01-15T19:10:00Z"),
          endedAt: new Date("2026-01-15T19:40:00Z"),
        },
      ]
    );
    const result = await service.getDaySplit();
    expect(result.hours[20]?.steamMinutes).toBe(30);
    expect(result.totalSteamMinutes).toBe(30);
  });

  it("combines LoL and Steam activity in the same hour", async () => {
    const service = makeService(
      [{ playedAt: new Date("2026-01-15T19:10:00Z"), durationSec: 30 * 60 }],
      [
        {
          startedAt: new Date("2026-01-15T19:30:00Z"),
          endedAt: new Date("2026-01-15T19:50:00Z"),
        },
      ]
    );
    const result = await service.getDaySplit();
    expect(result.hours[20]?.lolMinutes).toBe(30);
    expect(result.hours[20]?.steamMinutes).toBe(20);
  });
});
