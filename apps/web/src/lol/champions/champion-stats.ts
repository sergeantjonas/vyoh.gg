import { type RolePosition, isRolePosition } from "@/lol/_shared/assets/role-icon";
import type { MatchSummary } from "@vyoh/shared";

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
}

export function aggregateChampionStats(matches: MatchSummary[]): ChampionStats[] {
  type RoleAccum = { games: number; wins: number };
  type ChampAccum = {
    champion: string;
    totalKills: number;
    totalDeaths: number;
    totalAssists: number;
    totalDurationSec: number;
    roleAccums: Map<RolePosition, RoleAccum>;
  };
  const byChamp = new Map<string, ChampAccum>();

  for (const match of matches) {
    if (match.remake) continue;
    // Drop ARAM/Arena rows — they have no teamPosition and would muddle the
    // role breakdown.
    if (!isRolePosition(match.teamPosition)) continue;
    let champ = byChamp.get(match.champion);
    if (!champ) {
      champ = {
        champion: match.champion,
        totalKills: 0,
        totalDeaths: 0,
        totalAssists: 0,
        totalDurationSec: 0,
        roleAccums: new Map(),
      };
      byChamp.set(match.champion, champ);
    }
    champ.totalKills += match.kills;
    champ.totalDeaths += match.deaths;
    champ.totalAssists += match.assists;
    champ.totalDurationSec += match.durationSec;
    let role = champ.roleAccums.get(match.teamPosition);
    if (!role) {
      role = { games: 0, wins: 0 };
      champ.roleAccums.set(match.teamPosition, role);
    }
    role.games++;
    if (match.win) role.wins++;
  }

  const result: ChampionStats[] = [];
  for (const champ of byChamp.values()) {
    const roles: ChampionRoleSplit[] = [...champ.roleAccums.entries()]
      .map(([position, r]) => ({
        position,
        games: r.games,
        wins: r.wins,
        losses: r.games - r.wins,
        winRate: r.wins / r.games,
      }))
      .sort((a, b) => b.games - a.games);
    const games = roles.reduce((s, r) => s + r.games, 0);
    const wins = roles.reduce((s, r) => s + r.wins, 0);
    const losses = games - wins;
    // `roles` is non-empty here: champ is only created when a match with a
    // valid teamPosition lands, which seeds at least one role accum.
    const dominantRole = roles[0]?.position ?? "MIDDLE";
    const avgKda =
      champ.totalDeaths === 0
        ? champ.totalKills + champ.totalAssists
        : (champ.totalKills + champ.totalAssists) / champ.totalDeaths;
    result.push({
      champion: champ.champion,
      position: dominantRole,
      games,
      wins,
      losses,
      winRate: wins / games,
      totalKills: champ.totalKills,
      totalDeaths: champ.totalDeaths,
      totalAssists: champ.totalAssists,
      avgKda,
      totalDurationSec: champ.totalDurationSec,
      roles,
    });
  }

  return result.sort((a, b) => b.games - a.games);
}
