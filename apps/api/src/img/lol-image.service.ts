import { Injectable } from "@nestjs/common";
import { wikiProfileIconUrl } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { TranscodeParams } from "./upstream";

const CDRAGON_CDN = "https://cdn.communitydragon.org/latest";
const CDRAGON_GAME_DATA =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default";
const DDRAGON_CDN = "https://ddragon.leagueoflegends.com/cdn";

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

export const ROLE_POSITION_SLUGS = [
  "top",
  "jungle",
  "middle",
  "bottom",
  "utility",
] as const;
export type RolePositionSlug = (typeof ROLE_POSITION_SLUGS)[number];

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

  constructor(private readonly prisma: PrismaService) {}

  champion(alias: string, variant: ChampionVariant): Resolved {
    const slug = normalizeChampionAlias(alias).toLowerCase();
    switch (variant) {
      case "square":
        return {
          urls: [`${CDRAGON_CDN}/champion/${slug}/square`],
          params: { width: 72, quality: 85 },
        };
      case "card":
        return {
          urls: [`${CDRAGON_CDN}/champion/${slug}/splash-art/centered`],
          params: { width: 500, quality: 90 },
        };
      case "backdrop":
        return {
          urls: [`${CDRAGON_CDN}/champion/${slug}/splash-art/centered`],
          params: { width: 600, quality: 80, blur: 1 },
        };
    }
  }

  item(itemId: number, patch: string): Resolved {
    return {
      urls: [`${DDRAGON_CDN}/${patch}/img/item/${itemId}.png`],
      params: { width: 64, quality: 85 },
    };
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

  async rune(keystoneId: number): Promise<Resolved> {
    const paths = await this.loadPerkPaths();
    const iconPath = paths.get(keystoneId);
    if (!iconPath) {
      throw new Error(`unknown perk id ${keystoneId}`);
    }
    return {
      urls: [gameDataUrlFromIconPath(iconPath)],
      params: { width: 40, quality: 85 },
    };
  }

  async spell(spellKey: number): Promise<Resolved> {
    const paths = await this.loadSpellPaths();
    const iconPath = paths.get(spellKey);
    if (!iconPath) {
      throw new Error(`unknown summoner spell id ${spellKey}`);
    }
    return {
      urls: [gameDataUrlFromIconPath(iconPath)],
      params: { width: 40, quality: 85 },
    };
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

  roleIconUrl(slug: RolePositionSlug): string {
    return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-${slug}.svg`;
  }
}
