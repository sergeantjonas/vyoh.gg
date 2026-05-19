import type { LiveGameParticipant, LolAccount } from "@vyoh/shared";

const QUEUE_NAMES: Record<number, string> = {
  0: "Custom",
  400: "Normal Draft",
  420: "Ranked Solo/Duo",
  430: "Normal Blind",
  440: "Ranked Flex",
  450: "ARAM",
  490: "Quickplay",
  700: "Clash",
  720: "ARAM Clash",
  830: "Co-op vs AI",
  840: "Co-op vs AI",
  850: "Co-op vs AI",
  900: "URF",
  1020: "One for All",
  1300: "Nexus Blitz",
  1400: "Ultimate Spellbook",
  1700: "Arena",
  1900: "URF",
};

const MAP_NAMES: Record<number, string> = {
  11: "Summoner's Rift",
  12: "Howling Abyss",
  21: "Nexus Blitz",
  30: "Rings of Wrath",
};

export function queueLabel(queueId: number): string {
  return QUEUE_NAMES[queueId] ?? `Queue ${queueId}`;
}

export function mapLabel(mapId: number): string {
  return MAP_NAMES[mapId] ?? `Map ${mapId}`;
}

// Primary champion-square URL goes through wsrv.nl for CDN-side WebP
// conversion + width-aware downscaling. The community-dragon raw asset is the
// canonical fallback if wsrv ever 404s or returns a 0-byte body.
export function championPrimaryUrl(championId: number, width: number): string {
  const src = `cdn.communitydragon.org/latest/champion/${championId}/square`;
  return `https://wsrv.nl/?url=${src}&w=${width}&output=webp&q=85`;
}

export function championFallbackUrl(championId: number): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${championId}.png`;
}

// Case-insensitive Riot-ID match. Spectator-V5 occasionally returns
// `riotIdGameName` in a different casing than the canonical account name,
// so we lowercase both sides before comparing.
export function isUserParticipant(
  p: LiveGameParticipant,
  account: LolAccount | undefined
): boolean {
  if (!account) return false;
  return (
    p.riotIdGameName.toLowerCase() === account.gameName.toLowerCase() &&
    p.riotIdTagLine.toLowerCase() === account.tagLine.toLowerCase()
  );
}

export const COMP_AXES = [
  "tank",
  "fighter",
  "mage",
  "assassin",
  "marksman",
  "support",
] as const;
export type CompAxis = (typeof COMP_AXES)[number];

// Per-team composition tally as percentages summing across each champion's
// role tags. A 5-tank team scores 100 on the tank axis; a balanced team
// scatters across multiple axes (each champion can contribute to several).
export function computeTeamComp(
  ids: number[],
  rolesByChampion: Record<number, string[]>
): Record<CompAxis, number> {
  const counts = Object.fromEntries(COMP_AXES.map((a) => [a, 0])) as Record<
    CompAxis,
    number
  >;
  for (const id of ids) {
    for (const role of rolesByChampion[id] ?? []) {
      if ((COMP_AXES as readonly string[]).includes(role)) {
        counts[role as CompAxis]++;
      }
    }
  }
  for (const axis of COMP_AXES) {
    counts[axis] = Math.round((counts[axis] / Math.max(ids.length, 1)) * 100);
  }
  return counts;
}

export interface ChampionInfo {
  name: string;
  roles: string[];
}

// Fetches the community-dragon role tags for one champion. Returns null on
// any non-OK response or network error so the caller can fall through to an
// empty role set rather than blocking the whole live-game render.
export async function fetchChampionInfo(
  championId: number
): Promise<ChampionInfo | null> {
  const url = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/${championId}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as ChampionInfo;
  } catch {
    return null;
  }
}

export function formatSeconds(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
