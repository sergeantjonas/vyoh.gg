const DDRAGON_VERSION = "15.18.1";
const DDRAGON_CDN = "https://ddragon.leagueoflegends.com/cdn";

export function championIconUrl(championName: string): string {
  return `${DDRAGON_CDN}/${DDRAGON_VERSION}/img/champion/${championName}.png`;
}

export function championLoadingUrl(championName: string, skin = 0): string {
  return `${DDRAGON_CDN}/img/champion/loading/${championName}_${skin}.jpg`;
}

export function championSplashUrl(championName: string, skin = 0): string {
  return `${DDRAGON_CDN}/img/champion/splash/${championName}_${skin}.jpg`;
}
