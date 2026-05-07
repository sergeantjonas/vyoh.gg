const DDRAGON_CDN = "https://ddragon.leagueoflegends.com/cdn";
const CDRAGON_CDN = "https://cdn.communitydragon.org/latest";

const SWARM_PREFIX = "Strawberry_";

export function normalizeChampionAlias(alias: string): string {
  if (alias.startsWith(SWARM_PREFIX)) {
    return alias.slice(SWARM_PREFIX.length);
  }
  return alias;
}

export function championIconUrl(championName: string): string {
  return `${CDRAGON_CDN}/champion/${normalizeChampionAlias(championName).toLowerCase()}/square`;
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
