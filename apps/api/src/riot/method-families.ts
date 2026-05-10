export type MethodFamily =
  | "account-by-riot-id"
  | "match-ids-by-puuid"
  | "match-by-id"
  | "match-timeline-by-id"
  | "league-entries-by-puuid"
  | "summoner-by-puuid"
  | "active-game-by-puuid"
  | "champion-mastery-by-champion";

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
  "champion-mastery-by-champion": { reservoir: 1000, intervalMs: 60_000 },
};
