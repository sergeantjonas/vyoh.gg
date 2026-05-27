// Baseline: personal — per-champion aggregates from your own match history. The
// Champion-detail delta tiles compare these to your account-wide averages — a
// personal baseline both directions.
import { type RolePosition, isRolePosition } from "@/lol/_shared/assets/role-icon";
import type { MatchSummary } from "@vyoh/shared";
import type { ChampionRoleSplit, ChampionStats } from "./champion-stats";

export interface ChampionDetailStats extends ChampionStats {
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  // Chronological (oldest first) — drives the win-rate trend (cumulative) plus
  // per-stat inline sparklines on the K/D/A tiles, so each entry carries the
  // raw per-game numbers alongside the win flag.
  matchHistory: Array<{ win: boolean; kills: number; deaths: number; assists: number }>;
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

  // Detail aggregates across roles, so `position` reports the dominant lane
  // and `roles` carries the per-lane breakdown (mirrors the consolidated list
  // row so detail/list always agree on the dominant lane). Falls back to
  // MIDDLE only when no match has a valid teamPosition (pure ARAM history) —
  // the detail page already filters on serious queues, so the fallback is
  // mostly defensive.
  const roleAccums = new Map<RolePosition, { games: number; wins: number }>();
  for (const m of champMatches) {
    if (!isRolePosition(m.teamPosition)) continue;
    let r = roleAccums.get(m.teamPosition);
    if (!r) {
      r = { games: 0, wins: 0 };
      roleAccums.set(m.teamPosition, r);
    }
    r.games++;
    if (m.win) r.wins++;
  }
  const roles: ChampionRoleSplit[] = [...roleAccums.entries()]
    .map(([pos, r]) => ({
      position: pos,
      games: r.games,
      wins: r.wins,
      losses: r.games - r.wins,
      winRate: r.wins / r.games,
    }))
    .sort((a, b) => b.games - a.games);
  const position: RolePosition = roles[0]?.position ?? "MIDDLE";

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
    roles,
    avgKills: totalKills / games,
    avgDeaths: totalDeaths / games,
    avgAssists: totalAssists / games,
    matchHistory: sorted.map((m) => ({
      win: m.win,
      kills: m.kills,
      deaths: m.deaths,
      assists: m.assists,
    })),
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
