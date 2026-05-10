import { filterToSerious, useSeriousQueues } from "@/lol/_shared/serious-queues";
import { useCachedMatchesWindow } from "@/lol/matches/use-matches";
import type { LolAccount, MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";
import type { TrendsRangeId } from "./trends-range-selector";

const TRENDS_FETCH_COUNT = 200;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function splitWindows(
  matches: MatchSummary[],
  rangeId: TrendsRangeId
): { current: MatchSummary[]; previous: MatchSummary[] } {
  // Newest first so slice(0, 100) gives the most recent 100 games.
  const sorted = [...matches].sort((a, b) => b.playedAt.localeCompare(a.playedAt));

  if (rangeId === "100g") {
    return {
      current: sorted.slice(0, 100),
      previous: sorted.slice(100, 200),
    };
  }

  const days = rangeId === "7d" ? 7 : 30;
  const now = Date.now();
  const currentCutoff = now - days * MS_PER_DAY;
  const previousCutoff = now - days * 2 * MS_PER_DAY;

  return {
    current: sorted.filter((m) => new Date(m.playedAt).getTime() >= currentCutoff),
    previous: sorted.filter((m) => {
      const t = new Date(m.playedAt).getTime();
      return t >= previousCutoff && t < currentCutoff;
    }),
  };
}

export function useTrendsWindows(
  rangeId: TrendsRangeId,
  account: LolAccount | undefined
): { current: MatchSummary[]; previous: MatchSummary[]; isPending: boolean } {
  const { data, isPending } = useCachedMatchesWindow(account, TRENDS_FETCH_COUNT);
  const { ids } = useSeriousQueues();

  // Trends is an analysis surface — aggregate only over the user's "serious"
  // queues so KDA/tilt/win-rate trajectory don't get diluted by ARAM noise.
  const seriousMatches = useMemo(() => {
    if (!data) return [];
    return filterToSerious(data.matches, ids);
  }, [data, ids]);

  const { current, previous } = useMemo(
    () => splitWindows(seriousMatches, rangeId),
    [seriousMatches, rangeId]
  );

  return { current, previous, isPending };
}
