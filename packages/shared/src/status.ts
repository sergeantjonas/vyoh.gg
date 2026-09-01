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

// Every stream's cron jobs report through one registry, so a job's identity has
// to say which stream it belongs to — the status board groups by it, and the two
// streams have nothing else in common.
export type SyncJobStream = "lol" | "steam";

// One completed run. `error` carries the failure the job swallowed: a poller
// that logs and lets the scheduler fire again is invisible from the outside
// otherwise, which is the gap this whole shape exists to close.
export interface SyncJobRun {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  outcome: "ok" | "error";
  error?: string;
}

export interface SyncJobStatus {
  name: string;
  stream: SyncJobStream;
  label: string;
  // The cron expression the job is registered under, so the board can say how
  // often a run is expected without the reader knowing the schedule by heart.
  cron: string;
  running: boolean;
  lastRun: SyncJobRun | null;
}

// Result of a manual trigger on one job. Like `SyncTriggerResult`, this only
// reports whether the run started — the work itself outlives the request, and
// its outcome arrives on the next status snapshot.
export interface SyncJobTriggerResult {
  triggered: boolean;
  reason?: string;
  job: SyncJobStatus;
}

export type SyncJobHealth = "running" | "ok" | "error" | "pending";

/**
 * The single reading of a job's state that display code is allowed to make.
 *
 * "pending" is deliberately distinct from "ok": a job with no `lastRun` has
 * either never fired or last fired before the last restart, and rendering that
 * as healthy would let a job that never runs look identical to one that just
 * succeeded.
 */
export function syncJobHealth(job: SyncJobStatus): SyncJobHealth {
  if (job.running) return "running";
  if (!job.lastRun) return "pending";
  return job.lastRun.outcome === "error" ? "error" : "ok";
}

export interface StatusSnapshot {
  sync: SyncStatus;
  jobs: SyncJobStatus[];
  rateLimiter: RateLimiterSnapshot;
}
