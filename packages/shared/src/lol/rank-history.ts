// LP cannot be plotted directly across tiers because each tier+division resets
// to 0–100. We normalize to a single monotonically-increasing scale so the
// chart can render tier transitions as smooth movement instead of vertical
// resets.
//
// Convention: IRON IV 0LP = 0. Each tier below MASTER is 400 LP wide
// (4 divisions × 100). MASTER and above have no divisions; their `rank` field
// from Riot is always "I" but should be ignored.
const TIER_INDEX: Record<string, number> = {
  IRON: 0,
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
  PLATINUM: 4,
  EMERALD: 5,
  DIAMOND: 6,
  MASTER: 7,
  GRANDMASTER: 7,
  CHALLENGER: 7,
};

const RANK_OFFSET: Record<string, number> = { IV: 0, III: 100, II: 200, I: 300 };

const TIER_DISPLAY: Record<string, string> = {
  IRON: "Iron",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
  EMERALD: "Emerald",
  DIAMOND: "Diamond",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
  CHALLENGER: "Challenger",
};

export function normalizeLp(tier: string, rank: string, leaguePoints: number): number {
  const t = tier.toUpperCase();
  const tierIndex = TIER_INDEX[t] ?? 0;
  const tierBase = tierIndex * 400;
  if (tierIndex >= 7) return tierBase + leaguePoints;
  return tierBase + (RANK_OFFSET[rank.toUpperCase()] ?? 0) + leaguePoints;
}

export function formatRank(tier: string, rank: string, leaguePoints: number): string {
  const display = TIER_DISPLAY[tier.toUpperCase()] ?? tier;
  const tierIndex = TIER_INDEX[tier.toUpperCase()] ?? 0;
  if (tierIndex >= 7) return `${display} ${leaguePoints}LP`;
  return `${display} ${rank} ${leaguePoints}LP`;
}

export interface RankHistoryPoint {
  capturedAt: string;
  queueId: string;
  tier: string;
  rank: string;
  leaguePoints: number;
}

export interface RankHistoryResponse {
  solo: RankHistoryPoint[];
  flex: RankHistoryPoint[];
}
