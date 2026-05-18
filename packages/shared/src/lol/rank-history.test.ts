import { describe, expect, it } from "vitest";
import {
  type RankHistoryPoint,
  detectSeasons,
  formatRank,
  normalizeLp,
} from "./rank-history.ts";

describe("normalizeLp", () => {
  it("anchors IRON IV 0LP at 0", () => {
    expect(normalizeLp("IRON", "IV", 0)).toBe(0);
  });

  it("adds 100 LP per division within a tier", () => {
    expect(normalizeLp("BRONZE", "IV", 0)).toBe(400);
    expect(normalizeLp("BRONZE", "III", 0)).toBe(500);
    expect(normalizeLp("BRONZE", "II", 0)).toBe(600);
    expect(normalizeLp("BRONZE", "I", 0)).toBe(700);
  });

  it("places DIAMOND I just below MASTER at 2700", () => {
    expect(normalizeLp("DIAMOND", "I", 0)).toBe(2700);
    expect(normalizeLp("DIAMOND", "I", 100)).toBe(2800);
  });

  it("drops rank offset for MASTER+ tiers (rank field is always 'I' from Riot)", () => {
    expect(normalizeLp("MASTER", "I", 0)).toBe(2800);
    expect(normalizeLp("GRANDMASTER", "I", 200)).toBe(3000);
    expect(normalizeLp("CHALLENGER", "I", 500)).toBe(3300);
  });

  it("upper-cases mixed-case tier and rank input", () => {
    expect(normalizeLp("platinum", "ii", 45)).toBe(normalizeLp("PLATINUM", "II", 45));
  });

  it("falls back to IRON IV when the tier is unknown", () => {
    expect(normalizeLp("UNKNOWN", "IV", 0)).toBe(0);
  });

  it("ignores rank when MASTER+ even if Riot ever sent a non-I division", () => {
    expect(normalizeLp("MASTER", "IV", 100)).toBe(2900);
  });
});

describe("formatRank", () => {
  it("renders tier + division + LP for sub-MASTER tiers", () => {
    expect(formatRank("PLATINUM", "II", 45)).toBe("Platinum II 45LP");
    expect(formatRank("IRON", "IV", 0)).toBe("Iron IV 0LP");
  });

  it("omits the division for MASTER and above", () => {
    expect(formatRank("MASTER", "I", 100)).toBe("Master 100LP");
    expect(formatRank("GRANDMASTER", "I", 500)).toBe("Grandmaster 500LP");
    expect(formatRank("CHALLENGER", "I", 1500)).toBe("Challenger 1500LP");
  });

  it("normalises mixed-case tier input to the display form", () => {
    expect(formatRank("diamond", "I", 12)).toBe("Diamond I 12LP");
  });

  it("passes the tier through verbatim when display lookup misses", () => {
    expect(formatRank("UNKNOWN", "I", 0)).toBe("UNKNOWN I 0LP");
  });
});

describe("detectSeasons", () => {
  const point = (
    capturedAt: string,
    tier: string,
    rank: string,
    leaguePoints: number
  ): RankHistoryPoint => ({
    capturedAt,
    queueId: "RANKED_SOLO_5x5",
    tier,
    rank,
    leaguePoints,
  });

  it("returns an empty array for empty input", () => {
    expect(detectSeasons([])).toEqual([]);
  });

  it("returns one ongoing season for a single snapshot", () => {
    const p = point("2026-05-01T00:00:00Z", "GOLD", "II", 40);
    const seasons = detectSeasons([p]);
    expect(seasons).toHaveLength(1);
    expect(seasons[0]?.ongoing).toBe(true);
    expect(seasons[0]?.startAt).toBe(p.capturedAt);
    expect(seasons[0]?.endAt).toBe(p.capturedAt);
    expect(seasons[0]?.peakRank.totalLp).toBe(normalizeLp("GOLD", "II", 40));
  });

  it("groups continuous play into one season and identifies the LP peak", () => {
    const points = [
      point("2026-04-01T00:00:00Z", "SILVER", "IV", 50),
      point("2026-04-15T00:00:00Z", "GOLD", "II", 30),
      point("2026-05-01T00:00:00Z", "GOLD", "I", 80),
      point("2026-05-10T00:00:00Z", "GOLD", "III", 10),
    ];
    const seasons = detectSeasons(points);
    expect(seasons).toHaveLength(1);
    const [season] = seasons;
    expect(season?.startAt).toBe(points[0]?.capturedAt);
    expect(season?.endAt).toBe(points[points.length - 1]?.capturedAt);
    expect(season?.peakRank.tier).toBe("GOLD");
    expect(season?.peakRank.rank).toBe("I");
    expect(season?.peakRank.leaguePoints).toBe(80);
    expect(season?.ongoing).toBe(true);
  });

  it("splits on a large LP drop after a >=7 day gap (split reset)", () => {
    const points = [
      point("2026-01-01T00:00:00Z", "DIAMOND", "IV", 50),
      point("2026-02-15T00:00:00Z", "GOLD", "II", 0),
    ];
    const seasons = detectSeasons(points);
    expect(seasons).toHaveLength(2);
    expect(seasons[0]?.ongoing).toBe(false);
    expect(seasons[1]?.ongoing).toBe(true);
    expect(seasons[0]?.endRank.tier).toBe("DIAMOND");
    expect(seasons[1]?.startRank.tier).toBe("GOLD");
  });

  it("does not split on a small LP drop even after a long gap (normal demotion)", () => {
    const points = [
      point("2026-01-01T00:00:00Z", "GOLD", "II", 50),
      point("2026-02-15T00:00:00Z", "GOLD", "III", 90),
    ];
    expect(detectSeasons(points)).toHaveLength(1);
  });

  it("does not split on a large LP drop within the cooldown gap (intra-season tilt)", () => {
    const points = [
      point("2026-05-01T00:00:00Z", "DIAMOND", "IV", 50),
      point("2026-05-03T00:00:00Z", "GOLD", "II", 0),
    ];
    expect(detectSeasons(points)).toHaveLength(1);
  });

  it("handles multiple seasons with only the last marked ongoing", () => {
    const points = [
      point("2025-01-01T00:00:00Z", "PLATINUM", "I", 90),
      point("2025-03-01T00:00:00Z", "GOLD", "III", 0),
      point("2025-09-01T00:00:00Z", "DIAMOND", "II", 80),
      point("2025-11-01T00:00:00Z", "SILVER", "II", 10),
    ];
    const seasons = detectSeasons(points);
    expect(seasons).toHaveLength(3);
    expect(seasons.map((s) => s.ongoing)).toEqual([false, false, true]);
  });
});
