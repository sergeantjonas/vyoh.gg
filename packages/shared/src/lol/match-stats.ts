import { excludeRemakes } from "./exclude-remakes.ts";
import type { MatchSummary } from "./match.ts";

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

export interface Streak {
  type: "win" | "loss";
  count: number;
}

// getDay() returns 0=Sun; remap to 0=Mon…6=Sun
function monFirstDay(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function computeHourDayStats(matches: MatchSummary[]): HourDayStat[] {
  const map = new Map<number, { games: number; wins: number }>();
  for (const m of excludeRemakes(matches)) {
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
  const ordered = [...excludeRemakes(matches)].sort((a, b) =>
    a.playedAt.localeCompare(b.playedAt)
  );
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

export function computeStreak(matches: MatchSummary[]): Streak | null {
  const ms = excludeRemakes(matches);
  if (ms.length === 0) return null;
  const ordered = [...ms].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  const latest = ordered[0];
  if (!latest) return null;
  let count = 1;
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i]?.win === latest.win) count += 1;
    else break;
  }
  if (count < 2) return null;
  return { type: latest.win ? "win" : "loss", count };
}
