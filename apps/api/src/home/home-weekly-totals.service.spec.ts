import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import {
  HomeWeeklyTotalsService,
  type PlaytimeSnapshotRow,
  diffPlaytimeMinutes,
} from "./home-weekly-totals.service";

const row = (
  appid: number,
  isoDate: string,
  playtimeForeverMinutes: number
): PlaytimeSnapshotRow => ({
  appid,
  snapshotDate: new Date(isoDate),
  playtimeForeverMinutes,
});

describe("diffPlaytimeMinutes", () => {
  const windowStart = new Date("2024-06-15T00:00:00Z");

  it("returns 0 for empty input", () => {
    expect(diffPlaytimeMinutes([], windowStart)).toBe(0);
  });

  it("returns 0 when only a single snapshot exists for an appid (no baseline)", () => {
    // Single point after windowStart — we don't know what playtime was before.
    expect(diffPlaytimeMinutes([row(1, "2024-06-20T00:00:00Z", 500)], windowStart)).toBe(
      0
    );
  });

  it("sums the delta between latest and the latest baseline at-or-before windowStart", () => {
    const rows = [
      row(1, "2024-06-10T00:00:00Z", 100),
      row(1, "2024-06-14T00:00:00Z", 120),
      row(1, "2024-06-20T00:00:00Z", 200),
    ];
    // baseline = the 06-14 snapshot (latest at-or-before windowStart), value 120.
    // latest = 06-20, value 200. delta = 80.
    expect(diffPlaytimeMinutes(rows, windowStart)).toBe(80);
  });

  it("treats a snapshot dated exactly windowStart as a valid baseline", () => {
    const rows = [
      row(1, "2024-06-15T00:00:00Z", 100),
      row(1, "2024-06-22T00:00:00Z", 130),
    ];
    expect(diffPlaytimeMinutes(rows, windowStart)).toBe(30);
  });

  it("excludes appids whose baseline is missing (all snapshots after windowStart)", () => {
    const rows = [
      row(1, "2024-06-10T00:00:00Z", 100),
      row(1, "2024-06-20T00:00:00Z", 200),
      // appid 2 only has a post-window snapshot — unknown baseline, excluded.
      row(2, "2024-06-18T00:00:00Z", 50),
      row(2, "2024-06-22T00:00:00Z", 90),
    ];
    expect(diffPlaytimeMinutes(rows, windowStart)).toBe(100);
  });

  it("sums deltas across multiple appids with baselines", () => {
    const rows = [
      row(1, "2024-06-10T00:00:00Z", 100),
      row(1, "2024-06-20T00:00:00Z", 200),
      row(2, "2024-06-12T00:00:00Z", 30),
      row(2, "2024-06-21T00:00:00Z", 75),
    ];
    expect(diffPlaytimeMinutes(rows, windowStart)).toBe(100 + 45);
  });

  it("ignores negative deltas (defensive against snapshot anomalies)", () => {
    // Steam's playtimeForever is strictly nondecreasing in practice, but the
    // PICS/Steam API has been known to reset for family-share / refunds. A
    // negative delta would otherwise *subtract* from another appid's positive
    // delta, which is wrong — we want unknown, not negative.
    const rows = [
      row(1, "2024-06-10T00:00:00Z", 200),
      row(1, "2024-06-20T00:00:00Z", 150),
    ];
    expect(diffPlaytimeMinutes(rows, windowStart)).toBe(0);
  });

  it("returns 0 when latest snapshot is at-or-before windowStart (idle week)", () => {
    // Latest snapshot is the baseline — delta with itself is 0.
    const rows = [
      row(1, "2024-06-10T00:00:00Z", 100),
      row(1, "2024-06-14T00:00:00Z", 100),
    ];
    expect(diffPlaytimeMinutes(rows, windowStart)).toBe(0);
  });
});

describe("HomeWeeklyTotalsService.getWeeklyTotals", () => {
  function makeService(
    matches: { durationSec: number }[],
    snapshots: PlaytimeSnapshotRow[]
  ) {
    const prisma = {
      match: { findMany: vi.fn().mockResolvedValue(matches) },
      steamPlaytimeSnapshot: { findMany: vi.fn().mockResolvedValue(snapshots) },
    } as unknown as PrismaService;
    return new HomeWeeklyTotalsService(prisma);
  }

  it("rolls up match count, lol minutes, steam delta, and a total", async () => {
    // Snapshots straddle the 7-day window so the delta is well-defined regardless
    // of when the test runs: baseline is "a year ago", latest is "now".
    const veryOld = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const fresh = new Date();
    const service = makeService(
      [{ durationSec: 1800 }, { durationSec: 600 }],
      [
        { appid: 10, snapshotDate: veryOld, playtimeForeverMinutes: 100 },
        { appid: 10, snapshotDate: fresh, playtimeForeverMinutes: 175 },
      ]
    );
    const result = await service.getWeeklyTotals();
    expect(result.lolMatchCount).toBe(2);
    expect(result.lolMinutes).toBe(40);
    expect(result.steamMinutes).toBe(75);
    expect(result.totalMinutes).toBe(115);
    expect(result.timeZone).toBe("Europe/Brussels");
    expect(typeof result.weekStart).toBe("string");
    expect(typeof result.weekEnd).toBe("string");
  });

  it("reports zero totals on an idle week", async () => {
    const service = makeService([], []);
    const result = await service.getWeeklyTotals();
    expect(result.lolMatchCount).toBe(0);
    expect(result.lolMinutes).toBe(0);
    expect(result.steamMinutes).toBe(0);
    expect(result.totalMinutes).toBe(0);
  });
});
