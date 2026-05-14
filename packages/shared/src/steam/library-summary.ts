// Snapshot of the owner's Steam library as of the most recent owned-games poll.
// Returned by GET /api/steam/library-summary. Counts derive from the
// SteamOwnedGame + latest SteamPlaytimeSnapshot tables; no Steam API call is
// made at request time. `lastSyncedAt` is the snapshot date the counts were
// taken from — null when nothing has been polled yet.

export interface SteamLibrarySummary {
  // Currently-owned games (removedAt IS NULL). Removed/refunded titles are
  // excluded but stay in the underlying table for historical playtime.
  ownedCount: number;
  // Games with playtime_forever > 0 in the latest snapshot. "Ever opened."
  everLaunchedCount: number;
  // Owned but never launched. ownedCount - everLaunchedCount.
  untouchedCount: number;
  // ISO-8601 timestamp of the most recent snapshotDate, or null if no poll
  // has completed yet (first-deploy state).
  lastSyncedAt: string | null;
}
