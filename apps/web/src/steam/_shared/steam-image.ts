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
// Bump when the backdrop proxy chain changes preference order.
//   v1: `page_bg_generated_v6b.jpg` (dim/blue, original behavior).
//   v2: prefer `page_bg_generated.jpg` (warmer) over v6b.
//   v3: prepend `library_hero.jpg` so modern titles (Nightreign etc.) use
//       their actual hero art as the page-wide backdrop, blurred + scaled
//       to ambient. Older titles still fall through to page_bg_generated.
// Without this segment, browsers with `Cache-Control: immutable` would
// keep serving year-old cached bytes against the same URL.
const BACKDROP_SCHEMA_VERSION = 3;
// Bump when the logo proxy pipeline changes (trim, resize, etc.) so
// browsers holding the prior immutable bytes refresh on next request.
//   v1: width=480, no trim (original).
//   v2: width=480 + alpha trim threshold 1 (strips Steam's per-publisher
//       transparent-padding inconsistencies before resize).
const LOGO_SCHEMA_VERSION = 2;

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

// `flipHero` bakes a horizontal mirror into the served bytes via Sharp's
// `.flop()` on the proxy side. Routing the flip through the URL — rather
// than applying `transform: scaleX(-1)` on the consumer — keeps Chrome's
// view-transition snapshots flipped at the pixel level through the morph
// animation. The CSS-only transform works for the static DOM but Chrome
// strips it from the snapshot used for the morph, so the animating
// element shows un-flipped pixels until the morph ends. See
// SteamSubjectAnchorService for where `flipHero` is decided per asset.
export function steamLibraryHeroUrl(
  appid: number,
  assetTimestamp?: number | bigint | null,
  flipHero?: boolean
): string {
  const flip = flipHero ? "flip" : "noflip";
  return `${API_URL}/img/steam/hero/${flip}/${appid}/${cacheKey(assetTimestamp)}.webp`;
}

export function steamLibraryLogoUrl(
  appid: number,
  assetTimestamp?: number | bigint | null
): string {
  return `${API_URL}/img/steam/logo/${LOGO_SCHEMA_VERSION}/${appid}/${cacheKey(assetTimestamp)}.webp`;
}

// Profile page backdrop. The proxy tries the high-quality
// `page_bg_generated_v6b.jpg` variant first and falls back to the universally
// available `storepagebackground/app/{appid}` mirror — both handled
// server-side so callers don't need an onError fallback chain. The
// `flipHero` segment bakes a horizontal mirror into the bytes when the
// hero is flipped (see `steamLibraryHeroUrl` for the rationale); without
// it, the route VT crossfade from library → detail reveals an un-flipped
// blurred backdrop behind the flipped morph.
export function steamPageBackgroundUrl(
  appid: number,
  assetTimestamp?: number | bigint | null,
  flipHero?: boolean
): string {
  const flip = flipHero ? "flip" : "noflip";
  return `${API_URL}/img/steam/backdrop/${BACKDROP_SCHEMA_VERSION}/${flip}/${appid}/${cacheKey(assetTimestamp)}.webp`;
}

// Hero img → page-background fallback chain shared by the destination
// game page, row shell (backdrop + foreground hero), and tile (hidden
// morph anchor). About 9% of a typical library lacks `library_hero.jpg`
// (mostly pre-2019 titles that predate the asset spec); for those, the
// page-background asset is logo-free scenic art that reads as a hero
// stand-in. The remaining ~2% (stripped-down standalone variants like
// CoD MW2 MP-only) lack both — `onMissing` is called so the caller can
// show a CSS gradient fallback.
//
// Returns paired onLoad + onError handlers because the proxy quirk
// requires both paths: wsrv-style proxies forward upstream 404s as
// `200 OK` with an empty body, so `naturalWidth === 0` in onLoad is the
// real failure signal (onError only catches proxy 5xx). The one-shot
// `data-fell-back` guard prevents the chain from looping.
export interface HeroFallbackHandlers {
  onLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onError: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

export function makeHeroFallbackHandlers({
  appid,
  assetTimestamp,
  flipHero,
  onSuccess,
  onMissing,
}: {
  appid: number;
  assetTimestamp: number | bigint | null | undefined;
  flipHero?: boolean;
  onSuccess: () => void;
  onMissing: () => void;
}): HeroFallbackHandlers {
  const fallback = (target: HTMLImageElement) => {
    if (target.dataset.fellBack) {
      onMissing();
      return;
    }
    target.dataset.fellBack = "1";
    target.src = steamPageBackgroundUrl(appid, assetTimestamp, flipHero);
  };
  return {
    onLoad: (e) => {
      if (e.currentTarget.naturalWidth === 0) fallback(e.currentTarget);
      else onSuccess();
    },
    onError: (e) => fallback(e.currentTarget),
  };
}

export function steamAchievementIconUrl(
  appid: number,
  apiName: string,
  gray = false
): string {
  const route = gray ? "achievement-gray" : "achievement";
  return `${API_URL}/img/steam/${route}/${appid}/${apiName}/${ACHIEVEMENT_SCHEMA_VERSION}.webp`;
}

// Matches Steam's rendered `about_the_game` asset URLs — content-hashed
// `<hash>.webm` and `<hash>.poster.avif` paths emitted inside `<video>` and
// `<source>` tags. Pattern mirrors the API proxy's validation regex so a
// rejected URL never reaches the network (the proxy would return 400
// either way, but skipping the round-trip keeps the rendered surface free
// of broken-image placeholders). The `?t=` cache-buster is stripped because
// the content hash IS the identity — Steam emits a fresh hash on republish.
const STEAM_DESCRIPTION_ASSET_URL_RE =
  /^https?:\/\/[^/]+\/store_item_assets\/steam\/apps\/(\d+)\/extras\/([a-f0-9]{32}(?:\.poster)?\.(?:webm|avif|png|jpg|jpeg))(?:\?.*)?$/;

export function rewriteSteamDescriptionAssetUrl(url: string): string | null {
  const m = STEAM_DESCRIPTION_ASSET_URL_RE.exec(url);
  if (!m) return null;
  return `${API_URL}/img/steam/desc/${m[1]}/extras/${m[2]}`;
}
