// Baseline: personal — per-champion aggregates from your own match history. The
// Champion-detail delta tiles compare these to your account-wide averages — a
// personal baseline both directions.
import { type RolePosition, isRolePosition } from "@/lol/_shared/assets/role-icon";
import type { MatchSummary } from "@vyoh/shared";
import type { ChampionStats } from "./champion-stats";

export interface ChampionDetailStats extends ChampionStats {
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  // Chronological (oldest first) — used for win-rate trend sparkline
  matchHistory: Array<{ win: boolean }>;
}

export function computeChampionDetail(
  championKey: string,
  allMatches: MatchSummary[]
): ChampionDetailStats | null {
  const key = championKey.toLowerCase();
  const champMatches = allMatches.filter((m) => m.champion.toLowerCase() === key);
  if (champMatches.length === 0) return null;

  // Preserve original-case alias from match data for display/CDragon lookups
  const originalAlias = champMatches[0]?.champion ?? championKey;

  // Oldest first for the trend line
  const sorted = [...champMatches].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
  );

  const games = champMatches.length;
  const wins = champMatches.filter((m) => m.win).length;
  const losses = games - wins;
  const totalKills = champMatches.reduce((s, m) => s + m.kills, 0);
  const totalDeaths = champMatches.reduce((s, m) => s + m.deaths, 0);
  const totalAssists = champMatches.reduce((s, m) => s + m.assists, 0);
  const totalDurationSec = champMatches.reduce((s, m) => s + m.durationSec, 0);
  const avgKda =
    totalDeaths === 0
      ? totalKills + totalAssists
      : (totalKills + totalAssists) / totalDeaths;

  // Detail aggregates across roles, so `position` reports the dominant lane.
  // Falls back to MIDDLE only when no match has a valid teamPosition (pure
  // ARAM history) — the detail page already filters on serious queues, so
  // this branch is mostly defensive.
  const roleCounts = new Map<RolePosition, number>();
  for (const m of champMatches) {
    if (!isRolePosition(m.teamPosition)) continue;
    roleCounts.set(m.teamPosition, (roleCounts.get(m.teamPosition) ?? 0) + 1);
  }
  let position: RolePosition = "MIDDLE";
  let best = 0;
  for (const [role, count] of roleCounts) {
    if (count > best) {
      best = count;
      position = role;
    }
  }

  return {
    champion: originalAlias,
    position,
    games,
    wins,
    losses,
    winRate: wins / games,
    totalKills,
    totalDeaths,
    totalAssists,
    avgKda,
    totalDurationSec,
    avgKills: totalKills / games,
    avgDeaths: totalDeaths / games,
    avgAssists: totalAssists / games,
    matchHistory: sorted.map((m) => ({ win: m.win })),
  };
}

// Rolling cumulative win rate — each point is the win rate after that many games.
// Converges toward the true rate, more interesting than a raw W/L binary.
export function buildWinRateSeries(
  history: Array<{ win: boolean }>
): Array<{ game: number; winRate: number }> {
  let wins = 0;
  return history.map(({ win }, i) => {
    if (win) wins++;
    return { game: i + 1, winRate: wins / (i + 1) };
  });
}
