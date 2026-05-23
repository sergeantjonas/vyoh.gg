import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { TranscodeParams } from "./upstream";
import {
  wikiAbilityIconUrl,
  wikiAttackIconUrl,
  wikiChampionCenteredUrl,
  wikiChampionSquareUrl,
  wikiClassIconUrl,
  wikiEntryIconUrl,
  wikiFileUrl,
  wikiGoldIconUrl,
  wikiMinimapUrl,
  wikiMinionIconUrl,
  wikiProfileIconUrl,
  wikiRankedEmblemUrl,
  wikiRoleIconUrl,
  wikiSummonerSpellIconUrl,
  wikiWardIconUrl,
} from "./wiki-url-helpers";

const CDRAGON_CDN = "https://cdn.communitydragon.org/latest";
const CDRAGON_GAME_DATA =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default";
const CDRAGON_STATIC_ASSETS =
  "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default";
const CDRAGON_MATCH_HISTORY =
  "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default";
const DDRAGON_CDN = "https://ddragon.leagueoflegends.com/cdn";

// CDragon's minimap PNGs live under `game/assets/maps/info/map{N}/` but the
// filename differs per map. Probed against `/info/map12/` directly; if Riot
// adds a new map and we don't ship a mapping yet, the fallback skips and the
// wiki primary is the only upstream.
const CDRAGON_MINIMAP_FILENAME: Record<number, string> = {
  11: "2dlevelminimap_npe_1.png",
  12: "2dlevelminimap.png",
};
function cdragonMinimapUrl(mapId: number): string | null {
  const filename = CDRAGON_MINIMAP_FILENAME[mapId];
  if (!filename) return null;
  return `https://raw.communitydragon.org/latest/game/assets/maps/info/map${mapId}/${filename}`;
}

// `/perk/<id>/icon` and `/spell/<id>/icon` on cdn.communitydragon.org return
// 404 — the real icon paths come from perks.json / summoner-spells.json
// `iconPath` fields. Cache the id → path map in memory; refresh on demand if
// a lookup misses (a new keystone shipped this patch).
interface CDragonItem {
  id: number;
  iconPath: string;
}

function gameDataUrlFromIconPath(iconPath: string): string {
  return `${CDRAGON_GAME_DATA}${iconPath
    .replace("/lol-game-data/assets/", "/")
    .toLowerCase()}`;
}

const SWARM_PREFIX = "Strawberry_";
function normalizeChampionAlias(alias: string): string {
  return alias.startsWith(SWARM_PREFIX) ? alias.slice(SWARM_PREFIX.length) : alias;
}

export type ChampionVariant = "square" | "card" | "backdrop";

export const UI_ICON_NAMES = ["gold", "minion", "ward", "attack"] as const;
export type UiIconName = (typeof UI_ICON_NAMES)[number];

export const ROLE_POSITION_SLUGS = [
  "top",
  "jungle",
  "middle",
  "bottom",
  "utility",
] as const;
export type RolePositionSlug = (typeof ROLE_POSITION_SLUGS)[number];

// Champion-class slugs — lowercase DDragon `tags` values. The modern wiki
// taxonomy fed by `LolChampion.modernClasses` (wiki category-page inversion
// in `LolStaticSyncService.syncChampionClasses`). DDragon's legacy `tags`
// (assassin/support) are NOT valid slugs here — Slayer replaced Assassin
// as a parent class and Controller replaced Support. Specialist is the
// 7th modern class with no DDragon equivalent and only resolves on wiki.
export const CHAMPION_CLASS_SLUGS = [
  "fighter",
  "mage",
  "marksman",
  "tank",
  "slayer",
  "controller",
  "specialist",
] as const;
export type ChampionClassSlug = (typeof CHAMPION_CLASS_SLUGS)[number];

// CDragon's `npe-ft-role-icon-{slug}.png` set predates Riot's taxonomy
// rename and still ships under the legacy slug names. Map the modern slug
// to its closest legacy CDragon bucket for the proxy fallback; Specialist
// is wiki-only because CDragon never had an equivalent.
const MODERN_CLASS_TO_LEGACY_CDRAGON: Record<ChampionClassSlug, string | null> = {
  fighter: "fighter",
  mage: "mage",
  marksman: "marksman",
  tank: "tank",
  slayer: "assassin",
  controller: "support",
  specialist: null,
};

export interface Resolved {
  // Upstream URLs to try in order; first 2xx wins. Single-element for sources
  // with no fallback (LoL, achievement icons), multi-element for Steam's
  // hashed → legacy fallback chain.
  urls: string[];
  params: TranscodeParams;
}

