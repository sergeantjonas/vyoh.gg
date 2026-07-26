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
// Every URL here is rendered into an <img> src, so it uses the public base
// rather than the fetch one — the two diverge under SSR, and markup has to
// carry the origin the visitor's browser can reach.
import { API_PUBLIC_URL } from "@/lib/api-url";

const SWARM_PREFIX = "Strawberry_";
export function normalizeChampionAlias(alias: string): string {
  return alias.startsWith(SWARM_PREFIX) ? alias.slice(SWARM_PREFIX.length) : alias;
}

export type ChampionVariant = "square" | "card" | "backdrop" | "splash" | "hd";

export function championIconUrl(
  alias: string,
  variant: ChampionVariant,
  patch: string
): string {
  const slug = normalizeChampionAlias(alias).toLowerCase();
  return `${API_PUBLIC_URL}/img/lol/champion/${slug}/${variant}/${patch}.webp`;
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

// Sharp, high-res centered splash for the profile hero — same subject as the
// blurred `backdrop` ambient wash, brought into focus. Use `backdrop` for
// ambient washes, `splash` only where the splash is a foreground showpiece.
export function championHeroSplashUrl(alias: string, patch: string): string {
  return championIconUrl(alias, "splash", patch);
}

// HD uncropped splash for recap chapter backdrops — wiki's
// `{Name}_OriginalSkin_HD.jpg` transcoded at 1920px. Distinct from
// `championHeroSplashUrl` (1280px centered in-game crop) because chapter
// backdrops render full-bleed and a 1280px source upsamples visibly on
// retina displays. Use this anywhere a champion's splash carries a chapter
// full-bleed — moment chapters today, R-7 / future per-champion chapters
// going forward. The Ahri anchor chapter pins per-skin filenames
// explicitly in `landing-config.ts` because skin names can't be derived
// from the alias alone (skin pattern varies per champion).
export function championHdSplashUrl(alias: string, patch: string): string {
  return championIconUrl(alias, "hd", patch);
}

export function itemIconUrl(itemId: number, patch: string): string {
  return `${API_PUBLIC_URL}/img/lol/item/${itemId}/${patch}.webp`;
}

export function runeIconUrl(keystoneId: number, patch: string): string {
  return `${API_PUBLIC_URL}/img/lol/rune/${keystoneId}/${patch}.webp`;
}

export function summonerSpellIconUrl(spellKey: number, patch: string): string {
  return `${API_PUBLIC_URL}/img/lol/spell/${spellKey}/${patch}.webp`;
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
  return `${API_PUBLIC_URL}/img/lol/ability/${championId}/${slot}/${abilityIndex}/${patch}.webp`;
}

// Minimap art. Versionless cache key — only the mapId matters.
export function mapIconUrl(mapId: number): string {
  return `${API_PUBLIC_URL}/img/lol/map/${mapId}.webp`;
}

// Ranked tier emblem. `year` is the cache key — bumping it forces a refetch
// when a future emblem redesign lands on the wiki.
export function rankEmblemUrl(tier: string, year: number): string {
  return `${API_PUBLIC_URL}/img/lol/rank/${tier}/${year}.webp`;
}

// UI singleton icons. Closed set: "gold" | "minion" | "ward" | "attack".
export type UiIconName = "gold" | "minion" | "ward" | "attack";
export function uiIconUrl(name: UiIconName): string {
  return `${API_PUBLIC_URL}/img/lol/ui/${name}.webp`;
}

// Role-position icon is versionless — the upstream art changes too rarely to
// warrant a cache-key segment. Served as WebP from the proxy (wiki PNG primary
// with CDragon SVG fallback; both transcoded to WebP server-side).
export function roleIconUrl(positionSlug: string): string {
  return `${API_PUBLIC_URL}/img/lol/role/${positionSlug}.webp`;
}

// Champion-class archetype icon (Fighter/Mage/Tank/etc.). Slug is the
// lowercase DDragon `tag` we already store on `LolChampion.roles`; the API
// translates Assassin→Slayer and Support→Controller when fetching from wiki.
export function championClassIconUrl(classSlug: string): string {
  return `${API_PUBLIC_URL}/img/lol/class/${classSlug}.webp`;
}

// Generic wiki-file icon — the inline-icon path for rich tooltip descriptions
// after `descriptionHtml` is sanitized. The proxy re-derives the wiki MD5
// bucket dirs, so callers pass the bare filename (`Magic_damage.png`) and
// stay decoupled from wiki's storage layout.
export function wikiFileIconUrl(filename: string): string {
  return `${API_PUBLIC_URL}/img/lol/wiki-file/${encodeURIComponent(filename)}.webp`;
}

// Wiki-served skin splash for full-bleed recap chapter backdrops. Same
// upstream identity as `wikiFileIconUrl` but goes through a distinct proxy
// route that transcodes to 1920×, quality 90 — the icon proxy hardcodes
// 32px width for tooltip use. Caller passes the HD filename
// (`Ahri_SpiritBlossomSkin_HD.jpg`).
export function wikiSplashUrl(filename: string): string {
  return `${API_PUBLIC_URL}/img/lol/wiki-splash/${encodeURIComponent(filename)}.webp`;
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
