import { describe, expect, it } from "vitest";
import { type LpSnapshotPair, computeLpDeltaMap, matchLpDelta } from "./lp-delta.ts";

function pair(overrides: LpSnapshotPair & { matchId?: string }) {
  return { matchId: "M_1", ...overrides };
}

describe("matchLpDelta", () => {
  it("returns null when either snapshot half is missing", () => {
    expect(
      matchLpDelta({ snapshotTier: "GOLD", snapshotRank: "II", snapshotLp: 50 })
    ).toBeNull();
    expect(
      matchLpDelta({
        snapshotTierBefore: "GOLD",
        snapshotRankBefore: "II",
        snapshotLpBefore: 30,
      })
    ).toBeNull();
  });

  it("treats null (api rows) and undefined (web summaries) alike", () => {
    expect(
      matchLpDelta({
        snapshotTier: "GOLD",
        snapshotRank: "II",
        snapshotLp: 50,
        snapshotTierBefore: null,
        snapshotRankBefore: null,
        snapshotLpBefore: null,
      })
    ).toBeNull();
  });

  it("normalizes both halves to one LP scale and reports the difference", () => {
    expect(
      matchLpDelta({
        snapshotTier: "GOLD",
        snapshotRank: "II",
        snapshotLp: 50,
        snapshotTierBefore: "GOLD",
        snapshotRankBefore: "II",
        snapshotLpBefore: 30,
      })
    ).toBe(20);
  });

  it("handles a cross-tier promotion (gold I → platinum IV)", () => {
    expect(
      matchLpDelta({
        snapshotTier: "PLATINUM",
        snapshotRank: "IV",
        snapshotLp: 10,
        snapshotTierBefore: "GOLD",
        snapshotRankBefore: "I",
        snapshotLpBefore: 85,
      })
    ).toBe(25);
  });

  it("ignores the rank field at MASTER+ where divisions don't apply", () => {
    expect(
      matchLpDelta({
        snapshotTier: "MASTER",
        snapshotRank: "I",
        snapshotLp: 120,
        snapshotTierBefore: "MASTER",
        snapshotRankBefore: "IV",
        snapshotLpBefore: 100,
      })
    ).toBe(20);
  });
});

describe("computeLpDeltaMap", () => {
  it("returns an empty map for an empty list", () => {
    expect(computeLpDeltaMap([]).size).toBe(0);
  });

  it("keys deltas by matchId and skips matches without both halves", () => {
    const map = computeLpDeltaMap([
      pair({
        matchId: "M_full",
        snapshotTier: "SILVER",
        snapshotRank: "I",
        snapshotLp: 40,
        snapshotTierBefore: "SILVER",
        snapshotRankBefore: "I",
        snapshotLpBefore: 55,
      }),
      pair({
        matchId: "M_half",
        snapshotTier: "SILVER",
        snapshotRank: "I",
        snapshotLp: 40,
      }),
    ]);
    expect([...map.entries()]).toEqual([["M_full", -15]]);
  });
});
