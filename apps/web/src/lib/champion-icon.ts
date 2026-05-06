const DDRAGON_VERSION = "15.18.1";

export function championIconUrl(championName: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${championName}.png`;
}
