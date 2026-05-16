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

// Role-position SVG is versionless — the upstream SVGs change too rarely to
// warrant a cache-key segment.
export function roleIconUrl(positionSlug: string): string {
  return `${API_URL}/img/lol/role/${positionSlug}.svg`;
}
