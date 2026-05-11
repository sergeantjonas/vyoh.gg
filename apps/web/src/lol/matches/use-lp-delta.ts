import type { MatchSummary } from "@vyoh/shared";
import { normalizeLp } from "@vyoh/shared/lol/rank-history";
import { useMemo } from "react";
import { useMatchWindow } from "./match-window-context";

export function computeLpDeltaMap(matches: MatchSummary[]): Map<string, number> {
  // Per-match self-contained delta = norm(after) - norm(before). The match
  // sync captures both: AFTER from the post-match snapshot attached at sync
  // time, BEFORE from the most recent RankSnapshot strictly before playedAt.
  // Skipping the chain across previous matches means decay or any other
  // non-match LP movement between games never leaks into the next delta.
  const map = new Map<string, number>();
  for (const m of matches) {
    if (
      m.snapshotTier === undefined ||
      m.snapshotRank === undefined ||
      m.snapshotLp === undefined ||
      m.snapshotTierBefore === undefined ||
      m.snapshotRankBefore === undefined ||
      m.snapshotLpBefore === undefined
    ) {
      continue;
    }
    const after = normalizeLp(m.snapshotTier, m.snapshotRank, m.snapshotLp);
    const before = normalizeLp(
      m.snapshotTierBefore,
      m.snapshotRankBefore,
      m.snapshotLpBefore
    );
    map.set(m.matchId, after - before);
  }
  return map;
}

export function useLpDeltaMap(): Map<string, number> {
  const { matches } = useMatchWindow();
  return useMemo(() => computeLpDeltaMap(matches ?? []), [matches]);
}
