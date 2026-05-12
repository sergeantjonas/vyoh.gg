export interface LimiterCounts {
  RECEIVED: number;
  QUEUED: number;
  RUNNING: number;
  EXECUTING: number;
  // Bottleneck only populates DONE when `trackDoneStatus: true` is set on the
  // limiter, so the runtime type leaves it optional. We mirror that here
  // rather than coercing to a number — undefined is meaningfully different
  // from 0 ("not tracked" vs "tracked, zero done").
  DONE?: number;
}

export type Regional = "americas" | "europe" | "asia" | "sea";

export type MethodFamily =
  | "account-by-riot-id"
  | "match-ids-by-puuid"
  | "match-by-id"
  | "match-timeline-by-id"
  | "league-entries-by-puuid"
  | "summoner-by-puuid"
  | "active-game-by-puuid"
  | "champion-mastery-by-champion";

export interface AppWindowSnapshot {
  regional: Regional;
  role: "fast" | "slow";
  windowSec: number;
  capacity: number;
  reservoir: number | null;
  counts: LimiterCounts;
}

export interface MethodLimiterSnapshot {
  regional: Regional;
  family: MethodFamily;
  windowSec: number;
  capacity: number;
  reservoir: number | null;
  counts: LimiterCounts;
}

export interface RateLimiterSnapshot {
  app: AppWindowSnapshot[];
  method: MethodLimiterSnapshot[];
  capturedAt: string;
}

export interface SyncTickAccountResult {
  slug: string;
  label: string;
  head: { idCount: number; backfilled: number } | { error: string };
  historical:
    | { idCount: number; backfilled: number; done: boolean; skipped: boolean }
    | { error: string };
}

export interface SyncTick {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  accounts: SyncTickAccountResult[];
}

export interface SyncStatus {
  enabled: boolean;
  running: boolean;
  lastTick: SyncTick | null;
  history: SyncTick[];
}

// Result of a manual "sync now" trigger. The actual sync runs asynchronously;
// this only reports whether the trigger took effect. `reason` is set when
// `triggered` is false — e.g. "paused" or "already running".
export interface SyncTriggerResult {
  triggered: boolean;
  reason?: string;
  status: SyncStatus;
}

export interface StatusSnapshot {
  sync: SyncStatus;
  rateLimiter: RateLimiterSnapshot;
}
