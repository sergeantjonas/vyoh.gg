import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import {
  HomeActivityIntensityService,
  type PlaySessionInterval,
  clipSessionMinutes,
  computeIntensity,
  startOfLocalDay,
} from "./home-activity-intensity.service";

describe("computeIntensity", () => {
  it("returns 0 for an idle day", () => {
    expect(computeIntensity(0, 0)).toBe(0);
  });

  it("saturates at the LoL reference (6 matches)", () => {
    expect(computeIntensity(6, 0)).toBe(1);
  });

  it("saturates at the Steam reference (120 minutes)", () => {
    expect(computeIntensity(0, 120)).toBe(1);
  });

  it("clamps above either saturation point to 1", () => {
    expect(computeIntensity(12, 0)).toBe(1);
    expect(computeIntensity(0, 600)).toBe(1);
    expect(computeIntensity(12, 600)).toBe(1);
  });

  it("takes the max of the two normalised streams", () => {
    // LoL norm = 3/6 = 0.5; Steam norm = 30/120 = 0.25; max = 0.5
    expect(computeIntensity(3, 30)).toBeCloseTo(0.5, 5);
    // LoL norm = 1/6 ≈ 0.166; Steam norm = 60/120 = 0.5; max = 0.5
    expect(computeIntensity(1, 60)).toBeCloseTo(0.5, 5);
  });

  it("treats negative inputs as zero", () => {
    expect(computeIntensity(-3, -10)).toBe(0);
  });
});

describe("startOfLocalDay", () => {
  it("returns the UTC instant of 00:00 Brussels for a winter date (UTC+01:00)", () => {
    // 2026-01-15 14:00 UTC → still 2026-01-15 in Brussels (UTC+1, no DST)
    const now = new Date("2026-01-15T14:00:00Z");
    const dayStart = startOfLocalDay(now, "Europe/Brussels");
    // Brussels 00:00 on 2026-01-15 = 23:00 UTC on 2026-01-14
    expect(dayStart.toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });

  it("returns the UTC instant of 00:00 Brussels for a summer date (UTC+02:00)", () => {
    // 2026-07-15 14:00 UTC → still 2026-07-15 in Brussels (UTC+2, DST active)
    const now = new Date("2026-07-15T14:00:00Z");
    const dayStart = startOfLocalDay(now, "Europe/Brussels");
    // Brussels 00:00 on 2026-07-15 = 22:00 UTC on 2026-07-14
    expect(dayStart.toISOString()).toBe("2026-07-14T22:00:00.000Z");
  });
});

const iv = (startedIso: string, endedIso: string | null): PlaySessionInterval => ({
  startedAt: new Date(startedIso),
  endedAt: endedIso === null ? null : new Date(endedIso),
});

describe("clipSessionMinutes", () => {
  const dayStart = new Date("2026-05-31T00:00:00Z");
  const now = new Date("2026-05-31T15:00:00Z");

  it("returns 0 for empty input", () => {
    expect(clipSessionMinutes([], dayStart, now)).toBe(0);
  });

  it("sums fully-contained sessions in minutes", () => {
    // 30-min session entirely inside the window
    expect(
      clipSessionMinutes(
        [iv("2026-05-31T10:00:00Z", "2026-05-31T10:30:00Z")],
        dayStart,
        now
      )
    ).toBe(30);
  });

  it("clips sessions that started before dayStart", () => {
    // Started yesterday at 23:30, ended today at 01:00 → 60 min counted
    expect(
      clipSessionMinutes(
        [iv("2026-05-30T23:30:00Z", "2026-05-31T01:00:00Z")],
        dayStart,
        now
      )
    ).toBe(60);
  });

  it("clips sessions that overrun `now` (still-running)", () => {
    // Session started 14:30, still running at 15:00 → 30 min
    expect(clipSessionMinutes([iv("2026-05-31T14:30:00Z", null)], dayStart, now)).toBe(
      30
    );
  });

  it("ignores sessions entirely outside the window", () => {
    expect(
      clipSessionMinutes(
        [iv("2026-05-30T08:00:00Z", "2026-05-30T09:00:00Z")],
        dayStart,
        now
      )
    ).toBe(0);
  });
});

describe("HomeActivityIntensityService.getActivityIntensity", () => {
  function makeService(matches: { playedAt: Date }[], sessions: PlaySessionInterval[]) {
    const prisma = {
      match: { findMany: vi.fn().mockResolvedValue(matches) },
      steamPlaySession: { findMany: vi.fn().mockResolvedValue(sessions) },
    } as unknown as PrismaService;
    return new HomeActivityIntensityService(prisma);
  }

  it("rolls up matches in last 24h and Steam minutes today into a 0..1 intensity", async () => {
    // Pin `now` to mid-day Brussels so a 30-min-old session sits cleanly
    // inside "today" — without pinning, runs around midnight Brussels
    // straddle the day boundary and only the post-midnight slice counts.
    const now = new Date("2026-06-02T12:00:00Z");
    const recent = new Date(now.getTime() - 60 * 60 * 1000); // 1h ago
    const sessionStart = new Date(now.getTime() - 30 * 60 * 1000); // 30m ago
    const service = makeService(
      [{ playedAt: recent }, { playedAt: recent }, { playedAt: recent }],
      [{ startedAt: sessionStart, endedAt: null }]
    );

    const result = await service.getActivityIntensity(now);

    expect(result.lolMatches24h).toBe(3);
    // 30 min today → steamNorm = 0.25; lolNorm = 3/6 = 0.5 → max = 0.5
    expect(result.steamMinutesToday).toBeGreaterThanOrEqual(29);
    expect(result.steamMinutesToday).toBeLessThanOrEqual(31);
    expect(result.intensity).toBeCloseTo(0.5, 1);
    expect(result.timeZone).toBe("Europe/Brussels");
    expect(typeof result.asOf).toBe("string");
  });

  it("reports zero intensity on an idle day", async () => {
    const service = makeService([], []);
    const result = await service.getActivityIntensity();
    expect(result.lolMatches24h).toBe(0);
    expect(result.steamMinutesToday).toBe(0);
    expect(result.intensity).toBe(0);
  });
});
