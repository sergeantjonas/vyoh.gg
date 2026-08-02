// Response shape for GET /api/steam/portrait — the identity half of the Steam
// Player Portrait. Everything here derives from tables the pollers already
// fill; no Steam Web API call happens at request time.

import type { CompletionSummary } from "./completion.ts";
import type { GenreFingerprint } from "./fingerprint.ts";

/** What "recently" asks for. What it gets is `SteamPortraitWindow`. */
export const PORTRAIT_RECENT_WINDOW_DAYS = 90;

/**
 * The span the recency fingerprint actually covers, which is not the span it
 * asked for: playtime snapshots only started accumulating in May 2026, so a
 * 90-day question gets answered with however much history exists. The card
 * labels itself from `days` rather than from the constant, so it can never
 * claim a quarter of evidence it does not have.
 */
export interface SteamPortraitWindow {
  days: number;
  /** ISO-8601 date of the baseline snapshot the deltas are measured from. */
  since: string;
  /** ISO-8601 date of the latest snapshot. */
  until: string;
}

export interface SteamPortraitRecent {
  window: SteamPortraitWindow;
  fingerprint: GenreFingerprint;
}

/**
 * Cards 6 and 7's shared substrate: how much of the library is identity and
 * how much is shelf. Counts are over currently-owned games of app type "game";
 * utilities like Wallpaper Engine are excluded, since owning a benchmark says
 * nothing about what kind of player someone is.
 */
export interface SteamPortraitPosture {
  ownedCount: number;
  meaningfulCount: number;
  tastedCount: number;
  ghostCount: number;
  totalMinutes: number;
  meaningfulMinutes: number;
}

/** The cards that name titles rather than counting them. */
export interface SteamPortraitGameRef {
  appid: number;
  name: string;
  minutes: number;
}

export interface SteamPortraitTasted {
  count: number;
  totalMinutes: number;
  medianMinutes: number;
  /** Ascending by minutes, capped at `QUICKEST_ABANDON_LIMIT`. */
  quickest: SteamPortraitGameRef[];
  /**
   * Genre weighting over the tasted cohort — what gets bounced off. Ranked by
   * minutes like every fingerprint, but a reader wants `gameCount` here: inside
   * a cohort capped at 59 minutes, the minute spread is noise.
   */
  fingerprint: GenreFingerprint;
}

export interface SteamPortraitColdest extends SteamPortraitGameRef {
  /**
   * ISO-8601 of Steam's `rtime_last_played`. Not an acquisition date — nothing
   * we hold knows when a game was bought, since `SteamOwnedGame.firstSeenAt`
   * records when our own poller first saw the row.
   */
  lastPlayed: string;
}

export interface SteamPortraitSingleAchievement {
  games: SteamPortraitGameRef[];
  /** Games carrying any unlock at all — the denominator that makes the count read as small. */
  withAnyUnlock: number;
  /** Games carrying an achievement schema at all. */
  withSchema: number;
}

/** Who the owner is when they don't play — the inverse of every field above. */
export interface SteamPortraitAnti {
  tasted: SteamPortraitTasted;
  singleAchievement: SteamPortraitSingleAchievement;
  /** Null until some meaningfully-played game carries a plausible last-played date. */
  coldest: SteamPortraitColdest | null;
}

export interface SteamPortrait {
  lifetime: GenreFingerprint;
  /** Null until two distinct snapshot dates exist to measure a delta between. */
  recent: SteamPortraitRecent | null;
  posture: SteamPortraitPosture;
  anti: SteamPortraitAnti;
  /** Over games with an achievement schema and real time in them; see completion.ts. */
  completion: CompletionSummary;
  /** ISO-8601 timestamp of the snapshot the whole payload was computed from. */
  lastSyncedAt: string | null;
}