@Injectable()
export class LolImageService {
  private perkPaths: Map<number, string> | null = null;
  private spellPaths: Map<number, string> | null = null;
  private perkPathsPending: Promise<Map<number, string>> | null = null;
  private spellPathsPending: Promise<Map<number, string>> | null = null;
  private profileIconTitles: Map<number, string> | null = null;
  private profileIconTitlesPending: Promise<Map<number, string>> | null = null;
  private championDisplayNames: Map<string, string> | null = null;
  private championDisplayNamesPending: Promise<Map<string, string>> | null = null;
  private itemIconNames: Map<number, string> | null = null;
  private itemIconNamesPending: Promise<Map<number, string>> | null = null;
  private perkIconNames: Map<number, string> | null = null;
  private perkIconNamesPending: Promise<Map<number, string>> | null = null;
  private spellIconNames: Map<number, string> | null = null;
  private spellIconNamesPending: Promise<Map<number, string>> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async champion(alias: string, variant: ChampionVariant): Promise<Resolved> {
    const slug = normalizeChampionAlias(alias).toLowerCase();
    const cdragonSquare = `${CDRAGON_CDN}/champion/${slug}/square`;
    switch (variant) {
      case "square": {
        // Wiki primary (`OriginalSquare` — the saturated launch art) with
        // CDragon as a resilience fallback (CDragon serves the desaturated
        // client variant — visually drifted, but better than a blank tile
        // during a wiki outage). Cold-start before the first static sync
        // lands cleanly on CDragon alone.
        const displayName = await this.lookupDisplayName(alias);
        const urls = displayName
          ? [wikiChampionSquareUrl(displayName), cdragonSquare]
          : [cdragonSquare];
        return { urls, params: { width: 72, quality: 85 } };
      }
      case "card": {
        // Wiki-primary (`OriginalCentered.jpg`) with CDragon `/centered` as
        // resilience fallback. Wiki ships the same Riot-source centered crop
        // — byte-identical for the champions spot-checked, framing preserved
        // across the rest — so the [[splash-visual-parity]] constraint holds.
        // Cold-start before the first sync lands on CDragon alone.
        const displayName = await this.lookupDisplayName(alias);
        const cdragonCentered = `${CDRAGON_CDN}/champion/${slug}/splash-art/centered`;
        const urls = displayName
          ? [wikiChampionCenteredUrl(displayName), cdragonCentered]
          : [cdragonCentered];
        return { urls, params: { width: 500, quality: 90 } };
      }
      case "backdrop": {
        const displayName = await this.lookupDisplayName(alias);
        const cdragonCentered = `${CDRAGON_CDN}/champion/${slug}/splash-art/centered`;
        const urls = displayName
          ? [wikiChampionCenteredUrl(displayName), cdragonCentered]
          : [cdragonCentered];
        return { urls, params: { width: 600, quality: 80, blur: 1 } };
      }
    }
  }

  private async lookupDisplayName(alias: string): Promise<string | null> {
    const normalized = normalizeChampionAlias(alias);
    const map = await this.loadChampionDisplayNames();
    return map.get(normalized.toLowerCase()) ?? null;
  }

  // Sticky in-process cache. Champion display names change very rarely (new
  // champion releases / VGUs rename only the alias→name binding on the same
  // primary key). Mirrors `loadProfileIconTitles`.
  private loadChampionDisplayNames(): Promise<Map<string, string>> {
    if (this.championDisplayNames) return Promise.resolve(this.championDisplayNames);
    if (this.championDisplayNamesPending) return this.championDisplayNamesPending;
    const pending = this.prisma.lolChampion
      .findMany({ select: { alias: true, name: true } })
      .then((rows) => {
        const map = new Map(rows.map((r) => [r.alias.toLowerCase(), r.name]));
        this.championDisplayNames = map;
        return map;
      })
      .finally(() => {
        this.championDisplayNamesPending = null;
      });
    this.championDisplayNamesPending = pending;
    return pending;
  }

  // Wiki-first with DDragon fallback. `iconWikiName` is populated by the
  // static-sync service (mirrors the `name` for items); a miss means the
  // item shipped between cron ticks, in which case DDragon's id-keyed image
  // is still served as a single-element fallback so cold-start is graceful.
  async item(itemId: number, patch: string): Promise<Resolved> {
    const ddragonUrl = `${DDRAGON_CDN}/${patch}/img/item/${itemId}.png`;
    const names = await this.loadItemIconNames();
    const name = names.get(itemId);
    const urls = name ? [wikiEntryIconUrl(name, "item"), ddragonUrl] : [ddragonUrl];
    return { urls, params: { width: 64, quality: 85 } };
  }

