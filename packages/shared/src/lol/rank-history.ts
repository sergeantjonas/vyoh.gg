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

// Season detection
//
// Riot doesn't expose historical season-end ranks via any public API (League-V4
// only returns current standing). So we detect split/season boundaries from
// our own RankSnapshot data: a "soft reset" looks like a large normalized-LP
// drop after a period of inactivity. Thresholds are tuned to:
//   - ignore normal demotions (≤100 LP)
//   - ignore losing streaks while actively playing (small time gap)
//   - catch split resets where players drop ~5 divisions after weeks off
const SEASON_LP_DROP_MIN = 400;
const SEASON_GAP_DAYS_MIN = 7;
const DAY_MS = 86_400_000;

export interface DetectedSeason {
  startAt: string;
  endAt: string;
  startRank: { tier: string; rank: string; leaguePoints: number; totalLp: number };
  endRank: { tier: string; rank: string; leaguePoints: number; totalLp: number };
  peakRank: { tier: string; rank: string; leaguePoints: number; totalLp: number };
  ongoing: boolean;
}

function pointToRank(p: RankHistoryPoint) {
  return {
    tier: p.tier,
    rank: p.rank,
    leaguePoints: p.leaguePoints,
    totalLp: normalizeLp(p.tier, p.rank, p.leaguePoints),
  };
}

export function detectSeasons(points: RankHistoryPoint[]): DetectedSeason[] {
  if (points.length === 0) return [];

  // Boundary indices are the START of a new season (i.e., points[i] is the
  // first snapshot of a new season; points[i-1] is the end of the previous).
  const boundaries: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev || !curr) continue;
    const prevLp = normalizeLp(prev.tier, prev.rank, prev.leaguePoints);
    const currLp = normalizeLp(curr.tier, curr.rank, curr.leaguePoints);
    const lpDrop = prevLp - currLp;
    const gapMs =
      new Date(curr.capturedAt).getTime() - new Date(prev.capturedAt).getTime();
    if (lpDrop >= SEASON_LP_DROP_MIN && gapMs >= SEASON_GAP_DAYS_MIN * DAY_MS) {
      boundaries.push(i);
    }
  }

  const segmentStarts = [0, ...boundaries];
  const seasons: DetectedSeason[] = [];

  for (let s = 0; s < segmentStarts.length; s++) {
    const start = segmentStarts[s];
    if (start === undefined) continue;
    const nextStart = segmentStarts[s + 1];
    const end = nextStart !== undefined ? nextStart - 1 : points.length - 1;
    const startPoint = points[start];
    const endPoint = points[end];
    if (!startPoint || !endPoint) continue;

    let peak = startPoint;
    let peakLp = normalizeLp(peak.tier, peak.rank, peak.leaguePoints);
    for (let i = start; i <= end; i++) {
      const p = points[i];
      if (!p) continue;
      const lp = normalizeLp(p.tier, p.rank, p.leaguePoints);
      if (lp > peakLp) {
        peak = p;
        peakLp = lp;
      }
    }

    seasons.push({
      startAt: startPoint.capturedAt,
      endAt: endPoint.capturedAt,
      startRank: pointToRank(startPoint),
      endRank: pointToRank(endPoint),
      peakRank: pointToRank(peak),
      ongoing: nextStart === undefined,
    });
  }

  return seasons;
}
