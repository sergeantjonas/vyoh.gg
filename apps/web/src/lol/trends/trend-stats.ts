import { type MatchSummary, excludeRemakes, queueLabel } from "@vyoh/shared";

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
  /** A representative id for the group. Every id sharing a label resolves to
   *  the same colour, so which member it is doesn't matter. */
  queueId: number;
  label: string;
  count: number;
}

/**
 * Grouped by *label*, not by id, and that is the right key here specifically
 * because this feeds a legend. All four Swarm ids read "Swarm" to a player, so
 * splitting them into four slices and four legend rows would be noise. This is
 * the one place the label is the correct grouping key; anywhere a filter or a
 * statistic asks "which queue", it asks the id.
 */
export function computeQueueCounts(matches: MatchSummary[]): QueueCount[] {
  const counts = new Map<string, { queueId: number; count: number }>();
  for (const m of excludeRemakes(matches)) {
    const label = queueLabel(m.queueId);
    const prev = counts.get(label);
    if (prev) prev.count += 1;
    else counts.set(label, { queueId: m.queueId, count: 1 });
  }
  return [...counts.entries()]
    .map(([label, { queueId, count }]) => ({ queueId, label, count }))
    .sort((a, b) => b.count - a.count);
}

export { computeStreak } from "@vyoh/shared";
export type { Streak } from "@vyoh/shared";
