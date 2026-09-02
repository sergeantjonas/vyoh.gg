// Response of the owner-only `POST …/matches/sync`: how many match ids the
// Riot list call returned and how many of those were fetched and stored.
export interface MatchSyncResult {
  idCount: number;
  backfilled: number;
}
