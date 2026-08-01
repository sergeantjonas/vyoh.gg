// The meaningful-engagement floor. A Steam library is mostly bundle leftovers,
// free-weekend pokes and does-this-run-on-my-hardware launches; without a floor
// the Portrait inherits all of that as identity, and a 12-minute curiosity
// launch of an MMO contributes 12 minutes of MMO to the genre fingerprint.
//
// Measured against the owner's library on 2026-08-01, the floor keeps 60 of 195
// games and 2,887 of 2,893 lifetime hours — it discards 0.2% of the hours to
// discard 69% of the games, which is the whole argument for having it.
//
// Every Portrait aggregation runs through `excludeBarelyTouched` rather than
// re-deriving the predicate, per the "centralise domain invariants" convention
// in docs/repo-conventions.md. Iterate the helper — a `continue` guard inside
// the loop behaves identically and hides from both review and tooling.

/** Past the tutorial, opinion formed. The floor for identity surfaces. */
export const MEANINGFUL_PLAYTIME_MINUTES = 60;

/** Lower bar inside a recency window, where there is simply less data. */
export const RECENT_PLAYTIME_MINUTES = 30;

/** Achievement completion says nothing about a game this short. */
export const COMPLETIONIST_PLAYTIME_MINUTES = 600;

/**
 * Distinct launch days that rescue a game below the minute floor — genres
 * whose whole loop is one short run (roguelites, deckbuilders) would otherwise
 * be invisible.
 *
 * This clause is inert until the api runs continuously. Sessions come from a
 * two-minute poll inside the api process, so on a dev machine the table only
 * holds launches that happened while it was up: measured 2026-08-01 it knew 5
 * games and rescued none of the 14 tasted ones. Keep passing `launchDayCount`
 * where it is cheap, but never gate a surface on the rescue firing.
 */
export const MEANINGFUL_LAUNCH_DAYS = 2;

export type EngagementInput = {
  playtimeForeverMinutes: number;
  /** Distinct days this appid appears in `SteamPlaySession`. See above. */
  launchDayCount?: number;
};

export type EngagementCohort =
  /** Cleared the floor — the only cohort identity claims may read. */
  | "meaningful"
  /** Launched, gave up. `0 < playtime < 60` with no multi-day rescue. */
  | "tasted"
  /** Owned, never launched. */
  | "ghost";

export type EngagementSummary = {
  owned: number;
  meaningful: number;
  tasted: number;
  ghosts: number;
  totalMinutes: number;
  /** Minutes inside the meaningful cohort — the numerator of "N% of hours". */
  meaningfulMinutes: number;
};

export function isMeaningfullyPlayed(game: EngagementInput): boolean {
  if (game.playtimeForeverMinutes >= MEANINGFUL_PLAYTIME_MINUTES) return true;
  // The rescue saves short-loop games, so it needs something to rescue. A row
  // with zero recorded playtime stays a ghost however many sessions sit
  // against it — playtime is the authoritative counter, and a session log that
  // disagrees with it is the log being wrong.
  if (game.playtimeForeverMinutes <= 0) return false;
  return (game.launchDayCount ?? 0) >= MEANINGFUL_LAUNCH_DAYS;
}

export function engagementCohort(game: EngagementInput): EngagementCohort {
  if (isMeaningfullyPlayed(game)) return "meaningful";
  return game.playtimeForeverMinutes > 0 ? "tasted" : "ghost";
}

/** The cleaned cohort every identity aggregation must run over. */
export function excludeBarelyTouched<T extends EngagementInput>(games: Iterable<T>): T[] {
  return [...games].filter(isMeaningfullyPlayed);
}

/**
 * The inverse selection the Anti-Portrait needs. Deliberately a separate call
 * rather than a `not` flag on the above, so a reader can never mistake one for
 * the other at a call site.
 */
export function selectEngagementCohort<T extends EngagementInput>(
  games: Iterable<T>,
  cohort: EngagementCohort
): T[] {
  return [...games].filter((game) => engagementCohort(game) === cohort);
}

/**
 * Counts and minutes in one pass — feeds the library-posture card and the
 * "based on N of M owned games" footnote that every identity surface carries.
 */
export function summariseEngagement(games: Iterable<EngagementInput>): EngagementSummary {
  const summary: EngagementSummary = {
    owned: 0,
    meaningful: 0,
    tasted: 0,
    ghosts: 0,
    totalMinutes: 0,
    meaningfulMinutes: 0,
  };

  for (const game of games) {
    summary.owned += 1;
    summary.totalMinutes += game.playtimeForeverMinutes;

    const cohort = engagementCohort(game);
    if (cohort === "meaningful") {
      summary.meaningful += 1;
      summary.meaningfulMinutes += game.playtimeForeverMinutes;
    } else if (cohort === "tasted") {
      summary.tasted += 1;
    } else {
      summary.ghosts += 1;
    }
  }

  return summary;
}
