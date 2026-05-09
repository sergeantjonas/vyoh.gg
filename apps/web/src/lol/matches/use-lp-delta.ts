import type { MatchSummary } from "@vyoh/shared";
import { normalizeLp } from "@vyoh/shared/lol/rank-history";
import { useMemo } from "react";
import { useMatchWindow } from "./match-window-context";

export function computeLpDeltaMap(matches: MatchSummary[]): Map<string, number> {
  const map = new Map<string, number>();
  const lastByQueue = new Map<string, number>();
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (
      !m ||
      m.snapshotTier === undefined ||
      m.snapshotLp === undefined ||
      m.snapshotRank === undefined
    )
      continue;
    const norm = normalizeLp(m.snapshotTier, m.snapshotRank, m.snapshotLp);
    const prev = lastByQueue.get(m.queueType);
    if (prev !== undefined) map.set(m.matchId, norm - prev);
    lastByQueue.set(m.queueType, norm);
  }
  return map;
}

export function useLpDeltaMap(): Map<string, number> {
  const { matches } = useMatchWindow();
  return useMemo(() => computeLpDeltaMap(matches ?? []), [matches]);
}
