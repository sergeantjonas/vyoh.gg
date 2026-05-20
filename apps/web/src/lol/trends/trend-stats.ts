import { type MatchSummary, excludeRemakes } from "@vyoh/shared";

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
export interface KdaPoint {
  game: number;
  kda: number;
  champion: string;
  win: boolean;
}

export function computeKdaSeries(matches: MatchSummary[]): KdaPoint[] {
  return excludeRemakes(matches)
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt))
    .map((m, i) => ({
      game: i + 1,
      kda: m.deaths === 0 ? m.kills + m.assists : (m.kills + m.assists) / m.deaths,
      champion: m.champion,
      win: m.win,
    }));
}

export interface QueueCount {
  queueType: string;
  count: number;
}

export function computeQueueCounts(matches: MatchSummary[]): QueueCount[] {
  const counts = new Map<string, number>();
  for (const m of excludeRemakes(matches)) {
    counts.set(m.queueType, (counts.get(m.queueType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([queueType, count]) => ({ queueType, count }))
    .sort((a, b) => b.count - a.count);
}

export { computeStreak } from "@vyoh/shared";
export type { Streak } from "@vyoh/shared";
