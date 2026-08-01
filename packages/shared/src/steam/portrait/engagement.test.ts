import { describe, expect, it } from "vitest";
import {
  COMPLETIONIST_PLAYTIME_MINUTES,
  MEANINGFUL_PLAYTIME_MINUTES,
  RECENT_PLAYTIME_MINUTES,
  engagementCohort,
  excludeBarelyTouched,
  isMeaningfullyPlayed,
  selectEngagementCohort,
  summariseEngagement,
} from "./engagement.ts";

const game = (playtimeForeverMinutes: number, launchDayCount?: number) => ({
  playtimeForeverMinutes,
  ...(launchDayCount === undefined ? {} : { launchDayCount }),
});

describe("isMeaningfullyPlayed", () => {
  it("clears at exactly the floor", () => {
    expect(isMeaningfullyPlayed(game(MEANINGFUL_PLAYTIME_MINUTES))).toBe(true);
    expect(isMeaningfullyPlayed(game(MEANINGFUL_PLAYTIME_MINUTES - 1))).toBe(false);
  });

  // The short-loop rescue: two runs of a deckbuilder across two evenings is
  // an opinion formed, even at 40 minutes total.
  it("rescues short-loop games with multiple launch days", () => {
    expect(isMeaningfullyPlayed(game(40, 2))).toBe(true);
    expect(isMeaningfullyPlayed(game(40, 1))).toBe(false);
  });

  // Session data is dev-machine-bound and misses launches outright, so the
  // minute floor alone has to produce a correct cohort.
  it("does not depend on session data being present", () => {
    expect(isMeaningfullyPlayed(game(120))).toBe(true);
    expect(isMeaningfullyPlayed(game(5))).toBe(false);
  });
});

describe("engagementCohort", () => {
  it("splits the three cohorts", () => {
    expect(engagementCohort(game(600))).toBe("meaningful");
    expect(engagementCohort(game(12))).toBe("tasted");
    expect(engagementCohort(game(0))).toBe("ghost");
  });

  it("counts a rescued short-loop game as meaningful, not tasted", () => {
    expect(engagementCohort(game(12, 3))).toBe("meaningful");
  });

  it("leaves a never-launched game a ghost regardless of session noise", () => {
    expect(engagementCohort(game(0, 5))).toBe("ghost");
    expect(engagementCohort(game(0, 0))).toBe("ghost");
  });
});

describe("excludeBarelyTouched", () => {
  it("keeps only the cleared cohort and preserves order", () => {
    expect(excludeBarelyTouched([game(600), game(12), game(0), game(61)])).toEqual([
      game(600),
      game(61),
    ]);
  });

  it("passes richer rows through unchanged", () => {
    const rows = [
      { appid: 1, name: "kept", playtimeForeverMinutes: 300 },
      { appid: 2, name: "dropped", playtimeForeverMinutes: 3 },
    ];
    expect(excludeBarelyTouched(rows)).toEqual([rows[0]]);
  });
});

describe("selectEngagementCohort", () => {
  it("selects the inverted cohorts the Anti-Portrait reads", () => {
    const library = [game(600), game(12), game(0), game(45), game(0)];
    expect(selectEngagementCohort(library, "tasted")).toEqual([game(12), game(45)]);
    expect(selectEngagementCohort(library, "ghost")).toEqual([game(0), game(0)]);
  });
});

describe("summariseEngagement", () => {
  // The shape of the real library on 2026-08-01, scaled down: almost every
  // hour sits in the cleared cohort while most games do not.
  it("counts cohorts and splits minutes", () => {
    expect(
      summariseEngagement([game(1200), game(600), game(30), game(0), game(0)])
    ).toEqual({
      owned: 5,
      meaningful: 2,
      tasted: 1,
      ghosts: 2,
      totalMinutes: 1830,
      meaningfulMinutes: 1800,
    });
  });

  it("handles an empty library without dividing by anything", () => {
    expect(summariseEngagement([])).toEqual({
      owned: 0,
      meaningful: 0,
      tasted: 0,
      ghosts: 0,
      totalMinutes: 0,
      meaningfulMinutes: 0,
    });
  });
});

describe("thresholds", () => {
  it("orders the floors from most to least permissive", () => {
    expect(RECENT_PLAYTIME_MINUTES).toBeLessThan(MEANINGFUL_PLAYTIME_MINUTES);
    expect(MEANINGFUL_PLAYTIME_MINUTES).toBeLessThan(COMPLETIONIST_PLAYTIME_MINUTES);
  });
});
