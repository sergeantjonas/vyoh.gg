import type { MatchSummary } from "@vyoh/shared";

export interface ChampionStats {
  champion: string;
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
  const byChampion = new Map<string, ChampionStats>();

  for (const match of matches) {
    let stats = byChampion.get(match.champion);
    if (!stats) {
      stats = {
        champion: match.champion,
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
      byChampion.set(match.champion, stats);
    }
    stats.games++;
    if (match.win) stats.wins++;
    else stats.losses++;
    stats.totalKills += match.kills;
    stats.totalDeaths += match.deaths;
    stats.totalAssists += match.assists;
    stats.totalDurationSec += match.durationSec;
  }

  for (const stats of byChampion.values()) {
    stats.winRate = stats.wins / stats.games;
    stats.avgKda =
      stats.totalDeaths === 0
        ? stats.totalKills + stats.totalAssists
        : (stats.totalKills + stats.totalAssists) / stats.totalDeaths;
  }

  return [...byChampion.values()].sort((a, b) => b.games - a.games);
}
