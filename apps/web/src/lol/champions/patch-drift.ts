// Baseline: personal — this champion's share of your games this patch vs last patch.
import { groupByPatch } from "@/lol/_shared/patch/patch-version";
import type { MatchSummary } from "@vyoh/shared";

const MIN_PATCH_GAMES = 5;
const MIN_CURRENT_CHAMP_GAMES = 1;
const MIN_PREVIOUS_CHAMP_GAMES = 2;
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

  // Suppress when this patch hasn't seen the champion yet ("0 games this patch"
  // reads as noise — the user just hasn't picked them yet). Also require a
  // non-trivial previous baseline so we don't flag against a single accidental
  // game last patch.
  if (currentChamp < MIN_CURRENT_CHAMP_GAMES) return null;
  if (previousChamp < MIN_PREVIOUS_CHAMP_GAMES) return null;

  const currentShare = currentChamp / currentTotal;
  const previousShare = previousChamp / previousTotal;

  const ppChange = Math.abs((currentShare - previousShare) * 100);
  const relativeChange = Math.abs((currentShare - previousShare) / previousShare);

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
    relativeChangePct: Math.round(relativeChange * 100),
  };
}
