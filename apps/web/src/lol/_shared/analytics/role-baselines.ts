// Baseline kind: role-population — source-of-truth for the Trends "you vs typical role floor" tiles
// (damage role consistency, vision investment, lane-phase prognosis).
//
// Hand-tuned typical solo-queue baselines per role. These are intentionally
// approximate — the goal is to give Trends conclusion tiles a reference
// "is the user above or below the typical role floor?" without claiming
// statistical authority. Numbers are rounded to readable values.

import type { MatchSummary } from "@vyoh/shared";

export type Role = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";

// Damage share = participant's totalDamageDealtToChampions divided by their
// team's total. Sums to ~110% across roles because lanes overlap on damage
// in real games — that's by design, the comparison is per-role not absolute.
export const ROLE_DAMAGE_SHARE: Record<Role, number> = {
  TOP: 0.22,
  JUNGLE: 0.19,
  MIDDLE: 0.28,
  BOTTOM: 0.3,
  UTILITY: 0.08,
};

// Average vision score per game. Support runs an order of magnitude higher
// because of warding kit + vision quests. Other roles are clustered.
export const ROLE_VISION_SCORE: Record<Role, number> = {
  TOP: 25,
  JUNGLE: 30,
  MIDDLE: 22,
  BOTTOM: 25,
  UTILITY: 70,
};

// CS@10 baseline. Lane minions give ~75 by minute 10 if you don't miss any;
// jungle's number is artificially low because most camps stop spawning early
// and we count both lane minions + jungle camps in the same field. Support
// is intentionally tiny — farming isn't the role's job, so the lane phase
// prognosis tile sidesteps the comparison for SUPPORT.
export const ROLE_CS_AT_10: Record<Role, number> = {
  TOP: 75,
  JUNGLE: 45,
  MIDDLE: 80,
  BOTTOM: 75,
  UTILITY: 10,
};

export const ROLE_LABEL: Record<Role, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Middle",
  BOTTOM: "Bottom",
  UTILITY: "Support",
};

export function isRole(value: string): value is Role {
  return (
    value === "TOP" ||
    value === "JUNGLE" ||
    value === "MIDDLE" ||
    value === "BOTTOM" ||
    value === "UTILITY"
  );
}

// Aggregates the user's matches by role. ARAM/Arena (empty teamPosition) and
// remakes drop out — the baselines are Rift role-specific so non-positional
// games don't fit the comparison frame.
export function aggregateByRole<T>(
  matches: readonly MatchSummary[],
  pick: (m: MatchSummary) => T
): Map<Role, T[]> {
  const out = new Map<Role, T[]>();
  for (const m of matches) {
    if (m.remake) continue;
    if (!isRole(m.teamPosition)) continue;
    let bucket = out.get(m.teamPosition);
    if (!bucket) {
      bucket = [];
      out.set(m.teamPosition, bucket);
    }
    bucket.push(pick(m));
  }
  return out;
}

// Pick the role the user has played most (by game count) within the window.
// Used by tiles that frame their verdict around the user's primary role.
export function primaryRole(matches: readonly MatchSummary[]): Role | null {
  const counts = aggregateByRole(matches, () => 1);
  let best: Role | null = null;
  let bestCount = 0;
  for (const [role, games] of counts) {
    if (games.length > bestCount) {
      best = role;
      bestCount = games.length;
    }
  }
  return best;
}
