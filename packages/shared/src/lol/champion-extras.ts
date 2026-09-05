import type { ChampionDetailStats } from "./champion-detail-stats.ts";
import type { TrendSummary } from "./trend-summary.ts";

export interface ItemStats {
  itemId: number;
  games: number;
  wins: number;
}

export interface MatchupStats {
  champion: string;
  games: number;
  wins: number;
}

export interface ChampionExtras {
  topItems: ItemStats[];
  matchups: MatchupStats[];
  // The aggregates the champion panel's body renders from, computed over the
  // same match window and queue filter the client applies to its own copy.
  // The client prefers its window when it has one (the champion table shares
  // it) and falls back to these — a server render never has the window, at
  // 361 kB it must not be primed, and these are what let the panel body reach
  // the document anyway. `detail` is null when the champion has no matches in
  // the window.
  detail: ChampionDetailStats | null;
  overall: TrendSummary;
}
