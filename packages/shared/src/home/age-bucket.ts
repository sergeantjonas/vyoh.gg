import type { RecapAgeBucket } from "./recap-chapter.ts";

// Boundaries match `SteamAgeBucket` in steam/game-recap.ts so the chapter's
// honest-recency framing reads consistently across subjects and moments.
// Centralised here so R-6/R-7 moment-chapter copy can bucket against the
// same edges (last-played for Steam, last-match for LoL, last-unlock for
// achievement clusters) without each call site reproducing 7/30/90.
const CURRENT_MAX_DAYS = 7;
const RECENT_MAX_DAYS = 30;
const SEASON_MAX_DAYS = 90;

/**
 * Map a days-since-activity number to a recency bucket. Negative input (a
 * timestamp in the future — clock skew, racy data) collapses to "current"
 * because the alternative — throwing or returning null — pushes work onto
 * every caller for a non-meaningful edge case. Non-finite input throws
 * because that's always a programmer error, never a real signal.
 */
export function ageBucketFromDaysSince(daysSince: number): RecapAgeBucket {
  if (!Number.isFinite(daysSince)) {
    throw new Error(`ageBucketFromDaysSince: non-finite input (${daysSince})`);
  }
  if (daysSince <= CURRENT_MAX_DAYS) return "current";
  if (daysSince <= RECENT_MAX_DAYS) return "recent";
  if (daysSince <= SEASON_MAX_DAYS) return "season";
  return "year";
}

/**
 * Integer day delta between `now` and an ISO timestamp. Floored so a play
 * 6 hours ago reports 0 days (still "current") rather than rounding up.
 * Returns null when the timestamp is missing or unparseable so callers can
 * pick their own degraded-input behaviour (most filter the candidate out
 * entirely; the chapter's age-bucket copy then doesn't have to render a
 * "no data" register).
 */
export function daysSinceIso(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const days = Math.floor((now.getTime() - then) / (1000 * 60 * 60 * 24));
  return days;
}
