import { excludeRemakes } from "./exclude-remakes.ts";
import type { MatchSummary } from "./match.ts";

export interface TrendSummary {
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

export function computeTrendSummary(matches: MatchSummary[]): TrendSummary {
  const ms = excludeRemakes(matches);
  const wins = ms.filter((m) => m.win).length;
  const totalKills = ms.reduce((s, m) => s + m.kills, 0);
  const totalDeaths = ms.reduce((s, m) => s + m.deaths, 0);
  const totalAssists = ms.reduce((s, m) => s + m.assists, 0);
  const totalDurationSec = ms.reduce((s, m) => s + m.durationSec, 0);
  const games = ms.length;
  return {
    games,
    wins,
    losses: games - wins,
    winRate: games === 0 ? 0 : wins / games,
    totalKills,
    totalDeaths,
    totalAssists,
    avgKda:
      totalDeaths === 0
        ? totalKills + totalAssists
        : (totalKills + totalAssists) / totalDeaths,
    totalDurationSec,
  };
}
