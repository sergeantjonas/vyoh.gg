const DDRAGON_CDN = "https://ddragon.leagueoflegends.com/cdn";
const CDRAGON_CDN = "https://cdn.communitydragon.org/latest";

export function itemIconUrl(itemId: number, version: string): string {
  return `${DDRAGON_CDN}/${version}/img/item/${itemId}.png`;
}

const SWARM_PREFIX = "Strawberry_";

export function normalizeChampionAlias(alias: string): string {
  if (alias.startsWith(SWARM_PREFIX)) {
    return alias.slice(SWARM_PREFIX.length);
  }
  return alias;
}

// Direct CommunityDragon URL — kept for any edge case or fallback use.
// Prefer championSquareIconUrl for rendering: it routes through wsrv.nl whose
// CDN edge caches the resolved asset, eliminating the per-request "latest"
// version lookup that causes high TTFB when many icons load simultaneously.
export function championIconUrl(championName: string): string {
  return `${CDRAGON_CDN}/champion/${normalizeChampionAlias(championName).toLowerCase()}/square`;
}

// wsrv.nl-proxied square icon. Resolves and caches the CDragon "latest" URL
// at the CDN edge; w=72 covers 2× retina for the largest display size (size-9
// = 36 CSS px). WebP at q=85 keeps the icon crisp at negligible byte cost.
export function championSquareIconUrl(championName: string, width = 72): string {
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

// Same source crop as championCenteredSplashUrl, but routed through wsrv.nl
// which resizes and re-encodes the image on its CDN edge. ~5× fewer bytes
// and ~3× less decode work than the direct 1280×720 PNG, with identical
// framing. Width 500 leaves comfortable headroom on 2× retina (the strip is
// ≈200×112 CSS px); q=90 is the typical "transparent" WebP quality tier
// where artifacts on splash art's smooth gradients become invisible.
export function championCardSplashUrl(championName: string, width = 500): string {
  const src = `cdn.communitydragon.org/latest/champion/${normalizeChampionAlias(
    championName
  ).toLowerCase()}/splash-art/centered`;
  return `https://wsrv.nl/?url=${src}&w=${width}&output=webp&q=90`;
}

// Pre-blurred backdrop variant. The original implementation used CSS
// `filter: blur(5px)` to mask low-res stretching, but on a 4K display that
// forces the compositor to re-rasterize a fullscreen blurred surface every
// frame any transform animates — visible flicker territory. Pushing the
// blur upstream into wsrv.nl returns a small pre-blurred WebP that the
// browser scales cheaply with no live filter cost.
//
// Defaults are tuned to match the perceived softness of the original CSS
// blur: w=600 keeps enough silhouette detail to read as the champion, and
// blur=1 adds a near-imperceptible Gaussian on top of the natural softening
// that browser upscale to 4K already provides. CSS `filter: blur(5px)` at
// rendered res was ≈0.13% of viewport width — not the heavy haze that
// blur=15 at source res produced.
export function championBackdropSplashUrl(
  championName: string,
  width = 600,
  blur = 1
): string {
  const src = `cdn.communitydragon.org/latest/champion/${normalizeChampionAlias(
    championName
  ).toLowerCase()}/splash-art/centered`;
  return `https://wsrv.nl/?url=${src}&w=${width}&blur=${blur}&output=webp&q=80`;
}
