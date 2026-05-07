const DDRAGON_CDN = "https://ddragon.leagueoflegends.com/cdn";
const CDRAGON_CDN = "https://cdn.communitydragon.org/latest";

export function championIconUrl(championName: string): string {
  return `${CDRAGON_CDN}/champion/${championName.toLowerCase()}/square`;
}

export function championLoadingUrl(championName: string, skin = 0): string {
  return `${DDRAGON_CDN}/img/champion/loading/${championName}_${skin}.jpg`;
}

export function championSplashUrl(championName: string, skin = 0): string {
  return `${DDRAGON_CDN}/img/champion/splash/${championName}_${skin}.jpg`;
}

export function championTileUrl(championName: string, skin = 0): string {
  return `${DDRAGON_CDN}/img/champion/tiles/${championName}_${skin}.jpg`;
}

export function championCenteredSplashUrl(championName: string): string {
  return `${CDRAGON_CDN}/champion/${championName.toLowerCase()}/splash-art/centered`;
}
