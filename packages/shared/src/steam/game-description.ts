// Per-app full description payload for the /steam/game/$appid detail page.
// Lives behind GET /steam/game/:appid/description so the bulk owned-games
// payload doesn't carry 2-8KB of BBCode per game (200+ games × that quickly
// inflates the list response).
//
// Two parallel representations:
// - `bbcode` from `IStoreBrowseService/GetItems` (batched, populated by the
//   monthly enrichment cron). The legacy carrier — kept around so a renderer
//   change doesn't force a re-enrichment pass.
// - `html` from the legacy storefront `appdetails` endpoint, populated lazily
//   on first view. The only source that exposes Steam's content-hashed
//   `extras/<hash>.{webm,poster.avif}` asset URLs inline as `<video>` tags;
//   bbcode `[img]` slugs are publisher-supplied editorial labels the CDN
//   doesn't expose directly.
//
// `bbcode` is null when the enrichment row is missing OR when the upstream
// block was empty (DLC / bundle / demo entries often have nothing). `html` is
// null until the first lazy-fetch attempt resolves, and is the empty string
// when Steam reports the game as delisted/private OR returns success with no
// about-block (both are "don't retry" states). Renderer treats nullish/empty
// as "no About this game block".

export interface SteamGameDescription {
  appid: number;
  bbcode: string | null;
  html: string | null;
}
