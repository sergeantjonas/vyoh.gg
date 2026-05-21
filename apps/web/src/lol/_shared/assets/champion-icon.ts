// LoL image URLs — every helper points at the API's `/img/lol/*` proxy.
// The proxy fetches from CDragon/DDragon, Sharp-transcodes to WebP, and
// returns with strong cache headers. Web composes the URL only; no
// client-side fallback chains.
//
// Cache-key segment patterns:
//   - `:patch` is the browser cache key. For DDragon-sourced routes (item)
//     the value also determines which upstream path the proxy hits; for
//     CDragon-sourced routes (champion/rune/spell) it's purely a cache
//     buster — CDragon serves `latest` under a single stable URL, so
//     bumping `:patch` is how we get fresh bytes through the browser cache
//     after a patch ships.
//
// All routes are same-origin in production (Nginx will reverse-proxy `/img`
// to the Nest port); the dev build hits localhost:2010 directly.

const API_URL = "http://localhost:2010";

const SWARM_PREFIX = "Strawberry_";
export function normalizeChampionAlias(alias: string): string {
  return alias.startsWith(SWARM_PREFIX) ? alias.slice(SWARM_PREFIX.length) : alias;
}

export type ChampionVariant = "square" | "card" | "backdrop";

export function championIconUrl(
  alias: string,
  variant: ChampionVariant,
  patch: string
): string {
  const slug = normalizeChampionAlias(alias).toLowerCase();
  return `${API_URL}/img/lol/champion/${slug}/${variant}/${patch}.webp`;
}

export function championSquareIconUrl(alias: string, patch: string): string {
  return championIconUrl(alias, "square", patch);
}

export function championCardSplashUrl(alias: string, patch: string): string {
  return championIconUrl(alias, "card", patch);
}

export function championBackdropSplashUrl(alias: string, patch: string): string {
  return championIconUrl(alias, "backdrop", patch);
}

export function itemIconUrl(itemId: number, patch: string): string {
  return `${API_URL}/img/lol/item/${itemId}/${patch}.webp`;
}

export function runeIconUrl(keystoneId: number, patch: string): string {
  return `${API_URL}/img/lol/rune/${keystoneId}/${patch}.webp`;
}

export function summonerSpellIconUrl(spellKey: number, patch: string): string {
  return `${API_URL}/img/lol/spell/${spellKey}/${patch}.webp`;
}

// Ability icon proxy. Identity is `(championId, slot, abilityIndex)` —
// matches the lazy `LolChampionAbility` row that owns `iconWikiName` +
// description text. `:patch` is a browser cache key only because wiki URLs
// are stable.
export function abilityIconUrl(
  championId: number,
  slot: string,
  abilityIndex: number,
  patch: string
): string {
  return `${API_URL}/img/lol/ability/${championId}/${slot}/${abilityIndex}/${patch}.webp`;
}

// Minimap art. Versionless cache key — only the mapId matters.
export function mapIconUrl(mapId: number): string {
  return `${API_URL}/img/lol/map/${mapId}.webp`;
}

// Ranked tier emblem. `year` is the cache key — bumping it forces a refetch
// when a future emblem redesign lands on the wiki.
export function rankEmblemUrl(tier: string, year: number): string {
  return `${API_URL}/img/lol/rank/${tier}/${year}.webp`;
}

// UI singleton icons. Closed set: "gold" | "minion" | "ward" | "attack".
export type UiIconName = "gold" | "minion" | "ward" | "attack";
export function uiIconUrl(name: UiIconName): string {
  return `${API_URL}/img/lol/ui/${name}.webp`;
}

// Role-position SVG is versionless — the upstream SVGs change too rarely to
// warrant a cache-key segment.
export function roleIconUrl(positionSlug: string): string {
  return `${API_URL}/img/lol/role/${positionSlug}.svg`;
}

// Generic wiki-file icon — the inline-icon path for rich tooltip descriptions
// after `descriptionHtml` is sanitized. The proxy re-derives the wiki MD5
// bucket dirs, so callers pass the bare filename (`Magic_damage.png`) and
// stay decoupled from wiki's storage layout.
export function wikiFileIconUrl(filename: string): string {
  return `${API_URL}/img/lol/wiki-file/${encodeURIComponent(filename)}.webp`;
}

// Extract the original filename from a wiki `action=parse` <img src>.
// wiki.leagueoflegends.com serves files flat under `/en-us/images/<filename>`
// — MediaWiki's hash-bucket layout is disabled there. Thumbnails are
// `/en-us/images/thumb/<filename>/<size>px-<filename>?<cachebuster>`; the
// canonical filename is whatever sits directly under `/images/` (or
// `/images/thumb/`), terminated by the next slash or `?`. Returns null when
// the src is not a recognised wiki upload path — the sanitizer drops the
// resulting img.
const WIKI_IMG_SRC_RE = /\/images\/(?:thumb\/)?([^/?]+)/;
export function rewriteWikiImageSrc(src: string): string | null {
  const m = src.match(WIKI_IMG_SRC_RE);
  if (!m?.[1]) return null;
  return wikiFileIconUrl(m[1]);
}
