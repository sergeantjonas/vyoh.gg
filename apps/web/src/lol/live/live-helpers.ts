import type { LiveGameParticipant, LolAccount } from "@vyoh/shared";
import { queueLabelExpanded } from "@vyoh/shared";

const MAP_NAMES: Record<number, string> = {
  11: "Summoner's Rift",
  12: "Howling Abyss",
  21: "Nexus Blitz",
  30: "Rings of Wrath",
};

export function queueLabel(queueId: number): string {
  return queueLabelExpanded(queueId);
}

export function mapLabel(mapId: number): string {
  return MAP_NAMES[mapId] ?? `Map ${mapId}`;
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
// Roles arrive from DDragon `tags` as capitalised strings ("Fighter",
// "Tank", ...) — lowercase before matching the axis slug.
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
      const slug = role.toLowerCase();
      if ((COMP_AXES as readonly string[]).includes(slug)) {
        counts[slug as CompAxis]++;
      }
    }
  }
  for (const axis of COMP_AXES) {
    counts[axis] = Math.round((counts[axis] / Math.max(ids.length, 1)) * 100);
  }
  return counts;
}

export function formatSeconds(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