  // Wiki-first with DDragon fallback. Wiki's `Module:IconData/data` carries
  // the editorial title for every iconId; the matching `{Title}_profileicon.png`
  // image is populated under `wiki.leagueoflegends.com/en-us/images/`. The
  // fallback survives both wiki outages and id→title misses (icon shipped by
  // Riot but not yet synced from wiki — sync cadence is 6h). Cold-start
  // before the first static sync also lands cleanly on DDragon.
  async profileIcon(iconId: number, patch: string): Promise<Resolved> {
    const ddragonUrl = `${DDRAGON_CDN}/${patch}/img/profileicon/${iconId}.png`;
    const titles = await this.loadProfileIconTitles();
    const title = titles.get(iconId);
    const urls = title ? [wikiProfileIconUrl(title), ddragonUrl] : [ddragonUrl];
    return { urls, params: { width: 72, quality: 85 } };
  }

  // Wiki-sourced ability icon, routed through the proxy so wiki blips don't
  // blank the spell tooltips. `:patch` is a browser cache buster only — wiki
  // URLs are stable, so the resolver ignores the param value. Throws when
  // the row is missing so the controller can return 404; the bundle ships
  // every ability row, so a miss here means an invalid request.
  // Wiki-first with CDragon ability-icon fallback. CDragon serves
  // `/champion/{slug}/ability-icon/{slot}` for all slots including Passive.
  async ability(
    championId: number,
    slot: string,
    abilityIndex: number
  ): Promise<Resolved> {
    const row = await this.prisma.lolChampionAbility.findUnique({
      where: { championId_slot_abilityIndex: { championId, slot, abilityIndex } },
      include: { champion: { select: { name: true, alias: true } } },
    });
    if (!row) {
      throw new Error(`unknown ability ${championId}/${slot}/${abilityIndex}`);
    }
    const slug = normalizeChampionAlias(row.champion.alias).toLowerCase();
    const cdragonUrl = `${CDRAGON_CDN}/champion/${slug}/ability-icon/${slot.toLowerCase()}`;
    return {
      urls: [wikiAbilityIconUrl(row.champion.name, row.name), cdragonUrl],
      params: { width: 40, quality: 85 },
    };
  }

