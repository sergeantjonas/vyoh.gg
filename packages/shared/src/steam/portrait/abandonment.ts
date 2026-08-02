// The Anti-Portrait's selections: what the library holds that the owner does
// not play. Every predicate here is the deliberate inverse of an identity one,
// and each is a separate named call rather than a `not` flag on its twin —
// `selectQuickestAbandons(games)` cannot be misread at a call site the way
// `selectAbandons(games, { inverted: false })` can.
//
// The cohort itself comes from `selectEngagementCohort(games, "tasted")` in
// engagement.ts; nothing here re-derives the floor.

import { medianOfSorted } from "./stats.ts";

/** How many abandons the card names — enough to read as a pattern, few enough to read. */
export const QUICKEST_ABANDON_LIMIT = 5;

/**
 * Steam's public launch. `rtime_last_played` is an epoch int, and for some
 * pre-cloud titles Steam answers with a near-zero sentinel instead of omitting
 * the field: measured 2026-08-02, `Call of Duty: Modern Warfare 2 (2009)`
 * reports 1970-01-02 against 410 recorded minutes. A cold-streak card ranks by
 * oldest, so an unguarded one picks the sentinel every single time.
 */
export const STEAM_LAUNCH_MS = Date.UTC(2003, 8, 12);

export type AbandonInput = { playtimeForeverMinutes: number };

export type TastedSummary = {
  count: number;
  totalMinutes: number;
  /** Median rather than mean: one 59-minute game drags a mean of 22 to 26. */
  medianMinutes: number;
};

export function summariseTasted(games: Iterable<AbandonInput>): TastedSummary {
  const minutes = [...games]
    .map((game) => game.playtimeForeverMinutes)
    .sort((a, b) => a - b);

  return {
    count: minutes.length,
    totalMinutes: minutes.reduce((sum, value) => sum + value, 0),
    medianMinutes: medianOfSorted(minutes),
  };
}

/** Shortest first. Expects the tasted cohort — passing a whole library ranks ghosts. */
export function selectQuickestAbandons<T extends AbandonInput>(
  games: Iterable<T>,
  limit: number = QUICKEST_ABANDON_LIMIT
): T[] {
  return [...games]
    .sort((a, b) => a.playtimeForeverMinutes - b.playtimeForeverMinutes)
    .slice(0, limit);
}

export type UnlockInput = { total: number; unlocked: number };

/**
 * One achievement earned and stopped. `total > 1` is load-bearing: a game whose
 * schema holds a single achievement is at 100% completion, which is the
 * opposite claim.
 */
export function isSingleAchievement(game: UnlockInput): boolean {
  return game.total > 1 && game.unlocked === 1;
}

export function selectSingleAchievement<T extends UnlockInput>(games: Iterable<T>): T[] {
  return [...games].filter(isSingleAchievement);
}

export type LastPlayedInput = { lastPlayed: Date | null };

/** Rejects the epoch sentinel described on `STEAM_LAUNCH_MS`. */
export function isPlausibleLastPlayed(lastPlayed: Date | null): lastPlayed is Date {
  return lastPlayed !== null && lastPlayed.getTime() >= STEAM_LAUNCH_MS;
}

/**
 * The oldest last-launched date in the given cohort. Pass the *meaningful*
 * cohort: a cold streak means something was going and stopped, so a game that
 * only ever got three minutes belongs to the abandons card instead.
 */
export function selectColdest<T extends LastPlayedInput>(games: Iterable<T>): T | null {
  const dated = [...games].filter((game) => isPlausibleLastPlayed(game.lastPlayed));
  return dated.reduce<T | null>((coldest, game) => {
    if (coldest === null) return game;
    return (game.lastPlayed?.getTime() ?? 0) < (coldest.lastPlayed?.getTime() ?? 0)
      ? game
      : coldest;
  }, null);
}
