// Owned-games drill-in: lifetime + 2-week playtime per currently-owned title,
// sorted by lifetime descending. Returned by GET /api/steam/forever-games.
// Backed by the latest SteamPlaytimeSnapshot row per game; no Steam API call
// is made at request time. Refunded/removed titles (removedAt IS NOT NULL)
// are excluded. `playtime2WeeksMinutes` is null when Steam reports no
// 2-week activity (Steam omits the field entirely in that case — we keep the
// null/0 distinction honest at the column).

export interface SteamForeverGame {
  appid: number;
  name: string;
  playtimeForeverMinutes: number;
  playtime2WeeksMinutes: number | null;
}

export interface SteamForeverGames {
  games: SteamForeverGame[];
  // ISO-8601 snapshot date the playtimes were taken from, or null when no
  // poll has completed yet (first-deploy state).
  lastSyncedAt: string | null;
}
