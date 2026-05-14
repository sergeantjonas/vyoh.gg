import { groupByPatch } from "@/lol/_shared/patch/patch-version";
import {
  filterToSerious,
  useSeriousQueues,
} from "@/lol/_shared/serious-queues/serious-queues";
import { useCachedMatchesWindow } from "@/lol/matches/use-matches";
import type { LolAccount, MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";
import type { TrendsRangeId } from "./trends-range-selector";

// Default fetch covers ~30d at typical play rates. The Patch range needs to
// span at least two patches' worth of games for the previous-patch comparison
// to populate; heavy grinders (e.g. ~200 ranked/patch) push that to 400+.
// 800 gives enough headroom without inflating fetches for the time-based
// ranges where 200 was already sufficient.
const TRENDS_FETCH_DEFAULT = 200;
const TRENDS_FETCH_PATCH = 800;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getFetchCount(rangeId: TrendsRangeId): number {
  return rangeId === "patch" ? TRENDS_FETCH_PATCH : TRENDS_FETCH_DEFAULT;
}

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

  if (rangeId === "patch") {
    // groupByPatch returns oldest-first; the last bucket is the current patch,
    // the bucket before it is the previous patch. Matches with empty
    // gameVersion drop out — same posture as the rest of the patch features.
    const buckets = groupByPatch(matches, (m) => m.gameVersion);
    const currentBucket = buckets[buckets.length - 1];
    const previousBucket = buckets.length >= 2 ? buckets[buckets.length - 2] : undefined;
    return {
      current: currentBucket?.items ?? [],
      previous: previousBucket?.items ?? [],
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
  const { data, isPending } = useCachedMatchesWindow(account, getFetchCount(rangeId));
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
