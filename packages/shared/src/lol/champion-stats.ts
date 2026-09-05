import type { RolePosition } from "./role-position.ts";

// Per-role slice surfaced inline on the consolidated row — lets a champion
// played in multiple lanes (e.g. Ahri mid + top) show one card with a
// breakdown popover instead of duplicating into two cards that both link to
// the same role-agnostic detail page.
export interface ChampionRoleSplit {
  position: RolePosition;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface ChampionStats {
  champion: string;
  // Dominant role (most games). Mirrors ChampionDetailStats so the list row
  // and detail hero report the same lane.
  position: RolePosition;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  avgKda: number;
  totalDurationSec: number;
  // Sorted by games desc; length 1 for single-role pools.
  roles: ChampionRoleSplit[];
  // Cumulative win rate over the last up-to-10 ranked games on this champion,
  // chronological (oldest first). Drives the row-level sparkline — short
  // enough to fit beside the WR number, long enough to show recent form.
  recentWinRates: number[];
}
