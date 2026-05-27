import { type RolePosition, isRolePosition } from "@/lol/_shared/assets/role-icon";
import type { MatchSummary } from "@vyoh/shared";

// Per-role slice surfaced inline on the consolidated row — lets a champion
// played in multiple lanes (e.g. Ahri mid + top) show one card with a
// breakdown popover instead of duplicating into two cards that both link to
// the same role-agnostic detail page.
export interface ChampionRoleSplit {
  position: RolePosition;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface ChampionStats {
  champion: string;
  // Dominant role (most games). Mirrors ChampionDetailStats so the list row
  // and detail hero report the same lane.
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
  // Sorted by games desc; length 1 for single-role pools.
  roles: ChampionRoleSplit[];
  // Cumulative win rate over the last up-to-10 ranked games on this champion,
  // chronological (oldest first). Drives the row-level sparkline — short
  // enough to fit beside the WR number, long enough to show recent form.
  recentWinRates: number[];
}

const RECENT_WINDOW = 10;

// Cumulative win rate over the most recent up-to-`RECENT_WINDOW` games on this
// champion, chronological. Sort desc by playedAt, slice the window, reverse to
// oldest-first, then accumulate. Mirrors `buildWinRateSeries` in
// champion-detail-stats.ts but bounded so the per-row sparkline stays legible.
function buildRecentWinRates(
  timeline: Array<{ playedAt: string; win: boolean }>
): number[] {
  const recent = [...timeline]
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
    .slice(0, RECENT_WINDOW)
    .reverse();
  let wins = 0;
  return recent.map(({ win }, i) => {
    if (win) wins++;
    return wins / (i + 1);
  });
}

export function aggregateChampionStats(matches: MatchSummary[]): ChampionStats[] {
  type RoleAccum = { games: number; wins: number };
  type ChampAccum = {
    champion: string;
    totalKills: number;
    totalDeaths: number;
    totalAssists: number;
    totalDurationSec: number;
    roleAccums: Map<RolePosition, RoleAccum>;
    // Win flags paired with `playedAt` so the per-champion order is independent
    // of the input array's order. Sorted at the end to derive the rolling-WR
    // sparkline series.
    timeline: Array<{ playedAt: string; win: boolean }>;
  };
  const byChamp = new Map<string, ChampAccum>();

  for (const match of matches) {
    if (match.remake) continue;
    // Drop ARAM/Arena rows — they have no teamPosition and would muddle the
    // role breakdown.
    if (!isRolePosition(match.teamPosition)) continue;
    let champ = byChamp.get(match.champion);
    if (!champ) {
      champ = {
        champion: match.champion,
        totalKills: 0,
        totalDeaths: 0,
        totalAssists: 0,
        totalDurationSec: 0,
        roleAccums: new Map(),
        timeline: [],
      };
      byChamp.set(match.champion, champ);
    }
    champ.totalKills += match.kills;
    champ.totalDeaths += match.deaths;
    champ.totalAssists += match.assists;
    champ.totalDurationSec += match.durationSec;
    champ.timeline.push({ playedAt: match.playedAt, win: match.win });
    let role = champ.roleAccums.get(match.teamPosition);
    if (!role) {
      role = { games: 0, wins: 0 };
      champ.roleAccums.set(match.teamPosition, role);
    }
    role.games++;
    if (match.win) role.wins++;
  }

  const result: ChampionStats[] = [];
  for (const champ of byChamp.values()) {
    const roles: ChampionRoleSplit[] = [...champ.roleAccums.entries()]
      .map(([position, r]) => ({
        position,
        games: r.games,
        wins: r.wins,
        losses: r.games - r.wins,
        winRate: r.wins / r.games,
      }))
      .sort((a, b) => b.games - a.games);
    const games = roles.reduce((s, r) => s + r.games, 0);
    const wins = roles.reduce((s, r) => s + r.wins, 0);
    const losses = games - wins;
    // `roles` is non-empty here: champ is only created when a match with a
    // valid teamPosition lands, which seeds at least one role accum.
    const dominantRole = roles[0]?.position ?? "MIDDLE";
    const avgKda =
      champ.totalDeaths === 0
        ? champ.totalKills + champ.totalAssists
        : (champ.totalKills + champ.totalAssists) / champ.totalDeaths;
    const recentWinRates = buildRecentWinRates(champ.timeline);
    result.push({
      champion: champ.champion,
      position: dominantRole,
      games,
      wins,
      losses,
      winRate: wins / games,
      totalKills: champ.totalKills,
      totalDeaths: champ.totalDeaths,
      totalAssists: champ.totalAssists,
      avgKda,
      totalDurationSec: champ.totalDurationSec,
      roles,
      recentWinRates,
    });
  }

  return result.sort((a, b) => b.games - a.games);
}
