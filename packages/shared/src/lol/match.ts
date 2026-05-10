export interface MatchSummary {
  matchId: string;
  queueType: string;
  champion: string;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  durationSec: number;
  playedAt: string;
  remake: boolean;
  teamPosition: string;
  gameVersion: string;
  visionScore: number;
  damageShare: number;
  firstBloodKill: boolean;
  // Timeline-derived fields. 0 / empty when the timeline hasn't been
  // projected yet (historical matches before the eager-fetch wiring).
  csAt10: number;
  csAt15: number;
  goldAt10: number;
  goldAt15: number;
  teamGoldDiffAt15: number;
  deathTimings: number[];
  snapshotTier?: string;
  snapshotRank?: string;
  snapshotLp?: number;
  laneOpponent: {
    puuid: string;
    championName: string;
    gameName: string;
    tagLine: string;
  } | null;
}
