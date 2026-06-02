/**
 * Owner's rolling-24h activity pulse surfaced on `/`. Designed for a
 * compact chip-strip in the conclusion ("Today" lens) — a single quick
 * read of the past 24h alongside the weekly rhythm band and alltime
 * lifetime totals. Owner-filtered server-side so only the owner's LoL
 * matches contribute; Steam already runs single-owner under `STEAM_OWNER_ID`.
 *
 * The window is a rolling 24h (last day) rather than calendar-today so
 * the chip reads consistently across the day boundary instead of resetting
 * at midnight Brussels. `steamMinutes` keeps its "today's calendar day"
 * framing for parity with `HomeActivityIntensity` — a single user-visible
 * "minutes I've spent on Steam today" number.
 */
export interface HomeToday {
  /** Non-remake LoL matches played in the rolling-24h window. */
  lolMatches: number;
  /** Wins among those matches. */
  lolWins: number;
  /** Losses among those matches. `lolMatches - lolWins - lolLosses` = 0. */
  lolLosses: number;
  /** Kills across rolling-24h matches. */
  kills: number;
  /** Deaths across rolling-24h matches. */
  deaths: number;
  /** Assists across rolling-24h matches. */
  assists: number;
  /** Steam minutes spent inside the current Europe/Brussels calendar day. */
  steamMinutes: number;
  /** Steam achievement unlocks recorded in the rolling-24h window. */
  achievementUnlocks: number;
  /** ISO timestamp the snapshot was computed at. */
  asOf: string;
  /** IANA timezone used to anchor the "today" boundary. */
  timeZone: string;
}
