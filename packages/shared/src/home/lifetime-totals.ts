/**
 * Alltime self-portrait totals for `/`. Owner-filtered (LoL puuids resolved
 * via `IdentityService.getOwnerPuuids`; Steam already runs under a single
 * owner via `STEAM_OWNER_ID`). Used by the conclusion's lifetime totals
 * strip — "since launch" framing rather than the rolling weekly window.
 *
 * Steam alltime playtime is the sum of the latest `playtimeForeverMinutes`
 * snapshot per appid (Steam's own alltime counter, captured at the most
 * recent owned-games poll for each game).
 */
export interface HomeLifetimeTotals {
  /** Alltime LoL match count (owner, non-remake). */
  lolMatchCount: number;
  /** Alltime LoL playtime, minutes (sum of match `durationSec`). */
  lolMinutes: number;
  /** Alltime Steam playtime, minutes (sum of latest `playtimeForeverMinutes` per appid). */
  steamMinutes: number;
  /** ISO date of the earliest tracked LoL match, or null if none yet. */
  oldestMatchAt: string | null;
  /** ISO date of the earliest tracked Steam unlock, or null if none yet. */
  oldestUnlockAt: string | null;
  /** Steam currently-owned game count (excludes de-owned titles). */
  steamGamesOwned: number;
  /** Currently-owned games whose latest snapshot reports zero playtime. */
  steamGamesUnplayed: number;
}
