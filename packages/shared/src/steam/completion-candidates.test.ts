import { describe, expect, it } from "vitest";
import {
  UNRATED_ACHIEVEMENT_COST,
  buildCompletionCandidates,
  lockedAchievementCost,
} from "./completion-candidates.ts";

describe("lockedAchievementCost", () => {
  it("charges the share of players who do not have the achievement", () => {
    expect(lockedAchievementCost(90)).toBeCloseTo(0.1);
    expect(lockedAchievementCost(25)).toBeCloseTo(0.75);
  });

  it("caps the floor at full cost so 0.0% rarity cannot dominate", () => {
    expect(lockedAchievementCost(0)).toBe(1);
    expect(lockedAchievementCost(-1)).toBe(1);
  });

  it("charges the neutral cost when rarity has not been polled", () => {
    expect(lockedAchievementCost(null)).toBe(UNRATED_ACHIEVEMENT_COST);
  });
});

describe("buildCompletionCandidates", () => {
  it("drops untouched and finished games", () => {
    const candidates = buildCompletionCandidates(
      [
        { appid: 1, total: 3 }, // untouched: all 3 locked
        { appid: 2, total: 3 }, // finished: nothing locked
        { appid: 3, total: 3 }, // started: 1 locked
      ],
      [
        { appid: 1, globalPercent: 50 },
        { appid: 1, globalPercent: 50 },
        { appid: 1, globalPercent: 50 },
        { appid: 3, globalPercent: 50 },
      ]
    );
    expect(candidates.map((c) => c.appid)).toEqual([3]);
    expect(candidates[0]).toMatchObject({ total: 3, unlocked: 2, remaining: 1 });
  });

  it("ranks several common achievements ahead of one near-floor achievement", () => {
    const candidates = buildCompletionCandidates(
      [
        { appid: 10, total: 20 },
        { appid: 20, total: 20 },
      ],
      [
        { appid: 10, globalPercent: 0.4 },
        { appid: 20, globalPercent: 90 },
        { appid: 20, globalPercent: 88 },
        { appid: 20, globalPercent: 92 },
      ]
    );
    expect(candidates.map((c) => c.appid)).toEqual([20, 10]);
    expect(candidates[0]?.score).toBeCloseTo(0.3);
    expect(candidates[1]?.score).toBeCloseTo(0.996);
  });

  it("reports the average and the blocker over rated locked achievements only", () => {
    const [c] = buildCompletionCandidates(
      [{ appid: 7, total: 5 }],
      [
        { appid: 7, globalPercent: 40 },
        { appid: 7, globalPercent: 10 },
        { appid: 7, globalPercent: null },
      ]
    );
    expect(c?.remainingAvgPercent).toBeCloseTo(25);
    expect(c?.remainingMinPercent).toBe(10);
    expect(c?.score).toBeCloseTo(0.6 + 0.9 + UNRATED_ACHIEVEMENT_COST);
  });

  it("returns null rarity fields when no locked achievement has been polled", () => {
    const [c] = buildCompletionCandidates(
      [{ appid: 7, total: 2 }],
      [{ appid: 7, globalPercent: null }]
    );
    expect(c?.remainingAvgPercent).toBeNull();
    expect(c?.remainingMinPercent).toBeNull();
    expect(c?.score).toBe(UNRATED_ACHIEVEMENT_COST);
  });

  it("breaks score ties on fewer remaining, then appid", () => {
    const candidates = buildCompletionCandidates(
      [
        { appid: 3, total: 10 },
        { appid: 2, total: 10 },
        { appid: 1, total: 10 },
      ],
      [
        { appid: 3, globalPercent: 50 },
        { appid: 2, globalPercent: 75 },
        { appid: 2, globalPercent: 75 },
        { appid: 1, globalPercent: 50 },
      ]
    );
    expect(candidates.map((c) => c.appid)).toEqual([1, 3, 2]);
  });
});
