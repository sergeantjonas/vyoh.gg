import type { MatchSummary } from "./match.ts";

export interface CachedMatchesResult {
  matches: MatchSummary[];
  total: number;
}
