import { useMatchWindow } from "@/lol/matches/match-window-context";
import {
  type HourDayStat,
  type MatchSummary,
  type TiltStats,
  computeHourDayStats,
  computeTiltStats,
  excludeRemakes,
} from "@vyoh/shared";
import { useMemo } from "react";

export type { HourDayStat, TiltStats };
export { computeHourDayStats, computeTiltStats };

export interface GameLengthBucket {
  label: string;
  games: number;
  wins: number;
}

export interface PoolStats {
  uniqueChampions: number;
  totalGames: number;
  days: number;
}

export interface HabitsStats {
  hourDay: HourDayStat[];
  tilt: TiltStats;
  gameLength: GameLengthBucket[];
  pool: PoolStats;
  overallWinRate: number;
}

const GAME_LENGTH_BUCKETS: Array<{ label: string; maxSec: number }> = [
  { label: "Under 25m", maxSec: 25 * 60 },
  { label: "25–35m", maxSec: 35 * 60 },
  { label: "Over 35m", maxSec: Number.POSITIVE_INFINITY },
];

export function computeGameLengthStats(matches: MatchSummary[]): GameLengthBucket[] {
  const buckets: GameLengthBucket[] = GAME_LENGTH_BUCKETS.map(({ label }) => ({
    label,
    games: 0,
    wins: 0,
  }));
  for (const m of excludeRemakes(matches)) {
    const i = GAME_LENGTH_BUCKETS.findIndex((b) => m.durationSec <= b.maxSec);
    const b = i !== -1 ? buckets[i] : undefined;
    if (b) {
      b.games++;
      if (m.win) b.wins++;
    }
  }
  return buckets;
}

const POOL_DAYS = 30;

export function computePoolStats(matches: MatchSummary[]): PoolStats {
  const cutoff = Date.now() - POOL_DAYS * 24 * 60 * 60 * 1000;
  const recent = matches.filter(
    (m) => !m.remake && new Date(m.playedAt).getTime() >= cutoff
  );
  return {
    uniqueChampions: new Set(recent.map((m) => m.champion)).size,
    totalGames: recent.length,
    days: POOL_DAYS,
  };
}

export function computeHabitsStats(matches: MatchSummary[]): HabitsStats {
  const ms = excludeRemakes(matches);
  const wins = ms.filter((m) => m.win).length;
  return {
    hourDay: computeHourDayStats(matches),
    tilt: computeTiltStats(matches),
    gameLength: computeGameLengthStats(matches),
    pool: computePoolStats(matches),
    overallWinRate: ms.length === 0 ? 0 : wins / ms.length,
  };
}

export function useHabitsStats(champion?: string): HabitsStats | null {
  const { matches } = useMatchWindow();
  return useMemo(() => {
    if (!matches || matches.length < 5) return null;
    const filtered = champion ? matches.filter((m) => m.champion === champion) : matches;
    if (filtered.length < 3) return null;
    return computeHabitsStats(filtered);
  }, [matches, champion]);
}
