import type { MethodFamily } from "@vyoh/shared";

// Declared in shared because the status board reports per family; the
// `Record` below is what makes a new family without a limit fail to compile.
export type { MethodFamily };

// Conservative dev-key seeds. Actual limits are read from
// X-Method-Rate-Limit on every response and the local reservoir is
// shrunk to match — these values only matter until the first response
// comes back.
export const METHOD_LIMITS: Record<
  MethodFamily,
  { reservoir: number; intervalMs: number }
> = {
  "account-by-riot-id": { reservoir: 1000, intervalMs: 60_000 },
  "match-ids-by-puuid": { reservoir: 2000, intervalMs: 10_000 },
  "match-by-id": { reservoir: 2000, intervalMs: 10_000 },
  "match-timeline-by-id": { reservoir: 2000, intervalMs: 10_000 },
  "league-entries-by-puuid": { reservoir: 1000, intervalMs: 60_000 },
  "summoner-by-puuid": { reservoir: 1000, intervalMs: 60_000 },
  "active-game-by-puuid": { reservoir: 500, intervalMs: 10_000 },
  // champion-mastery-v4 reports `20000:10,1200000:600` (probed 2026-09-25).
  // `syncFromHeaders` only adopts a limit whose window matches the seed's, so
  // the seed carries the 10 s window; the app limit is what binds in practice.
  "champion-mastery-by-champion": { reservoir: 20000, intervalMs: 10_000 },
  "champion-masteries-by-puuid": { reservoir: 20000, intervalMs: 10_000 },
};
