import type { RankHistoryPoint } from "@vyoh/shared";
import { detectSeasons } from "@vyoh/shared/lol/rank-history";
import { describe, expect, it } from "vitest";

const DAY = 86_400_000;
const QUEUE = "RANKED_SOLO_5x5";

function point(iso: string, tier: string, rank: string, lp: number): RankHistoryPoint {
  return { capturedAt: iso, queueId: QUEUE, tier, rank, leaguePoints: lp };
}

function isoAt(baseMs: number, offsetDays: number): string {
  return new Date(baseMs + offsetDays * DAY).toISOString();
}

describe("detectSeasons", () => {
  it("returns empty array for no data", () => {
    expect(detectSeasons([])).toEqual([]);
  });

  it("returns a single ongoing season when no boundaries are detected", () => {
    const base = Date.now();
    const seasons = detectSeasons([
      point(isoAt(base, 0), "DIAMOND", "IV", 50),
      point(isoAt(base, 1), "DIAMOND", "IV", 70),
      point(isoAt(base, 2), "DIAMOND", "III", 10),
    ]);
    expect(seasons).toHaveLength(1);
    expect(seasons[0]?.ongoing).toBe(true);
    expect(seasons[0]?.endRank.tier).toBe("DIAMOND");
    expect(seasons[0]?.endRank.rank).toBe("III");
  });

  it("does not flag a normal demotion (small LP drop, small time gap)", () => {
    const base = Date.now();
    const seasons = detectSeasons([
      point(isoAt(base, 0), "PLATINUM", "IV", 5),
      point(isoAt(base, 0.05), "GOLD", "I", 75),
    ]);
    expect(seasons).toHaveLength(1);
    expect(seasons[0]?.ongoing).toBe(true);
  });

  it("does not flag a long losing streak with small time gap", () => {
    // Player drops 600 LP in a single day of grinding — not a season reset.
    const base = Date.now();
    const seasons = detectSeasons([
      point(isoAt(base, 0), "DIAMOND", "I", 50), // 2350 LP
      point(isoAt(base, 0.5), "PLATINUM", "I", 50), // 1750 LP — 600 drop, but only 12h gap
    ]);
    expect(seasons).toHaveLength(1);
  });

  it("detects a soft reset: large LP drop + long inactivity", () => {
    const base = Date.now();
    const seasons = detectSeasons([
      point(isoAt(base, 0), "DIAMOND", "II", 60),
      point(isoAt(base, 1), "DIAMOND", "II", 80),
      // Two months later, comes back at Emerald III (soft reset)
      point(isoAt(base, 60), "EMERALD", "III", 0),
      point(isoAt(base, 62), "EMERALD", "II", 30),
    ]);
    expect(seasons).toHaveLength(2);
    const past = seasons[0];
    const ongoing = seasons[1];
    expect(past?.ongoing).toBe(false);
    expect(past?.endRank.tier).toBe("DIAMOND");
    expect(past?.endRank.rank).toBe("II");
    expect(past?.endRank.leaguePoints).toBe(80);
    expect(ongoing?.ongoing).toBe(true);
    expect(ongoing?.endRank.tier).toBe("EMERALD");
    expect(ongoing?.endRank.rank).toBe("II");
  });

  it("captures peak rank within a season independent of end rank", () => {
    const base = Date.now();
    const seasons = detectSeasons([
      point(isoAt(base, 0), "GOLD", "IV", 0),
      point(isoAt(base, 5), "PLATINUM", "II", 50), // peak
      point(isoAt(base, 10), "GOLD", "I", 80), // demoted back
    ]);
    expect(seasons).toHaveLength(1);
    expect(seasons[0]?.peakRank.tier).toBe("PLATINUM");
    expect(seasons[0]?.peakRank.rank).toBe("II");
    expect(seasons[0]?.endRank.tier).toBe("GOLD");
    expect(seasons[0]?.endRank.rank).toBe("I");
  });

  it("detects multiple consecutive seasons", () => {
    const base = Date.now();
    const seasons = detectSeasons([
      point(isoAt(base, 0), "DIAMOND", "II", 60),
      point(isoAt(base, 50), "EMERALD", "III", 0), // reset 1
      point(isoAt(base, 51), "EMERALD", "II", 30),
      point(isoAt(base, 130), "GOLD", "I", 50), // reset 2
      point(isoAt(base, 132), "GOLD", "I", 80),
    ]);
    expect(seasons).toHaveLength(3);
    expect(seasons[0]?.ongoing).toBe(false);
    expect(seasons[1]?.ongoing).toBe(false);
    expect(seasons[2]?.ongoing).toBe(true);
  });

  it("handles Master+ tiers correctly (rank ignored)", () => {
    const base = Date.now();
    const seasons = detectSeasons([
      point(isoAt(base, 0), "MASTER", "I", 250),
      point(isoAt(base, 1), "MASTER", "I", 320),
    ]);
    expect(seasons).toHaveLength(1);
    expect(seasons[0]?.endRank.totalLp).toBe(7 * 400 + 320);
  });
});
