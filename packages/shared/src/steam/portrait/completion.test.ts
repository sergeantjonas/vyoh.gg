import { describe, expect, it } from "vitest";
import {
  FINISHED_COMPLETION_SHARE,
  completionShare,
  selectCompletionCohort,
  summariseCompletion,
} from "./completion";

const game = (total: number, unlocked: number, playtimeForeverMinutes: number) => ({
  total,
  unlocked,
  playtimeForeverMinutes,
});

describe("selectCompletionCohort", () => {
  it("drops games that have no achievements to complete", () => {
    // CS2 and most pre-2010 titles ship no schema. Reading those as 0% would
    // say "finishes nothing" about a library that predates achievements.
    const games = [game(0, 0, 60_000), game(40, 20, 60_000)];

    expect(selectCompletionCohort(games)).toEqual([game(40, 20, 60_000)]);
  });

  it("drops games with less than ten hours in them", () => {
    const games = [game(40, 3, 599), game(40, 3, 600)];

    expect(selectCompletionCohort(games)).toEqual([game(40, 3, 600)]);
  });
});

describe("summariseCompletion", () => {
  it("counts finished and perfect games against the cohort, not the library", () => {
    const summary = summariseCompletion([
      game(10, 10, 1_200), // 100%
      game(10, 9, 1_200), // 90% — finished
      game(10, 2, 1_200), // 20%
      game(10, 10, 60), // perfect but too short to count
      game(0, 0, 6_000), // no schema
    ]);

    expect(summary).toEqual({
      cohortCount: 3,
      finishedCount: 2,
      perfectCount: 1,
      medianCompletion: 0.9,
    });
  });

  it("averages the middle pair for an even-sized cohort", () => {
    const summary = summariseCompletion([
      game(10, 1, 1_200),
      game(10, 3, 1_200),
      game(10, 5, 1_200),
      game(10, 9, 1_200),
    ]);

    expect(summary.medianCompletion).toBeCloseTo(0.4, 10);
  });

  it("returns zeroes rather than NaN for an empty cohort", () => {
    expect(summariseCompletion([])).toEqual({
      cohortCount: 0,
      finishedCount: 0,
      perfectCount: 0,
      medianCompletion: 0,
    });
  });

  it("treats the finished threshold as inclusive", () => {
    const summary = summariseCompletion([
      game(10, FINISHED_COMPLETION_SHARE * 10, 1_200),
    ]);

    expect(summary.finishedCount).toBe(1);
  });
});

describe("completionShare", () => {
  it("reports zero for a game with no schema instead of dividing by zero", () => {
    expect(completionShare(game(0, 0, 1_200))).toBe(0);
    expect(completionShare(game(40, 10, 1_200))).toBe(0.25);
  });
});
