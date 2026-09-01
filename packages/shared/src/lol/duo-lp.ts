import type { Duo } from "./duo.ts";
import { excludeRemakes } from "./exclude-remakes.ts";
import { type LpSnapshotPair, matchLpDelta } from "./lp-delta.ts";
import { RANKED_QUEUE_IDS } from "./queue-types.ts";

/** Ranked games with a measurable LP delta, and the LP they moved in total. */
export interface DuoLpSlice {
  games: number;
  lpDelta: number;
}

export interface DuoLpMatchPoint {
  matchId: string;
  playedAt: string;
  /** Which ladder the game moved, so a per-queue chart can pick its own. */
  queueId: number;
  lpDelta: number;
}

/**
 * The owner's LP movement split by whether a recurring duo was on the team.
 * Owner-only: it is the owner's ladder, computed over the same recent-match
 * window as the duo detection it annotates.
 */
export interface DuoLpOverlay {
  puuid: string;
  together: DuoLpSlice;
  /** The owner's other ranked games in the window — the comparison baseline. */
  without: DuoLpSlice;
  /** The `together` games individually, newest first, for marking on a chart. */
  matches: DuoLpMatchPoint[];
}

export type DuoLpSourceMatch = LpSnapshotPair & {
  matchId: string;
  playedAt: string;
  queueId: number;
  remake: boolean;
};

/**
 * Only ranked games that carry both snapshots count, on either side of the
 * split — a game with no measurable delta would otherwise inflate `games`
 * without moving `lpDelta`. Solo and flex are summed together: each delta is
 * self-contained, so the total reads as "LP earned across ranked queues".
 */
export function computeDuoLpOverlays(
  duos: readonly Pick<Duo, "puuid" | "matchIds">[],
  matches: readonly DuoLpSourceMatch[]
): DuoLpOverlay[] {
  const ranked = new Set(RANKED_QUEUE_IDS);
  const measurable: DuoLpMatchPoint[] = [];
  for (const m of excludeRemakes(matches)) {
    if (!ranked.has(m.queueId)) continue;
    const lpDelta = matchLpDelta(m);
    if (lpDelta === null) continue;
    measurable.push({
      matchId: m.matchId,
      playedAt: m.playedAt,
      queueId: m.queueId,
      lpDelta,
    });
  }
  measurable.sort((a, b) => b.playedAt.localeCompare(a.playedAt));

  return duos.map((duo) => {
    const shared = new Set(duo.matchIds);
    const together: DuoLpSlice = { games: 0, lpDelta: 0 };
    const without: DuoLpSlice = { games: 0, lpDelta: 0 };
    const points: DuoLpMatchPoint[] = [];
    for (const point of measurable) {
      if (shared.has(point.matchId)) {
        together.games += 1;
        together.lpDelta += point.lpDelta;
        points.push(point);
      } else {
        without.games += 1;
        without.lpDelta += point.lpDelta;
      }
    }
    return { puuid: duo.puuid, together, without, matches: points };
  });
}
