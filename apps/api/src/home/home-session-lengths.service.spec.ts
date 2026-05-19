import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import {
  HomeSessionLengthsService,
  type LolSessionMatch,
  histogramSessionLengths,
  stitchLolSessions,
} from "./home-session-lengths.service";

const m = (playedAt: string, durationSec: number): LolSessionMatch => ({
  playedAt: new Date(playedAt),
  durationSec,
});

describe("stitchLolSessions", () => {
  it("returns an empty array for empty input", () => {
    expect(stitchLolSessions([], 30)).toEqual([]);
  });

  it("treats a single match as its own session", () => {
    const sessions = stitchLolSessions([m("2026-05-01T18:00:00Z", 1800)], 30);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.durationMinutes).toBe(30);
  });

  it("collapses two matches within the gap into one session", () => {
    // Match 1: 18:00 + 30min ends at 18:30. Gap of 10 min → next at 18:40.
    const sessions = stitchLolSessions(
      [m("2026-05-01T18:00:00Z", 1800), m("2026-05-01T18:40:00Z", 1800)],
      30
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.durationMinutes).toBe(60);
  });

  it("splits two matches separated by more than the gap", () => {
    // Match 1: 18:00 + 30min ends at 18:30. Gap of 31 min → next at 19:01.
    const sessions = stitchLolSessions(
      [m("2026-05-01T18:00:00Z", 1800), m("2026-05-01T19:01:00Z", 1800)],
      30
    );
    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.durationMinutes).toBe(30);
    expect(sessions[1]?.durationMinutes).toBe(30);
  });

  it("groups three matches with mixed gaps correctly", () => {
    // Match 1 ends 18:30 → Match 2 starts 18:40 (10min gap, stitched).
    // Match 2 ends 19:10 → Match 3 starts 20:00 (50min gap, split).
    const sessions = stitchLolSessions(
      [
        m("2026-05-01T18:00:00Z", 1800),
        m("2026-05-01T18:40:00Z", 1800),
        m("2026-05-01T20:00:00Z", 1800),
      ],
      30
    );
    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.durationMinutes).toBe(60);
    expect(sessions[1]?.durationMinutes).toBe(30);
  });

  it("sorts unordered input before stitching", () => {
    const sessions = stitchLolSessions(
      [m("2026-05-01T18:40:00Z", 1800), m("2026-05-01T18:00:00Z", 1800)],
      30
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.startedAt.toISOString()).toBe("2026-05-01T18:00:00.000Z");
  });

  it("skips matches with non-positive duration", () => {
    const sessions = stitchLolSessions(
      [m("2026-05-01T18:00:00Z", 0), m("2026-05-01T18:30:00Z", 1800)],
      30
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.durationMinutes).toBe(30);
  });
});

describe("histogramSessionLengths", () => {
  it("returns five zero buckets in canonical order for empty input", () => {
    const buckets = histogramSessionLengths([], []);
    expect(buckets.map((b) => b.label)).toEqual([
      "<30m",
      "30m–1h",
      "1h–2h",
      "2h–4h",
      "4h+",
    ]);
    expect(buckets.every((b) => b.lolCount === 0 && b.steamCount === 0)).toBe(true);
  });

  it("places sessions at canonical bucket boundaries", () => {
    // 29m → <30m, 30m → 30m–1h, 60m → 1h–2h, 120m → 2h–4h, 240m → 4h+
    const buckets = histogramSessionLengths([29, 30, 60, 120, 240], []);
    expect(buckets[0]?.lolCount).toBe(1); // <30m
    expect(buckets[1]?.lolCount).toBe(1); // 30m–1h
    expect(buckets[2]?.lolCount).toBe(1); // 1h–2h
    expect(buckets[3]?.lolCount).toBe(1); // 2h–4h
    expect(buckets[4]?.lolCount).toBe(1); // 4h+
  });

  it("counts LoL and Steam independently into the same buckets", () => {
    const buckets = histogramSessionLengths([45, 45], [90]);
    // 45m → 30m–1h, 90m → 1h–2h
    expect(buckets[1]?.lolCount).toBe(2);
    expect(buckets[1]?.steamCount).toBe(0);
    expect(buckets[2]?.lolCount).toBe(0);
    expect(buckets[2]?.steamCount).toBe(1);
  });

  it("ignores non-positive and non-finite durations", () => {
    const buckets = histogramSessionLengths(
      [0, -10, Number.NaN, Number.POSITIVE_INFINITY, 30],
      []
    );
    // Only the 30 survives.
    expect(buckets[1]?.lolCount).toBe(1);
    const total = buckets.reduce((sum, b) => sum + b.lolCount, 0);
    expect(total).toBe(1);
  });
});

describe("HomeSessionLengthsService.getSessionLengths", () => {
  function makeService(
    matches: { playedAt: Date; durationSec: number }[],
    sessions: { startedAt: Date; endedAt: Date | null }[]
  ) {
    const prisma = {
      match: { findMany: vi.fn().mockResolvedValue(matches) },
      steamPlaySession: { findMany: vi.fn().mockResolvedValue(sessions) },
    } as unknown as PrismaService;
    return new HomeSessionLengthsService(prisma);
  }

  it("returns five empty buckets when there is no activity", async () => {
    const service = makeService([], []);
    const result = await service.getSessionLengths();
    expect(result.buckets).toHaveLength(5);
    expect(result.lolSessionCount).toBe(0);
    expect(result.steamSessionCount).toBe(0);
    expect(result.buckets.every((b) => b.lolCount === 0 && b.steamCount === 0)).toBe(
      true
    );
  });

  it("stitches matches into sessions and counts steam sessions, skipping in-flight", async () => {
    const service = makeService(
      // Two matches within the stitch gap collapse to one ~70min session (1h–2h bucket).
      [
        { playedAt: new Date("2026-05-01T18:00:00Z"), durationSec: 1800 },
        { playedAt: new Date("2026-05-01T18:40:00Z"), durationSec: 2400 },
      ],
      [
        // 45min session → 30m–1h bucket.
        {
          startedAt: new Date("2026-05-01T20:00:00Z"),
          endedAt: new Date("2026-05-01T20:45:00Z"),
        },
        // Still-running session — must be skipped.
        { startedAt: new Date("2026-05-01T22:00:00Z"), endedAt: null },
      ]
    );
    const result = await service.getSessionLengths();
    expect(result.lolSessionCount).toBe(1);
    expect(result.steamSessionCount).toBe(1);
    expect(result.buckets[2]?.lolCount).toBe(1); // 1h–2h
    expect(result.buckets[1]?.steamCount).toBe(1); // 30m–1h
  });

  it("filters out non-positive steam session durations", async () => {
    const service = makeService(
      [],
      [
        // Zero-length session (start == end) → 0 minutes → filtered.
        {
          startedAt: new Date("2026-05-01T20:00:00Z"),
          endedAt: new Date("2026-05-01T20:00:00Z"),
        },
      ]
    );
    const result = await service.getSessionLengths();
    expect(result.steamSessionCount).toBe(0);
  });
});
