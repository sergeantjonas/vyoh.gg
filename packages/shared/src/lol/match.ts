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
  snapshotTier?: string;
  snapshotRank?: string;
  snapshotLp?: number;
}
