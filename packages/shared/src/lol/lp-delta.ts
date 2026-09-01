import { normalizeLp } from "./rank-history.ts";

/**
 * The two rank snapshots the match sync attaches to an owner's ranked match:
 * AFTER from the post-match League-V4 read, BEFORE from the most recent
 * `RankSnapshot` strictly before `playedAt`. Structural so both the api's
 * nullable Prisma rows and the web's optional `MatchSummary` fields satisfy it.
 */
export interface LpSnapshotPair {
  snapshotTier?: string | null;
  snapshotRank?: string | null;
  snapshotLp?: number | null;
  snapshotTierBefore?: string | null;
  snapshotRankBefore?: string | null;
  snapshotLpBefore?: number | null;
}

/**
 * Self-contained per-match LP delta = norm(after) − norm(before), or null when
 * either half is missing. Not chaining across previous matches is the point:
 * decay or any other non-match LP movement between games never leaks into the
 * next match's gain/loss.
 */
export function matchLpDelta(m: LpSnapshotPair): number | null {
  if (
    m.snapshotTier == null ||
    m.snapshotRank == null ||
    m.snapshotLp == null ||
    m.snapshotTierBefore == null ||
    m.snapshotRankBefore == null ||
    m.snapshotLpBefore == null
  ) {
    return null;
  }
  const after = normalizeLp(m.snapshotTier, m.snapshotRank, m.snapshotLp);
  const before = normalizeLp(
    m.snapshotTierBefore,
    m.snapshotRankBefore,
    m.snapshotLpBefore
  );
  return after - before;
}

export function computeLpDeltaMap(
  matches: readonly (LpSnapshotPair & { matchId: string })[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of matches) {
    const delta = matchLpDelta(m);
    if (delta !== null) map.set(m.matchId, delta);
  }
  return map;
}
