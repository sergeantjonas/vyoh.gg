import {
  getChampionAsset,
  getItemAsset,
  normalizeChampionAlias,
} from "@/lol/_shared/asset-manifest";

const DDRAGON_CDN = "https://ddragon.leagueoflegends.com/cdn";
const CDRAGON_CDN = "https://cdn.communitydragon.org/latest";

// Re-exported for callers that previously imported it from this module.
export { normalizeChampionAlias };

export function itemIconUrl(itemId: number, version: string): string {
  return getItemAsset(itemId) ?? `${DDRAGON_CDN}/${version}/img/item/${itemId}.png`;
}

// Direct CommunityDragon URL — kept for any edge case or fallback use.
// Prefer championSquareIconUrl for rendering: it routes through the bundled
// manifest first, eliminating the CDN hop for the common path.
export function championIconUrl(championName: string): string {
  return `${CDRAGON_CDN}/champion/${normalizeChampionAlias(championName).toLowerCase()}/square`;
}

// Manifest-first square icon. Width is now advisory: the bundled WebP is a
// fixed 72px (covers 2× retina at the largest display use, size-9 = 36 CSS
// px). When manifest lookup misses (champion not yet refreshed), fall back
// to the wsrv.nl-proxied CDragon URL — same width-keyed pipeline as before.
export function championSquareIconUrl(championName: string, width = 72): string {
  const manifestPath = getChampionAsset(championName, "square");
  if (manifestPath) return manifestPath;
  const src = `cdn.communitydragon.org/latest/champion/${normalizeChampionAlias(
    championName
  ).toLowerCase()}/square`;
  return `https://wsrv.nl/?url=${src}&w=${width}&output=webp&q=85`;
}

export function championLoadingUrl(championName: string, skin = 0): string {
  return `${DDRAGON_CDN}/img/champion/loading/${normalizeChampionAlias(championName)}_${skin}.jpg`;
}

export function championSplashUrl(championName: string, skin = 0): string {
  return `${DDRAGON_CDN}/img/champion/splash/${normalizeChampionAlias(championName)}_${skin}.jpg`;
}

export function championTileUrl(championName: string, skin = 0): string {
  return `${DDRAGON_CDN}/img/champion/tiles/${normalizeChampionAlias(championName)}_${skin}.jpg`;
}

export function championCenteredSplashUrl(championName: string): string {
  return `${CDRAGON_CDN}/champion/${normalizeChampionAlias(championName).toLowerCase()}/splash-art/centered`;
}

// Manifest-first card splash. Falls back to wsrv.nl-resized CDragon centered
// crop — see git history on this file for the original q=90 / w=500 rationale.
export function championCardSplashUrl(championName: string, width = 500): string {
  const manifestPath = getChampionAsset(championName, "card");
  if (manifestPath) return manifestPath;
  const src = `cdn.communitydragon.org/latest/champion/${normalizeChampionAlias(
    championName
  ).toLowerCase()}/splash-art/centered`;
  return `https://wsrv.nl/?url=${src}&w=${width}&output=webp&q=90`;
}

// Manifest-first pre-blurred backdrop. Falls back to wsrv.nl with upstream
// blur=1 to avoid the live CSS filter cost — see git history for the
// rationale on choosing build-time blur over runtime filter:blur.
export function championBackdropSplashUrl(
  championName: string,
  width = 600,
  blur = 1
): string {
  const manifestPath = getChampionAsset(championName, "backdrop");
  if (manifestPath) return manifestPath;
  const src = `cdn.communitydragon.org/latest/champion/${normalizeChampionAlias(
    championName
  ).toLowerCase()}/splash-art/centered`;
  return `https://wsrv.nl/?url=${src}&w=${width}&blur=${blur}&output=webp&q=80`;
}