  // Generic wiki-file passthrough — the inline-icon path for rich tooltip
  // descriptions. The caller (web sanitizer) extracts the filename from
  // wiki `<img src>` attributes in `descriptionHtml` and routes it here.
  // The resolver re-derives the MD5 bucket dirs so the URL stays a clean
  // `filename.png`-shaped identifier on the proxy boundary. Filename is
  // validated as a wiki-safe slug to keep arbitrary paths off the proxy.
  // Single-upstream intentionally — no second source serves wiki file assets.
  wikiFile(filename: string): Resolved {
    if (!/^[A-Za-z0-9_.\-%']+$/.test(filename)) {
      throw new Error(`invalid wiki filename ${filename}`);
    }
    return {
      urls: [wikiFileUrl(filename)],
      params: { width: 32, quality: 85 },
    };
  }

  // Wiki primary with CDragon `game/assets/maps/info` fallback. CDragon's
  // per-map filename differs (SR uses `2dlevelminimap_npe_1.png`, HA uses the
  // bare `2dlevelminimap.png`) so the mapping is explicit.
  map(mapId: number): Resolved {
    const wikiUrl = wikiMinimapUrl(mapId);
    const cdragonUrl = cdragonMinimapUrl(mapId);
    if (!wikiUrl && !cdragonUrl) {
      throw new Error(`unknown mapId ${mapId}`);
    }
    const urls = [wikiUrl, cdragonUrl].filter((u): u is string => u !== null);
    return { urls, params: { width: 256, quality: 85 } };
  }

  // Wiki primary with CDragon `ranked-emblem/emblem-{tier}.png` fallback —
  // resolves for every tier including Emerald. `year` is the wiki-only cache
  // key; CDragon serves the current redesign under the same path regardless.
  rankEmblem(tier: string, year: number): Resolved {
    const lowered = tier.toLowerCase();
    return {
      urls: [
        wikiRankedEmblemUrl(tier, year),
        `${CDRAGON_STATIC_ASSETS}/images/ranked-emblem/emblem-${lowered}.png`,
      ],
      params: { width: 128, quality: 85 },
    };
  }

  // UI singleton icons (gold/cs/vision/kills). Three of four have a CDragon
  // counterpart preserved from the pre-wiki implementation; ward stays
  // single-upstream because the original was a hand-rolled SVG and there is
  // no CDragon image equivalent.
  uiIcon(name: UiIconName): Resolved {
    switch (name) {
      case "gold":
        return {
          urls: [
            wikiGoldIconUrl(),
            "https://raw.communitydragon.org/latest/game/assets/ux/floatingtext/goldicon.png",
          ],
          params: { width: 64, quality: 85 },
        };
      case "minion":
        // CDragon's `icon_minions.png` is a vertical 1:2 sprite — Sharp crops
        // the upper half before resizing so the fallback renders as a single
        // CS icon instead of two stacked copies.
        return {
          urls: [wikiMinionIconUrl(), `${CDRAGON_MATCH_HISTORY}/icon_minions.png`],
          params: { width: 64, quality: 85, extractTopHalf: true },
        };
      case "attack":
        return {
          urls: [wikiAttackIconUrl(), `${CDRAGON_MATCH_HISTORY}/kills.png`],
          params: { width: 64, quality: 85 },
        };
      case "ward":
        // Single-upstream intentionally — the historical implementation used
        // a hand-rolled SVG (game-icons.net CC BY 3.0), never CDragon.
        return { urls: [wikiWardIconUrl()], params: { width: 64, quality: 85 } };
    }
  }

  // Wiki-first with CDragon-game-data fallback. `iconWikiName` is populated
  // by the static-sync service (mirrors the perk `name`); a miss falls
  // through to the existing CDragon `iconPath` lookup so cold-start before
  // the first sync still resolves. The CDragon iconPath is also required
  // when no wiki name is known.
  async rune(keystoneId: number): Promise<Resolved> {
    const paths = await this.loadPerkPaths();
    const iconPath = paths.get(keystoneId);
    if (!iconPath) {
      throw new Error(`unknown perk id ${keystoneId}`);
    }
    const cdragonUrl = gameDataUrlFromIconPath(iconPath);
    const names = await this.loadPerkIconNames();
    const name = names.get(keystoneId);
    const urls = name ? [wikiEntryIconUrl(name, "rune"), cdragonUrl] : [cdragonUrl];
    return { urls, params: { width: 40, quality: 85 } };
  }

  // Wiki-first with CDragon-game-data fallback. `iconWikiName` is populated
  // by the static-sync service (mirrors the DDragon `name`); wiki coverage
  // probe (2026-05-23) confirmed `{Name}.png` resolves for 14/16 spells —
  // the two gaps (Arena `Flee`, UltBook `Placeholder`) fall through to the
  // CDragon `iconPath` lookup. Cold-start before the first sync also lands
  // on CDragon alone.
  async spell(spellKey: number): Promise<Resolved> {
    const paths = await this.loadSpellPaths();
    const iconPath = paths.get(spellKey);
    if (!iconPath) {
      throw new Error(`unknown summoner spell id ${spellKey}`);
    }
    const cdragonUrl = gameDataUrlFromIconPath(iconPath);
    const names = await this.loadSpellIconNames();
    const name = names.get(spellKey);
    const urls = name ? [wikiSummonerSpellIconUrl(name), cdragonUrl] : [cdragonUrl];
    return { urls, params: { width: 40, quality: 85 } };
  }

  // Sticky in-process cache. Profile-icon titles change far less often than
  // patches (new icons are append-only on wiki; existing titles stay stable).
  // A single fetch on first request is good enough until the service restarts
  // or the cron sync runs.
  private loadProfileIconTitles(): Promise<Map<number, string>> {
    if (this.profileIconTitles) return Promise.resolve(this.profileIconTitles);
    if (this.profileIconTitlesPending) return this.profileIconTitlesPending;
    const pending = this.prisma.lolProfileIcon
      .findMany({ select: { id: true, title: true } })
      .then((rows) => {
        const map = new Map(rows.map((r) => [r.id, r.title]));
        this.profileIconTitles = map;
        return map;
      })
      .finally(() => {
        this.profileIconTitlesPending = null;
      });
    this.profileIconTitlesPending = pending;
    return pending;
  }

  // Sticky in-process cache for id → iconWikiName from the static-sync
  // table. Same shape as `loadProfileIconTitles`. The map is small (~325
  // items / ~62 perks) and changes only on patches, so one fetch per
  // service instance is enough.
  private loadItemIconNames(): Promise<Map<number, string>> {
    if (this.itemIconNames) return Promise.resolve(this.itemIconNames);
    if (this.itemIconNamesPending) return this.itemIconNamesPending;
    const pending = this.prisma.lolItem
      .findMany({ select: { id: true, iconWikiName: true } })
      .then((rows) => {
        const map = new Map(
          rows.flatMap((r) => (r.iconWikiName ? [[r.id, r.iconWikiName] as const] : []))
        );
        this.itemIconNames = map;
        return map;
      })
      .finally(() => {
        this.itemIconNamesPending = null;
      });
    this.itemIconNamesPending = pending;
    return pending;
  }

  private loadPerkIconNames(): Promise<Map<number, string>> {
    if (this.perkIconNames) return Promise.resolve(this.perkIconNames);
    if (this.perkIconNamesPending) return this.perkIconNamesPending;
    const pending = this.prisma.lolPerk
      .findMany({ select: { id: true, iconWikiName: true } })
      .then((rows) => {
        const map = new Map(
          rows.flatMap((r) => (r.iconWikiName ? [[r.id, r.iconWikiName] as const] : []))
        );
        this.perkIconNames = map;
        return map;
      })
      .finally(() => {
        this.perkIconNamesPending = null;
      });
    this.perkIconNamesPending = pending;
    return pending;
  }

  private loadSpellIconNames(): Promise<Map<number, string>> {
    if (this.spellIconNames) return Promise.resolve(this.spellIconNames);
    if (this.spellIconNamesPending) return this.spellIconNamesPending;
    const pending = this.prisma.lolSummonerSpell
      .findMany({ select: { id: true, iconWikiName: true } })
      .then((rows) => {
        const map = new Map(
          rows.flatMap((r) => (r.iconWikiName ? [[r.id, r.iconWikiName] as const] : []))
        );
        this.spellIconNames = map;
        return map;
      })
      .finally(() => {
        this.spellIconNamesPending = null;
      });
    this.spellIconNamesPending = pending;
    return pending;
  }

  private loadPerkPaths(): Promise<Map<number, string>> {
    if (this.perkPaths) return Promise.resolve(this.perkPaths);
    if (this.perkPathsPending) return this.perkPathsPending;
    this.perkPathsPending = this.fetchIdPathMap(`${CDRAGON_GAME_DATA}/v1/perks.json`)
      .then((map) => {
        this.perkPaths = map;
        return map;
      })
      .finally(() => {
        this.perkPathsPending = null;
      });
    return this.perkPathsPending;
  }

  private loadSpellPaths(): Promise<Map<number, string>> {
    if (this.spellPaths) return Promise.resolve(this.spellPaths);
    if (this.spellPathsPending) return this.spellPathsPending;
    this.spellPathsPending = this.fetchIdPathMap(
      `${CDRAGON_GAME_DATA}/v1/summoner-spells.json`
    )
      .then((map) => {
        this.spellPaths = map;
        return map;
      })
      .finally(() => {
        this.spellPathsPending = null;
      });
    return this.spellPathsPending;
  }

  private async fetchIdPathMap(url: string): Promise<Map<number, string>> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
    const raw = (await res.json()) as CDragonItem[];
    return new Map(raw.map((it) => [it.id, it.iconPath]));
  }

