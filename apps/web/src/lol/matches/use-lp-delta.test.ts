import type { MatchSummary } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { computeLpDeltaMap } from "./use-lp-delta";

function buildMatch(overrides: Partial<MatchSummary>): MatchSummary {
  return {
    matchId: overrides.matchId ?? "M_1",
    queueType: overrides.queueType ?? "Ranked Solo",
    champion: overrides.champion ?? "Ahri",
    kills: overrides.kills ?? 5,
    deaths: overrides.deaths ?? 3,
    assists: overrides.assists ?? 7,
    win: overrides.win ?? true,
    durationSec: overrides.durationSec ?? 1800,
    playedAt: overrides.playedAt ?? "2026-05-19T12:00:00.000Z",
    remake: overrides.remake ?? false,
    teamPosition: overrides.teamPosition ?? "",
    gameVersion: overrides.gameVersion ?? "",
    visionScore: overrides.visionScore ?? 0,
    damageShare: overrides.damageShare ?? 0,
    firstBloodKill: overrides.firstBloodKill ?? false,
    csAt10: overrides.csAt10 ?? 0,
    csAt15: overrides.csAt15 ?? 0,
    goldAt10: overrides.goldAt10 ?? 0,
    goldAt15: overrides.goldAt15 ?? 0,
    teamGoldDiffAt15: overrides.teamGoldDiffAt15 ?? 0,
    deathTimings: overrides.deathTimings ?? [],
    deathXs: overrides.deathXs ?? [],
    deathYs: overrides.deathYs ?? [],
    killTimings: overrides.killTimings ?? [],
    killXs: overrides.killXs ?? [],
    killYs: overrides.killYs ?? [],
    laneOpponent: overrides.laneOpponent ?? null,
    ...overrides,
  };
}

describe("computeLpDeltaMap", () => {
  it("returns an empty map for an empty list", () => {
    expect(computeLpDeltaMap([]).size).toBe(0);
  });

  it("skips matches missing either snapshot half", () => {
    const map = computeLpDeltaMap([
      buildMatch({
        matchId: "no-before",
        snapshotTier: "GOLD",
        snapshotRank: "IV",
        snapshotLp: 50,
      }),
      buildMatch({
        matchId: "no-after",
        snapshotTierBefore: "GOLD",
        snapshotRankBefore: "IV",
        snapshotLpBefore: 30,
      }),
    ]);
    expect(map.size).toBe(0);
  });

  it("normalizes both halves to a single LP scale and reports the delta", () => {
    // GOLD IV 50 LP → tierIndex 3 × 400 + IV offset 0 + 50 = 1250
    // GOLD IV 70 LP →                              + 70 = 1270 → +20 delta
    const map = computeLpDeltaMap([
      buildMatch({
        matchId: "M_1",
        snapshotTier: "GOLD",
        snapshotRank: "IV",
        snapshotLp: 70,
        snapshotTierBefore: "GOLD",
        snapshotRankBefore: "IV",
        snapshotLpBefore: 50,
      }),
    ]);
    expect(map.get("M_1")).toBe(20);
  });

  it("handles cross-tier promotion deltas (gold → platinum)", () => {
    // GOLD I 95 → 3×400 + 300 + 95 = 1595
    // PLATINUM IV 12 → 4×400 + 0 + 12 = 1612 → +17
    const map = computeLpDeltaMap([
      buildMatch({
        matchId: "promo",
        snapshotTierBefore: "GOLD",
        snapshotRankBefore: "I",
        snapshotLpBefore: 95,
        snapshotTier: "PLATINUM",
        snapshotRank: "IV",
        snapshotLp: 12,
      }),
    ]);
    expect(map.get("promo")).toBe(17);
  });

  it("ignores the rank field at MASTER+ where divisions don't apply", () => {
    // MASTER any 50 LP → 7×400 + 50 = 2850
    // MASTER any 70 LP → 2870 → +20
    const map = computeLpDeltaMap([
      buildMatch({
        matchId: "master",
        snapshotTier: "MASTER",
        snapshotRank: "I",
        snapshotLp: 70,
        snapshotTierBefore: "MASTER",
        snapshotRankBefore: "I",
        snapshotLpBefore: 50,
      }),
    ]);
    expect(map.get("master")).toBe(20);
  });
});
