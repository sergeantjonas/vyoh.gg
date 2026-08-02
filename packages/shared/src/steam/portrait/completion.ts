// Achievement completion, restricted to the games where it means anything.
//
// Two filters do that work, and both matter. A game with no achievement schema
// (CS2, most older titles) has no completion to report — counting it as 0%
// would say "never finishes anything" about a library that simply predates
// achievements. And completion on a game with two hours in it describes the
// two hours, not the player: everyone is at 8% early on.

import { COMPLETIONIST_PLAYTIME_MINUTES } from "./engagement.ts";

/** At or above this, a game reads as finished rather than sampled. */
export const FINISHED_COMPLETION_SHARE = 0.8;

export type CompletionInput = {
  /** Achievements in the game's schema. Zero means the game has none. */
  total: number;
  unlocked: number;
  playtimeForeverMinutes: number;
};

export type CompletionSummary = {
  cohortCount: number;
  /** Cohort games at or past `FINISHED_COMPLETION_SHARE`. */
  finishedCount: number;
  /** Cohort games with every achievement unlocked. */
  perfectCount: number;
  /** Median completion across the cohort, 0..1. */
  medianCompletion: number;
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
    medianCompletion: median(shares),
  };
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid];
  if (upper === undefined) return 0;
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[mid - 1];
  return lower === undefined ? upper : (lower + upper) / 2;
}