  // Wiki-primary with CDragon SVG fallback. Wiki ships these as `{Title}_icon.png`
  // under `Category:Role_icons` — same Riot icon design as CDragon's
  // `rcp-fe-lol-static-assets` SVGs, just rasterised at 136×136. Sharp
  // transcodes both formats down to a 64px WebP so the format unification
  // matches every other LoL asset on the proxy.
  role(slug: RolePositionSlug): Resolved {
    const wikiUrl = wikiRoleIconUrl(slug);
    const cdragonUrl = `${CDRAGON_STATIC_ASSETS}/svg/position-${slug}.svg`;
    const urls = wikiUrl ? [wikiUrl, cdragonUrl] : [cdragonUrl];
    return { urls, params: { width: 64, quality: 85 } };
  }

  // Champion-class icon (Fighter/Mage/Slayer/Controller/etc.) — wiki
  // primary with a legacy CDragon `npe-ft-role-icon-{slug}.png` fallback
  // where one exists. Slayer → cdragon `assassin`, Controller → `support`;
  // Specialist has no CDragon equivalent and is wiki-only.
  champClass(slug: ChampionClassSlug): Resolved {
    const wikiUrl = wikiClassIconUrl(slug);
    const cdragonSlug = MODERN_CLASS_TO_LEGACY_CDRAGON[slug];
    const cdragonUrl = cdragonSlug
      ? `${CDRAGON_STATIC_ASSETS}/npe-ft-role-icon-${cdragonSlug}.png`
      : null;
    const urls = [wikiUrl, cdragonUrl].filter((u): u is string => u !== null);
    return { urls, params: { width: 64, quality: 85 } };
  }
}
