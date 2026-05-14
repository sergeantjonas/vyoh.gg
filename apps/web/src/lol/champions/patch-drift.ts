import { groupByPatch } from "@/lol/_shared/patch-version";
import type { MatchSummary } from "@vyoh/shared";

const MIN_PATCH_GAMES = 5;
const MIN_RELATIVE_CHANGE = 0.2;
const MIN_PP_CHANGE = 3;

export interface PatchDrift {
  currentPatch: string;
  previousPatch: string;
  currentShare: number;
  previousShare: number;
  currentChampGames: number;
  currentTotalGames: number;
  direction: "up" | "down";
  relativeChangePct: number;
}

export function buildPatchDrift(
  matches: readonly MatchSummary[],
  championAlias: string
): PatchDrift | null {
  const real = matches.filter((m) => !m.remake);
  const buckets = groupByPatch(real, (m) => m.gameVersion);
  if (buckets.length < 2) return null;

  const current = buckets[buckets.length - 1];
  const previous = buckets[buckets.length - 2];
  if (!current || !previous) return null;

  const currentTotal = current.items.length;
  const previousTotal = previous.items.length;
  if (currentTotal < MIN_PATCH_GAMES || previousTotal < MIN_PATCH_GAMES) return null;

  const alias = championAlias.toLowerCase();
  const currentChamp = current.items.filter(
    (m) => m.champion.toLowerCase() === alias
  ).length;
  const previousChamp = previous.items.filter(
    (m) => m.champion.toLowerCase() === alias
  ).length;

  const currentShare = currentChamp / currentTotal;
  const previousShare = previousChamp / previousTotal;

  const ppChange = Math.abs((currentShare - previousShare) * 100);
  // Relative change is undefined when previousShare is 0; treat any
  // non-zero current play as a meaningful pickup in that case.
  const relativeChange =
    previousShare === 0
      ? currentShare > 0
        ? Number.POSITIVE_INFINITY
        : 0
      : Math.abs((currentShare - previousShare) / previousShare);

  if (relativeChange < MIN_RELATIVE_CHANGE) return null;
  if (ppChange < MIN_PP_CHANGE) return null;

  return {
    currentPatch: current.patch,
    previousPatch: previous.patch,
    currentShare,
    previousShare,
    currentChampGames: currentChamp,
    currentTotalGames: currentTotal,
    direction: currentShare > previousShare ? "up" : "down",
    relativeChangePct: Number.isFinite(relativeChange)
      ? Math.round(relativeChange * 100)
      : 0,
  };
}
