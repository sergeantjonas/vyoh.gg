// Per-app full description payload for the /steam/game/$appid detail page.
// Lives behind GET /steam/game/:appid/description so the bulk owned-games
// payload doesn't carry 2-8KB of BBCode per game (200+ games × that quickly
// inflates the list response). `bbcode` is null when the enrichment row is
// missing OR when the upstream block was empty (DLC / bundle / demo entries
// often have nothing). Renderer treats null as "no About this game block".

export interface SteamGameDescription {
  appid: number;
  bbcode: string | null;
}
