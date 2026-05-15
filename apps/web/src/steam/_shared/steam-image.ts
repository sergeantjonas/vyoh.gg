import { getSteamCapsuleAsset } from "./asset-manifest";

// Steam capsule URL — bundled-first, wsrv.nl-proxied Steam CDN on miss.
// Same pattern as championSquareIconUrl: manifest hit serves a same-origin
// WebP at the canonical 231×87 cover crop. On miss (freshly-wishlisted
// title not yet picked up by the next refresh, or a delisted appid) we
// fall through to header.jpg via wsrv.nl. Header is universally available
// on Steam where capsule_231x87 often isn't for upcoming titles, and
// wsrv handles the resize + WebP transcode in one hop.
export function steamCapsuleUrl(appid: number, width = 231): string {
  const manifestPath = getSteamCapsuleAsset(appid);
  if (manifestPath) return manifestPath;
  const src = `shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
  return `https://wsrv.nl/?url=${src}&w=${width}&output=webp&q=85`;
}

// Library hero — the wide 1920×620 banner Steam uses behind library page game
// headers. Proxied through wsrv.nl for resize + WebP transcode + caching.
export function steamLibraryHeroUrl(appid: number, width = 1280): string {
  const src = `shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/library_hero.jpg`;
  return `https://wsrv.nl/?url=${src}&w=${width}&output=webp&q=85`;
}

// Logo overlay — transparent PNG with the game's wordmark, paired with the
// library hero. Steam uses these together on its library page. Kept as PNG
// through the proxy (no transcode) to preserve alpha.
export function steamLibraryLogoUrl(appid: number, width = 480): string {
  const src = `shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/logo.png`;
  return `https://wsrv.nl/?url=${src}&w=${width}`;
}
