import { Injectable } from "@nestjs/common";
import type { TranscodeParams } from "./upstream";

const CDRAGON_CDN = "https://cdn.communitydragon.org/latest";
const DDRAGON_CDN = "https://ddragon.leagueoflegends.com/cdn";

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

  // CDragon exposes id-keyed redirect URLs for perks. Avoids the proxy having
  // to mirror perks.json client-side just to resolve id → iconPath.
  rune(keystoneId: number): Resolved {
    return {
      urls: [`${CDRAGON_CDN}/perk/${keystoneId}/icon`],
      params: { width: 40, quality: 85 },
    };
  }

  spell(spellKey: number): Resolved {
    return {
      urls: [`${CDRAGON_CDN}/spell/${spellKey}/icon`],
      params: { width: 40, quality: 85 },
    };
  }

  roleIconUrl(slug: RolePositionSlug): string {
    return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-${slug}.svg`;
  }
}
