import { describe, expect, it } from "vitest";
import {
  STEAM_LAUNCH_MS,
  isPlausibleLastPlayed,
  isSingleAchievement,
  selectColdest,
  selectQuickestAbandons,
  selectSingleAchievement,
  summariseTasted,
} from "./abandonment";

const played = (playtimeForeverMinutes: number) => ({ playtimeForeverMinutes });

describe("summariseTasted", () => {
  it("reports the median rather than the mean, which one long taste would drag", () => {
    const summary = summariseTasted([played(1), played(3), played(22), played(59)]);

    expect(summary).toEqual({
      count: 4,
      totalMinutes: 85,
      // mean is 21.25 and the median 12.5 — the mean is carried by one game.
      medianMinutes: 12.5,
    });
  });

  it("returns zeroes rather than NaN for an empty cohort", () => {
    expect(summariseTasted([])).toEqual({
      count: 0,
      totalMinutes: 0,
      medianMinutes: 0,
    });
  });
});

describe("selectQuickestAbandons", () => {
  it("orders shortest first and caps the list", () => {
    const games = [played(22), played(1), played(59), played(3), played(15), played(5)];

    expect(selectQuickestAbandons(games, 3)).toEqual([played(1), played(3), played(5)]);
  });

  it("does not mutate the caller's list", () => {
    const games = [played(22), played(1)];
    selectQuickestAbandons(games);

    expect(games).toEqual([played(22), played(1)]);
  });
});

describe("isSingleAchievement", () => {
  it("catches one unlocked out of many", () => {
    expect(isSingleAchievement({ total: 54, unlocked: 1 })).toBe(true);
    expect(isSingleAchievement({ total: 2, unlocked: 1 })).toBe(true);
  });

  it("rejects a one-achievement schema, which is 100% completion", () => {
    expect(isSingleAchievement({ total: 1, unlocked: 1 })).toBe(false);
  });

  it("rejects games with no unlocks and games still going", () => {
    expect(isSingleAchievement({ total: 54, unlocked: 0 })).toBe(false);
    expect(isSingleAchievement({ total: 54, unlocked: 2 })).toBe(false);
  });

  it("selects the cohort without touching the rest", () => {
    const games = [
      { total: 54, unlocked: 1 },
      { total: 1, unlocked: 1 },
      { total: 12, unlocked: 12 },
    ];

    expect(selectSingleAchievement(games)).toEqual([{ total: 54, unlocked: 1 }]);
  });
});

describe("isPlausibleLastPlayed", () => {
  it("rejects the epoch sentinel Steam answers with for some pre-cloud titles", () => {
    // Measured against Call of Duty: Modern Warfare 2 (2009), which reports
    // 1970-01-02 while carrying 410 recorded minutes.
    expect(isPlausibleLastPlayed(new Date("1970-01-02T00:00:00.000Z"))).toBe(false);
  });

  it("rejects null and accepts anything from Steam's launch onward", () => {
    expect(isPlausibleLastPlayed(null)).toBe(false);
    expect(isPlausibleLastPlayed(new Date(STEAM_LAUNCH_MS))).toBe(true);
    expect(isPlausibleLastPlayed(new Date(STEAM_LAUNCH_MS - 1))).toBe(false);
  });
});

describe("selectColdest", () => {
  const game = (name: string, lastPlayed: string | null) => ({
    name,
    lastPlayed: lastPlayed === null ? null : new Date(lastPlayed),
  });

  it("picks the oldest plausible last-played date", () => {
    const coldest = selectColdest([
      game("Elden Ring", "2026-07-30T00:00:00.000Z"),
      game("Mirror's Edge", "2012-07-18T00:00:00.000Z"),
      game("Borderlands", "2012-07-29T00:00:00.000Z"),
    ]);

    expect(coldest?.name).toBe("Mirror's Edge");
  });

  it("skips the sentinel rather than crowning it", () => {
    const coldest = selectColdest([
      game("Modern Warfare 2", "1970-01-02T00:00:00.000Z"),
      game("Mirror's Edge", "2012-07-18T00:00:00.000Z"),
    ]);

    expect(coldest?.name).toBe("Mirror's Edge");
  });

  it("returns null when nothing carries a usable date", () => {
    expect(selectColdest([game("Unplayed", null)])).toBeNull();
    expect(selectColdest([])).toBeNull();
  });
});
