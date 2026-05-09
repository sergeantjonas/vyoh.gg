import { useMatchWindow } from "@/lol/matches/match-window-context";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

export interface HourDayStat {
  hour: number; // 0-23
  day: number; // 0=Mon … 6=Sun
  games: number;
  wins: number;
}

export interface TiltStats {
  afterWin: { games: number; wins: number };
  afterLoss: { games: number; wins: number };
}

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

// getDay() returns 0=Sun; remap to 0=Mon…6=Sun
function monFirstDay(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function computeHourDayStats(matches: MatchSummary[]): HourDayStat[] {
  const map = new Map<number, { games: number; wins: number }>();
  for (const m of matches) {
    const d = new Date(m.playedAt);
    const key = monFirstDay(d) * 24 + d.getHours();
    const s = map.get(key) ?? { games: 0, wins: 0 };
    map.set(key, { games: s.games + 1, wins: s.wins + (m.win ? 1 : 0) });
  }
  const result: HourDayStat[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const s = map.get(day * 24 + hour) ?? { games: 0, wins: 0 };
      result.push({ hour, day, ...s });
    }
  }
  return result;
}

export function computeTiltStats(matches: MatchSummary[]): TiltStats {
  const ordered = [...matches].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const stats: TiltStats = {
    afterWin: { games: 0, wins: 0 },
    afterLoss: { games: 0, wins: 0 },
  };
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const curr = ordered[i];
    if (!prev || !curr) continue;
    if (prev.win) {
      stats.afterWin.games++;
      if (curr.win) stats.afterWin.wins++;
    } else {
      stats.afterLoss.games++;
      if (curr.win) stats.afterLoss.wins++;
    }
  }
  return stats;
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
  for (const m of matches) {
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
  const recent = matches.filter((m) => new Date(m.playedAt).getTime() >= cutoff);
  return {
    uniqueChampions: new Set(recent.map((m) => m.champion)).size,
    totalGames: recent.length,
    days: POOL_DAYS,
  };
}

export function computeHabitsStats(matches: MatchSummary[]): HabitsStats {
  const wins = matches.filter((m) => m.win).length;
  return {
    hourDay: computeHourDayStats(matches),
    tilt: computeTiltStats(matches),
    gameLength: computeGameLengthStats(matches),
    pool: computePoolStats(matches),
    overallWinRate: matches.length === 0 ? 0 : wins / matches.length,
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
