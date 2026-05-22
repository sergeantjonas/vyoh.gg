// API-internal wiki image URL builders. Consumed by `LolImageService`
// (image proxy) and `PatchService` (persists wiki URLs into
// `change.iconPath`). Apps/web does NOT import from here — the proxy is the
// only boundary that should know wiki URL shapes. See
// docs/working-notes/lol/unified-image-fallback.md.

const WIKI_IMAGES = "https://wiki.leagueoflegends.com/en-us/images";

// wiki.leagueoflegends.com serves uploaded files flat under
// `/en-us/images/<filename>` — MediaWiki's default `<a>/<ab>/<filename>` hash
// buckets are disabled in their config. The `action=parse` HTML routinely
// emits two shapes for the same file: a thumbnail
// `/en-us/images/thumb/Dash.png/20px-Dash.png?e5c61` and an original
// `/en-us/images/Dash.png?e5c61`. We always proxy to the original — Sharp
// transcodes to our chosen width downstream — so the URL is just
// `<base>/<filename>` with no hash bucket lookup.
export function wikiFileUrl(filename: string): string {
  return `${WIKI_IMAGES}/${filename}`;
}

function wikiImageSlug(name: string): string {
  return name.replace(/ /g, "_").replace(/'/g, "%27");
}

export function wikiEntryIconUrl(name: string, kind: "item" | "rune"): string {
  return `${WIKI_IMAGES}/${wikiImageSlug(name)}_${kind}.png`;
}

// Summoner spells live at `{Name}.png` (no `_spell` suffix — verified by
// probing the 16 DDragon-listed spell names). The 14 canonical spells
// (Flash, Ignite, Heal, Teleport, Smite, Cleanse, Exhaust, Ghost, Barrier,
// Clarity, Mark, Poro Toss, To the King!, Placeholder and Attack-Smite)
// resolve; Arena's `Flee` and UltBook's bare `Placeholder` 404 and rely on
// the CDragon fallback in `LolImageService.spell()`.
export function wikiSummonerSpellIconUrl(name: string): string {
  return `${WIKI_IMAGES}/${wikiImageSlug(name)}.png`;
}

// Profile icons live at `{Title with underscores}_profileicon.png`. The
// `title` is the editorial key from wiki `Module:IconData/data` — synced
// server-side into the `LolProfileIcon` table and surfaced via the static
// bundle. The image proxy is the only consumer in practice; web call sites
// resolve icons by id through the proxy URL.
export function wikiProfileIconUrl(title: string): string {
  return `${WIKI_IMAGES}/${wikiImageSlug(title)}_profileicon.png`;
}

// Wiki uses the bare `Nunu` prefix for every `Nunu & Willump` file
// (`Nunu_OriginalSquare.png`, `Nunu_OriginalCentered.jpg`, ability images).
// Other `&`-containing display names would need a separate probe before
// assuming the convention extends.
function wikiChampionPrefix(championDisplayName: string): string {
  if (championDisplayName === "Nunu & Willump") return "Nunu";
  return championDisplayName;
}

export function wikiChampionSquareUrl(championDisplayName: string): string {
  const champ = wikiImageSlug(wikiChampionPrefix(championDisplayName));
  return `${WIKI_IMAGES}/${champ}_OriginalSquare.png`;
}

// Centered splash — Riot's pre-cropped 1280×720 art that the wiki
// `Category:Champion_centered_skins` indexes. Byte-identical to CDragon's
// `/splash-art/centered` for the champions we spot-checked (same Riot source
// upload); minor re-encoding variance on some champions but framing is
// preserved, which is what the [[splash-visual-parity]] constraint requires.
export function wikiChampionCenteredUrl(championDisplayName: string): string {
  const champ = wikiImageSlug(wikiChampionPrefix(championDisplayName));
  return `${WIKI_IMAGES}/${champ}_OriginalCentered.jpg`;
}

export function wikiAbilityIconUrl(
  championDisplayName: string,
  abilityDisplayName: string
): string {
  const champ = wikiImageSlug(wikiChampionPrefix(championDisplayName));
  const ability = wikiImageSlug(abilityDisplayName);
  return `${WIKI_IMAGES}/${champ}_${ability}.png`;
}

const MINIMAP_NAME_BY_MAP_ID: Record<number, string> = {
  11: "Summoner's Rift",
  12: "Howling Abyss",
};

export function wikiMinimapUrl(mapId: number): string | null {
  const mapName = MINIMAP_NAME_BY_MAP_ID[mapId];
  if (!mapName) return null;
  return `${WIKI_IMAGES}/${wikiImageSlug(mapName)}_Minimap.png`;
}

// Riot has not redesigned ranked crests since 2023, so the 2023 emblem set is
// the current canonical art. Year is parameterised so the patch sync (Chunk 3)
// can bump it without a code change if a future redesign lands on the wiki.
export function wikiRankedEmblemUrl(tier: string, year = 2023): string {
  const titleCased = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  return `${WIKI_IMAGES}/Season_${year}_-_${titleCased}.png`;
}

export function wikiGoldIconUrl(): string {
  return `${WIKI_IMAGES}/Gold_colored_icon.svg`;
}

export function wikiMinionIconUrl(): string {
  return `${WIKI_IMAGES}/Minion_icon.png`;
}

export function wikiWardIconUrl(): string {
  return `${WIKI_IMAGES}/Ward_icon.png`;
}

// Core LoL stat icons. The colored-icon SVG suite is visually consistent
// (pairs with `Gold_colored_icon.svg`) and scales cleanly. Reserved for stat
// rows that surface the actual numeric stat — *not* used for the kills icon,
// which would clash with the AD stat semantics. Kills use `wikiAttackIconUrl`.
export type WikiStatIcon =
  | "Attack_damage"
  | "Ability_power"
  | "Armor"
  | "Health"
  | "Magic_resistance"
  | "Mana";

export function wikiStatIconUrl(stat: WikiStatIcon): string {
  return `${WIKI_IMAGES}/${stat}_colored_icon.svg`;
}

// Generic attack/sword icon, distinct from the AD stat icon. Wiki has no
// dedicated kill UX icon — this is the stand-in for kill counts in match
// detail and timeline markers.
export function wikiAttackIconUrl(): string {
  return `${WIKI_IMAGES}/Attack.svg`;
}

// Role-position icons indexed under wiki's `Category:Role_icons` as
// `{Title}_icon.png` (136×136 PNG). The `utility` slug maps to the wiki
// `Support_icon.png` because wiki uses the Riot client's "Support" label
// rather than the `UTILITY` Match-V5 slug.
const ROLE_WIKI_TITLE: Record<string, string> = {
  top: "Top",
  jungle: "Jungle",
  middle: "Middle",
  bottom: "Bottom",
  utility: "Support",
};

export function wikiRoleIconUrl(positionSlug: string): string | null {
  const title = ROLE_WIKI_TITLE[positionSlug];
  if (!title) return null;
  return `${WIKI_IMAGES}/${title}_icon.png`;
}

// Champion-class icons (Riot's archetype taxonomy — Fighter/Mage/Tank/etc.)
// indexed alongside the role icons in wiki's `Category:Role_icons`. Slugs are
// the lowercase DDragon `tags` stored on `LolChampion.roles`. Riot's modern
// taxonomy (wiki-canonical) reorganised two top-level slots that DDragon
// still ships under the old names:
//   - `assassin` is mapped to **Slayer** — the modern umbrella class that
//     subsumes both the Assassin and Skirmisher subclasses. DDragon's tag is
//     the closest legacy proxy.
//   - `support` is mapped to **Controller** — the modern name for the
//     defensive-caster class. "Support" is now used for the lane position,
//     not the class.
// `Specialist` is a modern wiki class without a DDragon tag equivalent, so
// it has no slug here.
const CLASS_WIKI_TITLE: Record<string, string> = {
  fighter: "Fighter",
  mage: "Mage",
  marksman: "Marksman",
  tank: "Tank",
  assassin: "Slayer",
  support: "Controller",
};

export function wikiClassIconUrl(classSlug: string): string | null {
  const title = CLASS_WIKI_TITLE[classSlug];
  if (!title) return null;
  return `${WIKI_IMAGES}/${title}_icon.png`;
}

// In-game ping icons. Kept for future surfaces (live-tab markers, ping-rate
// stats). Not used for the kills stat-row icon — see `wikiStatIconUrl`.
export type WikiPing =
  | "All_In"
  | "Assist_Me"
  | "Bait"
  | "Enemy_Missing"
  | "Enemy_Vision"
  | "On_My_Way"
  | "Push";

export function wikiPingUrl(ping: WikiPing): string {
  return `${WIKI_IMAGES}/${ping}_ping.png`;
}
