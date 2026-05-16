import { type RolePosition, isRolePosition } from "@/lol/_shared/assets/role-icon";
import type { MatchSummary } from "@vyoh/shared";

export interface ChampionStats {
  champion: string;
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
}

export function aggregateChampionStats(matches: MatchSummary[]): ChampionStats[] {
  const byKey = new Map<string, ChampionStats>();

  for (const match of matches) {
    if (match.remake) continue;
    // Drop ARAM/Arena rows — they have no teamPosition and would collapse
    // distinct role identities into a single muddled "champion" row.
    if (!isRolePosition(match.teamPosition)) continue;
    const key = `${match.champion}|${match.teamPosition}`;
    let stats = byKey.get(key);
    if (!stats) {
      stats = {
        champion: match.champion,
        position: match.teamPosition,
        games: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalAssists: 0,
        avgKda: 0,
        totalDurationSec: 0,
      };
      byKey.set(key, stats);
    }
    stats.games++;
    if (match.win) stats.wins++;
    else stats.losses++;
    stats.totalKills += match.kills;
    stats.totalDeaths += match.deaths;
    stats.totalAssists += match.assists;
    stats.totalDurationSec += match.durationSec;
  }

  for (const stats of byKey.values()) {
    stats.winRate = stats.wins / stats.games;
    stats.avgKda =
      stats.totalDeaths === 0
        ? stats.totalKills + stats.totalAssists
        : (stats.totalKills + stats.totalAssists) / stats.totalDeaths;
  }

  return [...byKey.values()].sort((a, b) => b.games - a.games);
}
