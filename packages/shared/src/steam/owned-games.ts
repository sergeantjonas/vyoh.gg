// Owned-games drill-in: lifetime + 2-week playtime per currently-owned title,
// sorted by lifetime descending. Returned by GET /api/steam/owned-games.
// Backed by the latest SteamPlaytimeSnapshot row per game; no Steam API call
// is made at request time. Refunded/removed titles (removedAt IS NOT NULL)
// are excluded. `playtime2WeeksMinutes` is null when Steam reports no
// 2-week activity (Steam omits the field entirely in that case — we keep the
// null/0 distinction honest at the column).

export interface SteamOwnedGame {
  appid: number;
  name: string;
  playtimeForeverMinutes: number;
  playtime2WeeksMinutes: number | null;
  // Enrichment-derived fields (nullable when Steam didn't resolve the app or
  // the monthly cron hasn't reached it yet). Asset paths are hash-prefixed
  // fragments meant to be substituted into `assetUrlFormat`'s `${FILENAME}`
  // placeholder; the format string already carries the `?t=` cache-buster.
  // `assetTimestamp` is the parsed epoch for callers that compose the URL
  // themselves rather than running the substitution. Steam's BigInt is
  // narrowed to `number` over the wire — safe through ~year 2286.
  assetUrlFormat: string | null;
  assetTimestamp: number | null;
  libraryCapsulePath: string | null;
  libraryCapsule2xPath: string | null;
  libraryHeroPath: string | null;
  libraryHero2xPath: string | null;
  headerPath: string | null;
  heroCapsulePath: string | null;
  // PICS-sourced wordmark hash. Null when PICS returned no logo entry —
  // frontend falls back to the unhashed legacy `…/apps/{appid}/logo.png` path
  // and then to a typography overlay on a 404. The hash itself is the cache
  // buster: a publisher refresh changes it, breaking the wsrv cache cleanly.
  logoPath: string | null;
  // Steam StoreItemType: 0 = Game, 6 = Application (Wallpaper Engine, 3DMark).
  // Surfaced so the library can offer a Game-vs-Tool filter (see C-2.5).
  appType: number | null;
  // Top-N community tag ids by weight, capped at 20 on the API side. Stable
  // enough across polls to drive a faceted filter; resolved to human labels
  // on the web side via a curated dictionary.
  tagIds: number[];
}

export interface SteamOwnedGames {
  games: SteamOwnedGame[];
  // ISO-8601 snapshot date the playtimes were taken from, or null when no
  // poll has completed yet (first-deploy state).
  lastSyncedAt: string | null;
}
