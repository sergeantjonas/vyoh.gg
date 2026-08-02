// Response shape for GET /api/steam/portrait — the identity half of the Steam
// Player Portrait. Everything here derives from tables the pollers already
// fill; no Steam Web API call happens at request time.

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

export interface SteamPortrait {
  lifetime: GenreFingerprint;
  /** Null until two distinct snapshot dates exist to measure a delta between. */
  recent: SteamPortraitRecent | null;
  posture: SteamPortraitPosture;
  /** ISO-8601 timestamp of the snapshot the whole payload was computed from. */
  lastSyncedAt: string | null;
}
