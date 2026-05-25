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
  // ISO timestamp of the last client-reported launch (GetOwnedGames'
  // `rtime_last_played`). Null on titles the owner has never started.
  // Paired with the most recent unlock timestamp to surface a
  // "still launching, not progressing" verdict.
  rtimeLastPlayedAt: string | null;
  // One-line marketing blurb from `basic_info.short_description`. Surfaced
  // as a tooltip on the library card title and as a subtitle on the game
  // detail header. Null when the enrichment row is missing or the upstream
  // omitted basic_info.
  shortDescription: string | null;
  // Steam Deck compatibility tier from `platforms.steam_deck_compat_category`:
  // 0 Unknown / 1 Unsupported / 2 Playable / 3 Verified. Renderer treats null
  // and 0 identically (no chip shown) so a missing enrichment row stays
  // silent rather than asserting "unsupported".
  steamDeckCompat: number | null;
  // OS support flags from `platforms.{windows,mac,linux}` — true means the
  // game supports the platform, false means it doesn't, null means we have
  // no enrichment data yet. Distinct from playtime-per-OS fields, which
  // record what the *owner* launched on each platform.
  platformWindows: boolean | null;
  platformMac: boolean | null;
  platformLinux: boolean | null;
  // True when `platforms.vr_support` exposes any VR mode flag, false when
  // it's an explicit empty object, null when the upstream block is missing.
  platformVr: boolean | null;
  // Latest filtered storefront review summary. Source of truth for the
  // "Very Positive · 56,501" chip on game-detail. Null when no enrichment
  // row exists OR when the upstream returned no reviews block (typically
  // brand-new releases with too few reviews to score).
  reviewSummary: SteamReviewSummary | null;
  // Editorial-only rating block (ESRB / PEGI / USK / …). Null is meaningful:
  // AO-rated titles typically skip ESRB submission, and the renderer treats
  // null as "no badge" — never as a maturity signal.
  gameRating: SteamGameRating | null;
  // `basic_info.{publishers,developers,franchises}[].name` flattened to plain
  // strings. Empty arrays mean either the enrichment row is missing or the
  // upstream block had no resolvable entity names — treated identically by
  // the renderer / palette grammar.
  publisherNames: string[];
  developerNames: string[];
  franchiseNames: string[];
  // Saliency centroid of `library_hero.jpg`, expressed as integer percent
  // (0-100). Drives `object-position` on the library row's full-bleed cover
  // crop so the focal subject stays visible regardless of where it sits in
  // the source. Null when the anchor hasn't been computed yet; renderer
  // treats null and 50/50 identically (center crop).
  subjectXPercent: number | null;
  subjectYPercent: number | null;
}

export interface SteamGameRating {
  // Rating body name as Steam reports it ("ESRB", "PEGI", "USK", …).
  type: string;
  // The label within that body ("M", "T", "18", …).
  rating: string;
  // Free-form descriptor strings ("Violence", "Suggestive Themes", …).
  descriptors: string[];
  // Body-specific minimum age; 0 when not applicable.
  requiredAge: number;
  // Whether Steam itself gates the storefront page behind an age check.
  // Editorial only — we don't propagate to library filters.
  useAgeGate: boolean;
  // Relative path to the official badge image at
  // store.cloudflare.steamstatic.com.
  imageUrl: string | null;
}

export interface SteamReviewSummary {
  reviewCount: number;
  percentPositive: number;
  // Steam's internal 1-9 score. Editorial label is derived from it but we
  // store the label too so we don't have to maintain the mapping client-side
  // (Valve changes the thresholds occasionally).
  reviewScore: number;
  reviewScoreLabel: string;
}

export interface SteamOwnedGames {
  games: SteamOwnedGame[];
  // ISO-8601 snapshot date the playtimes were taken from, or null when no
  // poll has completed yet (first-deploy state).
  lastSyncedAt: string | null;
}
