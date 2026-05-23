// DTOs for the `GET /lol/static` bundle endpoint — replaces the five
// client-side CDragon JSON fetches (`useItems`, `useChampions`,
// `useChampionSpells`, `useSummonerSpells`, `usePerks`) with a single
// server-curated payload sourced from wiki + DDragon-as-bridge. The web
// app fetches this once on boot with `staleTime: Infinity` and derives
// all id↔name maps from it. See
// docs/working-notes/lol/lol-static-metadata.md for the pipeline spec.

export interface LolItemDto {
  id: number;
  name: string;
  tier: number | null;
  // Wiki's `type` array — e.g. ["Legendary"], ["Mythic"], ["Distributed"].
  itemType: string[];
  priceTotal: number | null;
  // Wiki ingredient names (matches source); read-side resolves names → ids
  // if needed.
  recipe: string[];
  // Wiki `menu` keys (e.g. "fighter", "marksman") — the role/category tags
  // that gate item-shop tabs.
  categories: string[];
  stats: Record<string, number>;
  descriptionWikitext: string | null;
  // Rendered HTML from MediaWiki `action=parse`. Null until the wiki
  // content sync populates it (deferred follow-up chunk).
  descriptionHtml: string | null;
  iconWikiName: string | null;
}

export interface LolChampionDto {
  id: number;
  // DDragon string id used in icon URL paths (e.g. "MonkeyKing").
  alias: string;
  // Wiki display name (e.g. "Wukong"). Use this when rendering user-facing
  // labels.
  name: string;
  // DDragon `tags` (Fighter/Tank/Mage/Marksman/Assassin/Support) — legacy
  // 6-class taxonomy. Retained because Match-V5 + lane-assignment math
  // still keys on these slugs.
  roles: string[];
  // Riot's modern 7-class taxonomy inverted from wiki category pages
  // (Slayer/Controller/Specialist + 4 unchanged). Surfaced for UI; the
  // wiki rename means e.g. Ahri's modern parent is `Mage` (subclass
  // `Burst`) where DDragon's `tags` still lists `Mage, Assassin`.
  modernClasses: string[];
  // Riot's modern subclass taxonomy (Burst, Skirmisher, Enchanter, etc.).
  // Empty for champions whose modern class has no subclass tier
  // (Marksman, Specialist). See SUBCLASS_TO_PARENT_CLASS in the api sync.
  modernSubclasses: string[];
}

export interface LolChampionAbilityDto {
  // "Passive" | "Q" | "W" | "E" | "R"
  slot: string;
  // Order within slot when the wiki module lists multiple named variants
  // (e.g. Karma W: [Focused Resolve, Renewal]).
  abilityIndex: number;
  name: string;
  iconWikiName: string | null;
  descriptionWikitext: string | null;
  descriptionHtml: string | null;
}

// Resolved payload from the lazy `GET /lol/static/ability/...` route.
// Identifies the ability for caching keys plus the resolved content.
// Fields may be null if the wiki has no template page or the upstream is
// failing — the row is still returned so the UI can render name + icon
// without the description body.
export interface LolAbilityDescriptionDto {
  championId: number;
  slot: string;
  abilityIndex: number;
  name: string;
  iconWikiName: string | null;
  descriptionWikitext: string | null;
  descriptionHtml: string | null;
}

export interface LolSummonerSpellDto {
  id: number;
  name: string;
  iconWikiName: string | null;
  descriptionWikitext: string | null;
  descriptionHtml: string | null;
  // Set after N consecutive sync cycles where DDragon didn't return the id.
  // Retired rows are KEPT in the bundle so historical match data can still
  // resolve old summoner-spell ids; web filters by `retiredAt === null` for
  // current-meta UI.
  retiredAt: string | null;
}

export interface LolPerkDto {
  id: number;
  name: string;
  // "Precision" | "Domination" | "Sorcery" | "Resolve" | "Inspiration"
  path: string | null;
  // "Keystone" | "Slot1" | "Slot2" | "Slot3"
  slot: string | null;
  iconWikiName: string | null;
  descriptionWikitext: string | null;
  descriptionHtml: string | null;
  // See `LolSummonerSpellDto.retiredAt` — same semantics. Phase Rush →
  // Stormraider's Surge is the canonical churn case.
  retiredAt: string | null;
}

// Profile icons sourced from wiki `Module:IconData/data`. `title` is the
// editorial title — both a display label and the slug the image proxy
// uses to build the wiki upstream URL (`{Title}_profileicon.png`).
// Availability + release are surfaced for future filtering (Available vs
// Legacy vs Limited; chronological grouping). Icons are never retired —
// wiki retains editorial history indefinitely — so no `retiredAt`.
export interface LolProfileIconDto {
  id: number;
  title: string;
  availability: string | null;
  release: number | null;
}

export interface LolStaticBundle {
  // Latest `wikiSyncedPatchVersion` observed across rows, or null when the
  // sync has never run (cold-start before the first cron tick).
  patchVersion: string | null;
  // Max `wikiSyncedAt`/`ddragonSyncedAt` across all rows, ISO string. Null
  // on cold-start.
  syncedAt: string | null;
  champions: LolChampionDto[];
  // championId → 1+ ability rows (Passive/Q/W/E/R with optional named
  // variants per slot). Keyed numerically so the web can do O(1) lookup
  // by Match-V5's championId.
  championAbilities: Record<number, LolChampionAbilityDto[]>;
  items: LolItemDto[];
  summonerSpells: LolSummonerSpellDto[];
  perks: LolPerkDto[];
  profileIcons: LolProfileIconDto[];
}
