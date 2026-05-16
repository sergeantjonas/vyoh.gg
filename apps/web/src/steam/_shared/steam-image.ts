// Steam image URLs — every helper points at the API's `/img/steam/*` proxy.
// The proxy handles upstream fetch, hashed → legacy fallback, and Sharp WebP
// transcode. Web composes the URL only; no client-side fallback chains.
//
// Cache-key segment patterns:
//   - `:assetTimestamp` for game assets — the `assetTimestamp` BigInt from
//     SteamGameEnrichment, encoded as a number for the URL. Falls back to `0`
//     when the enrichment row hasn't been populated yet (proxy ignores the
//     value either way; the segment exists only for browser cache busting
//     when the publisher swaps art and a fresh enrichment cycle bumps `t`).
//   - `:schemaVersion` for achievements — currently a static `1`, kept as a
//     segment so we can bump it globally without redeploying the route. The
//     proxy resolves the per-achievement icon URL from the DB on every call,
//     so the segment is purely a browser cache key.
//
// All routes are same-origin in production (Nginx will reverse-proxy `/img`
// to the Nest port); the dev build hits localhost:2010 directly.

const API_URL = "http://localhost:2010";

const ACHIEVEMENT_SCHEMA_VERSION = 1;

function cacheKey(assetTimestamp?: number | bigint | null): string {
  return assetTimestamp != null ? assetTimestamp.toString() : "0";
}

export function steamCapsuleUrl(
  appid: number,
  assetTimestamp?: number | bigint | null
): string {
  return `${API_URL}/img/steam/capsule/${appid}/${cacheKey(assetTimestamp)}.webp`;
}

export function steamLibraryCapsuleUrl(
  appid: number,
  assetTimestamp?: number | bigint | null
): string {
  return `${API_URL}/img/steam/library-capsule/${appid}/${cacheKey(assetTimestamp)}.webp`;
}

export function steamLibraryHeroUrl(
  appid: number,
  assetTimestamp?: number | bigint | null
): string {
  return `${API_URL}/img/steam/hero/${appid}/${cacheKey(assetTimestamp)}.webp`;
}

export function steamLibraryLogoUrl(
  appid: number,
  assetTimestamp?: number | bigint | null
): string {
  return `${API_URL}/img/steam/logo/${appid}/${cacheKey(assetTimestamp)}.webp`;
}

// Profile page backdrop. The proxy tries the high-quality
// `page_bg_generated_v6b.jpg` variant first and falls back to the universally
// available `storepagebackground/app/{appid}` mirror — both handled
// server-side so callers don't need an onError fallback chain.
export function steamPageBackgroundUrl(
  appid: number,
  assetTimestamp?: number | bigint | null
): string {
  return `${API_URL}/img/steam/backdrop/${appid}/${cacheKey(assetTimestamp)}.webp`;
}

export function steamAchievementIconUrl(
  appid: number,
  apiName: string,
  gray = false
): string {
  const route = gray ? "achievement-gray" : "achievement";
  return `${API_URL}/img/steam/${route}/${appid}/${apiName}/${ACHIEVEMENT_SCHEMA_VERSION}.webp`;
}
