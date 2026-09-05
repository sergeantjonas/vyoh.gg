// "Nearest 100%" planner — which started-but-unfinished games are the least
// work to complete. Returned by GET /api/steam/achievements/completion-candidates.
//
// The ranking is an effort estimate, not a probability: each locked
// achievement costs `1 - globalPercent / 100`, so a common one (90% of
// players have it) costs 0.1 and a near-floor one costs ~1. Summing those over
// the locked set means "3 left, all common" (≈0.3) sorts ahead of "1 left at
// 0.5%" (≈1.0), which is the read a completionist wants. Bounding the
// per-achievement cost at 1 also keeps the rarity floor harmless: Steam
// reports launch-window achievements at 0.0% for their first weeks, and a
// score built on `100 / percent` would send every new game to the top.

export interface SteamCompletionCandidate {
  appid: number;
  total: number;
  unlocked: number;
  remaining: number;
  // Mean global percent across the locked achievements that carry rarity,
  // or null when none of them have been polled yet.
  remainingAvgPercent: number | null;
  // Lowest global percent among the locked achievements — the blocker — or
  // null under the same condition.
  remainingMinPercent: number | null;
  // Estimated effort to finish; see the header. Lower is nearer.
  score: number;
}

export interface SteamCompletionCandidates {
  candidates: SteamCompletionCandidate[];
}

// One locked achievement as the read path sees it: which game, and its
// current global percent (null before the weekly rarity poll covers it).
export interface LockedAchievementRow {
  appid: number;
  globalPercent: number | null;
}

// Neutral cost for a locked achievement with no rarity yet. Skipping it
// would rank an unpolled game as nearer than it is; charging full cost would
// bury it. Half is the honest "don't know".
export const UNRATED_ACHIEVEMENT_COST = 0.5;

export function lockedAchievementCost(globalPercent: number | null): number {
  if (globalPercent === null) return UNRATED_ACHIEVEMENT_COST;
  return Math.min(1, Math.max(0, 1 - globalPercent / 100));
}

/**
 * Ranks games by estimated effort to 100%. `totals` is the schema size per
 * appid; `locked` is every locked achievement across the library. A game is a
 * candidate only when it has been started (at least one unlock) and is not
 * yet finished — untouched games are not "near" anything, and finished ones
 * belong to the 100%'d hall. Ties break on fewer remaining, then appid, so
 * the order is stable across polls.
 */
export function buildCompletionCandidates(
  totals: readonly { appid: number; total: number }[],
  locked: readonly LockedAchievementRow[]
): SteamCompletionCandidate[] {
  const byAppid = new Map<
    number,
    {
      remaining: number;
      score: number;
      ratedSum: number;
      rated: number;
      min: number | null;
    }
  >();
  for (const row of locked) {
    const acc = byAppid.get(row.appid) ?? {
      remaining: 0,
      score: 0,
      ratedSum: 0,
      rated: 0,
      min: null,
    };
    acc.remaining += 1;
    acc.score += lockedAchievementCost(row.globalPercent);
    if (row.globalPercent !== null) {
      acc.ratedSum += row.globalPercent;
      acc.rated += 1;
      acc.min =
        acc.min === null ? row.globalPercent : Math.min(acc.min, row.globalPercent);
    }
    byAppid.set(row.appid, acc);
  }

  const candidates: SteamCompletionCandidate[] = [];
  for (const { appid, total } of totals) {
    const acc = byAppid.get(appid);
    if (!acc || acc.remaining >= total) continue;
    candidates.push({
      appid,
      total,
      unlocked: total - acc.remaining,
      remaining: acc.remaining,
      remainingAvgPercent: acc.rated > 0 ? acc.ratedSum / acc.rated : null,
      remainingMinPercent: acc.min,
      score: acc.score,
    });
  }

  // Scores are float sums, so "equal" needs a tolerance or the documented
  // tiebreaks never get a turn.
  candidates.sort((a, b) => {
    const d = a.score - b.score;
    if (Math.abs(d) > 1e-9) return d;
    return a.remaining - b.remaining || a.appid - b.appid;
  });
  return candidates;
}
