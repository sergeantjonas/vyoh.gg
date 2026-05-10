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
