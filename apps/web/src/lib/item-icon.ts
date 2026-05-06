const DDRAGON_VERSION = "15.18.1";

export function itemIconUrl(itemId: number): string | null {
  if (itemId === 0) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${itemId}.png`;
}
