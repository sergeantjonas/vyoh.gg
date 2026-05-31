// Single source of truth for the "is this match a remake?" rule. The 210s
// threshold separates a true remake (early surrender within the first 3.5
// minutes) from a Season 2 2026 inting-surrender (the mid-game mechanic that
// fires after ~3.5 min and affects LP). The predicate is strict (`< 210`) —
// exactly 210s with the early-surrender flag is an inting-surrender, not a
// remake. Repo-conventions § "Centralise domain invariants" requires every
// LoL aggregation to filter remakes the same way, so any new remake gate
// MUST call `isRemakeMatch()` rather than re-deriving the predicate inline.
export const REMAKE_DURATION_S = 210;

export function isRemakeMatch(
  durationSec: number,
  gameEndedInEarlySurrender: boolean
): boolean {
  return gameEndedInEarlySurrender && durationSec < REMAKE_DURATION_S;
}
