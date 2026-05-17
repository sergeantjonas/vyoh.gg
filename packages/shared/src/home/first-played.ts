/**
 * Cross-stream "newest in the rotation" event surfaced on `/`. Discriminated
 * over the source stream so the tile can render the right framing without
 * sniffing fields. `kind: "none"` is the explicit empty case — used when
 * no first-played event is within the staleness window.
 */
export type HomeFirstPlayed =
  | HomeFirstPlayedLol
  | HomeFirstPlayedSteam
  | HomeFirstPlayedNone;

export interface HomeFirstPlayedLol {
  kind: "lol";
  champion: string;
  /** ISO timestamp of the owner's first tracked non-remake match on the champion. */
  firstPlayedAt: string;
  /** Total non-remake matches played on the champion since first encounter. */
  matchCount: number;
  /** Wins among `matchCount`. */
  wins: number;
  /**
   * Slug of the account the *first* match was played on — drives the champion
   * detail link. Null if the puuid can't be resolved against the configured
   * accounts (config drift); the tile falls back to a non-linked headline.
   */
  accountSlug: string | null;
}

export interface HomeFirstPlayedSteam {
  kind: "steam";
  appid: number;
  name: string;
  /**
   * ISO snapshot date when the appid first crossed the meaningful-play
   * threshold. Approximation — daily snapshots, so accurate to the day.
   */
  firstPlayedAt: string;
  /** Latest `playtimeForeverMinutes` for the appid. */
  totalMinutes: number;
}

export interface HomeFirstPlayedNone {
  kind: "none";
  /** Days the service looked back before concluding nothing new is in the rotation. */
  windowDays: number;
}
