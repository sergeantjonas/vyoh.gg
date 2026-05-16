// Per-game media payload fetched lazily on hover, distinct from the eagerly-
// loaded owned-games DTO. Backed by SteamGameEnrichment.screenshots — populated
// the first time a tile is hovered, refreshed after a 30-day TTL.
//
// `fetchedAt` distinguishes "never fetched, render hero" from "fetched but no
// screenshots upstream" (e.g. private appid, demo, region-blocked) so the
// client doesn't refetch a known-empty result on every hover.

export interface SteamScreenshot {
  thumbUrl: string;
  fullUrl: string;
}

export interface SteamGameMedia {
  appid: number;
  screenshots: SteamScreenshot[];
  fetchedAt: string | null;
}
