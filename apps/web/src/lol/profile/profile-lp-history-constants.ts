import type { RangeKey } from "@/lol/profile/use-rank-history";
import type { RankedQueueKey } from "@vyoh/shared";

export const RANGE_LABEL: Record<RangeKey, string> = {
  "30d": "30d",
  "90d": "90d",
  season: "Season",
};

export const QUEUE_COLOR: Record<RankedQueueKey, string> = {
  solo: "#34d399",
  flex: "#fbbf24",
  premade: "#818cf8",
};

export const STREAK_MIN_LENGTH = 3;

// Snapshots are only written on LP change, so a wide wall-clock gap between
// two points means the player wasn't playing — at a linear time scale this
// dominates the X axis with empty space and Recharts smoothly interpolates
// across it. Instead of breaking the line, we keep the line continuous and
// collapse oversized gaps to this cap. Within-session game-to-game spacing
// (~25-30 min) stays untouched; an overnight gap becomes a single visible
// step roughly 2x a normal between-game width.
export const MAX_VISUAL_GAP_MS = 60 * 60 * 1000;

// Gap threshold separating two play sessions: anything longer than this
// between consecutive snapshots starts a new session bucket. Picked at 60min
// to forgive between-queue breaks (champ select + post-game) without leaking
// across meal/sleep breaks.
export const SESSION_GAP_MS = 60 * 60 * 1000;

// Per-bucket aggregation density: trades intra-day detail for legibility.
// 30d view shows enough horizontal room per day for session-level nodes;
// 90d/season collapse to one node per Brussels day or the chart becomes
// a fuzzy dot caterpillar for active accounts (Agurin: 15+ games/day).
export type Resolution = "per-game" | "session" | "day";

export const RESOLUTION_FOR_RANGE: Record<RangeKey, Resolution> = {
  "30d": "session",
  "90d": "day",
  season: "day",
};

export const DAY_KEY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Brussels",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Normalized-LP boundaries for each tier (matches `normalizeLp` in shared).
// Master+ has no upper bound; we pin a large sentinel and rely on the chart's
// own Y domain to clip via `ifOverflow="hidden"`.
export const TIER_BANDS: ReadonlyArray<{ name: string; fromLp: number; toLp: number }> = [
  { name: "Iron", fromLp: 0, toLp: 400 },
  { name: "Bronze", fromLp: 400, toLp: 800 },
  { name: "Silver", fromLp: 800, toLp: 1200 },
  { name: "Gold", fromLp: 1200, toLp: 1600 },
  { name: "Platinum", fromLp: 1600, toLp: 2000 },
  { name: "Emerald", fromLp: 2000, toLp: 2400 },
  { name: "Diamond", fromLp: 2400, toLp: 2800 },
  { name: "Master+", fromLp: 2800, toLp: 99_999 },
];

const TIER_SHORT: Record<string, string> = {
  IRON: "Iron",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Plat",
  EMERALD: "Emerald",
  DIAMOND: "Diamond",
  MASTER: "Master",
  GRANDMASTER: "GM",
  CHALLENGER: "Chall",
};

export const APEX_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

export function formatTierShort(tier: string, rank: string): string {
  const t = tier.toUpperCase();
  const display = TIER_SHORT[t] ?? tier;
  return APEX_TIERS.has(t) ? display : `${display} ${rank}`;
}
