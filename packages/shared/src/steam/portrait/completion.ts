// Achievement completion, restricted to the games where it means anything.
//
// Two filters do that work, and both matter. A game with no achievement schema
// (CS2, most older titles) has no completion to report — counting it as 0%
// would say "never finishes anything" about a library that simply predates
// achievements. And completion on a game with two hours in it describes the
// two hours, not the player: everyone is at 8% early on.

import { COMPLETIONIST_PLAYTIME_MINUTES } from "./engagement.ts";
import { medianOfSorted } from "./stats.ts";

/** At or above this, a game reads as finished rather than sampled. */
export const FINISHED_COMPLETION_SHARE = 0.8;

/** How many finished games the summary names. Enough to recognise, short enough to read. */
export const FINISHED_EXAMPLE_LIMIT = 3;

export type CompletionInput = {
  appid: number;
  name: string;
  /** Achievements in the game's schema. Zero means the game has none. */
  total: number;
  unlocked: number;
  playtimeForeverMinutes: number;
};

export type FinishedGame = {
  appid: number;
  name: string;
  playtimeForeverMinutes: number;
  /** 0..1; at or past `FINISHED_COMPLETION_SHARE` by construction. */
  completion: number;
};

export type CompletionSummary = {
  cohortCount: number;
  /** Cohort games at or past `FINISHED_COMPLETION_SHARE`. */
  finishedCount: number;
  /** Cohort games with every achievement unlocked. */
  perfectCount: number;
  /** Median completion across the cohort, 0..1. */
  medianCompletion: number;
  /**
   * A few of the finished games, longest-played first — the counterweight to a
   * bare "finished 18", which is otherwise the one number on the page a reader
   * has no way to picture.
   */
  finished: FinishedGame[];
};

export function completionShare(game: CompletionInput): number {
  return game.total === 0 ? 0 : game.unlocked / game.total;
}

/** The only games a completion claim may be computed over. */
export function selectCompletionCohort<T extends CompletionInput>(
  games: Iterable<T>
): T[] {
  return [...games].filter(
    (game) =>
      game.total > 0 && game.playtimeForeverMinutes >= COMPLETIONIST_PLAYTIME_MINUTES
  );
}

export function summariseCompletion(games: Iterable<CompletionInput>): CompletionSummary {
  const cohort = selectCompletionCohort(games);
  const shares = cohort.map(completionShare).sort((a, b) => a - b);

  return {
    cohortCount: cohort.length,
    finishedCount: shares.filter((share) => share >= FINISHED_COMPLETION_SHARE).length,
    perfectCount: shares.filter((share) => share >= 1).length,
    medianCompletion: medianOfSorted(shares),
    finished: selectFinishedExamples(cohort),
  };
}

// Longest-played first rather than most-complete: every game here is already
// past the finished bar, so completion no longer separates them, and the hours
// are what make one recognisable as the thing that actually got finished.
function selectFinishedExamples(cohort: readonly CompletionInput[]): FinishedGame[] {
  return cohort
    .filter((game) => completionShare(game) >= FINISHED_COMPLETION_SHARE)
    .sort(
      (a, b) =>
        b.playtimeForeverMinutes - a.playtimeForeverMinutes ||
        a.name.localeCompare(b.name)
    )
    .slice(0, FINISHED_EXAMPLE_LIMIT)
    .map((game) => ({
      appid: game.appid,
      name: game.name,
      playtimeForeverMinutes: game.playtimeForeverMinutes,
      completion: completionShare(game),
    }));
}
