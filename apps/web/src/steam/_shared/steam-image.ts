import { getSteamCapsuleAsset } from "./asset-manifest";

const STEAM_CDN_HOST = "shared.akamai.steamstatic.com";
const STEAM_STORE_ASSETS_PATH = "store_item_assets";

// Compose the wsrv `url=` source for a Steam store asset. When a hashed path
// + timestamp are supplied (from SteamGameEnrichment) we hit Steam's content-
// addressed CDN URL — immutable until the publisher swaps art, at which
// point the enrichment row updates and `?t=` changes in lockstep. Without
// enrichment we fall through to the unhashed legacy filename so newly-owned
// apps (or appids the enrichment cron can't resolve) still render.
function composeSrc(
  appid: number,
  hashedPath: string | null | undefined,
  timestamp: number | null | undefined,
  legacyFilename: string
): string {
  if (hashedPath) {
    const t = timestamp != null ? `?t=${timestamp}` : "";
    return `${STEAM_CDN_HOST}/${STEAM_STORE_ASSETS_PATH}/steam/apps/${appid}/${hashedPath}${t}`;
  }
  return `${STEAM_CDN_HOST}/${STEAM_STORE_ASSETS_PATH}/steam/apps/${appid}/${legacyFilename}`;
}

// Wrap a Steam asset URL with wsrv.nl for resize + WebP transcode + caching.
// Hashed URLs carry `?t=`, which would otherwise be parsed as a wsrv param;
// encoding the source keeps it intact end-to-end. Legacy unencoded URLs that
// already populate wsrv's cache will take a one-time miss after this change.
function wsrv(src: string, params: string): string {
  return `https://wsrv.nl/?url=${encodeURIComponent(src)}&${params}`;
}

// Steam capsule URL — bundled-first, wsrv-proxied Steam CDN on miss. Same
// pattern as championSquareIconUrl: manifest hit serves a same-origin WebP
// at the canonical 231×87 cover crop. On miss we fall through to header.jpg
// (universally available where the 231×87 capsule isn't), hashed when the
// enrichment row provides one, unhashed otherwise.
export function steamCapsuleUrl(
  appid: number,
  headerPath?: string | null,
  timestamp?: number | null,
  width = 231
): string {
  const manifestPath = getSteamCapsuleAsset(appid);
  if (manifestPath) return manifestPath;
  return wsrv(
    composeSrc(appid, headerPath, timestamp, "header.jpg"),
    `w=${width}&output=webp&q=85`
  );
}

// Store-page background — the same image Steam serves behind a game's store
// page. The `appdetails` endpoint exposes this as both `background` and
// `background_raw`, pointing at `store.akamai.steamstatic.com/images/
// storepagebackground/app/{appid}` — a different host + path than the rest
// of the `store_item_assets/...` family. Universally available across the
// titles we sampled (CS2, Dota2, BG3, Helldivers, Terraria, Rust, indies),
// so no per-game fallback is needed. The `?t=` cache-buster reuses the same
// epoch as the enrichment row's `assetTimestamp`. wsrv handles resize +
// WebP transcode; on the rare upstream miss it forwards 404 as 200 with
// zero bytes (caller detects via `naturalWidth === 0`).
export function steamPageBackgroundUrl(
  appid: number,
  timestamp?: number | null,
  width = 1920
): string {
  const t = timestamp != null ? `?t=${timestamp}` : "";
  const src = `store.akamai.steamstatic.com/images/storepagebackground/app/${appid}${t}`;
  return wsrv(src, `w=${width}&output=webp&q=85`);
}

// Library hero — the wide 1920×620 banner Steam uses behind library page game
// headers. Proxied through wsrv.nl for resize + WebP transcode + caching.
export function steamLibraryHeroUrl(
  appid: number,
  libraryHeroPath?: string | null,
  timestamp?: number | null,
  width = 1280
): string {
  return wsrv(
    composeSrc(appid, libraryHeroPath, timestamp, "library_hero.jpg"),
    `w=${width}&output=webp&q=85`
  );
}

// Logo overlay — transparent PNG with the game's wordmark, paired with the
// library hero. Steam uses these together on its library page. Kept as PNG
// through the proxy (no transcode) to preserve alpha.
//
// `logoPath` comes from PICS (via SteamGameEnrichment.logoPath) and is the
// same `<hash>/<filename>` shape as the other enrichment asset paths — the
// PICS service picks the English-locale image from the localized `image`
// map. When PICS returned no path (older titles, or PICS unreachable at
// enrichment time) we fall through to Steam's unhashed legacy
// `…/apps/{appid}/logo.png` mirror. That mirror is present for most pre-2025
// titles and 404s for some recently-uploaded ones (RE Requiem, Pragmata) —
// the caller's `onError` title-text fallback handles the residual 404 cases.
export function steamLibraryLogoUrl(
  appid: number,
  logoPath?: string | null,
  width = 480
): string {
  return wsrv(composeSrc(appid, logoPath, null, "logo.png"), `w=${width}`);
}

// Vertical 600×900 capsule — Steam's library-page tile art. Different asset
// from the 231×87 cover used by steamCapsuleUrl and from the wide hero.
// Older titles (pre-library-presentation spec) don't ship this; callers
// should provide an onError fallback (header.jpg letterboxed is the common
// move).
export function steamLibraryCapsuleUrl(
  appid: number,
  libraryCapsulePath?: string | null,
  timestamp?: number | null,
  width = 300
): string {
  return wsrv(
    composeSrc(appid, libraryCapsulePath, timestamp, "library_600x900.jpg"),
    `w=${width}&output=webp&q=85`
  );
}
