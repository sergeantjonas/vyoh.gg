// Platform breakdown of the owner's Steam playtime, taken from the most recent
// SteamPlaytimeSnapshot row per game. Returned by GET /api/steam/platform-mix.
// Minutes are summed across currently-owned games (removedAt IS NULL). Steam
// reports per-OS counters cumulatively, so these add up to ≤ total forever
// minutes — equality is the common case; gaps appear for very old titles
// where Steam never backfilled per-OS data.

export type SteamPlatform = "windows" | "mac" | "linux" | "deck";

export interface SteamPlatformMix {
  // Total cross-platform minutes across owned games on the latest snapshot.
  // Sum of the four per-platform counters; may be 0 on a fresh install.
  totalMinutes: number;
  windowsMinutes: number;
  macMinutes: number;
  linuxMinutes: number;
  deckMinutes: number;
  // Platform with the most minutes, or null when totalMinutes === 0.
  dominantPlatform: SteamPlatform | null;
  // ISO-8601 snapshot date the mix was computed from, or null when no poll
  // has completed yet.
  lastSyncedAt: string | null;
}
