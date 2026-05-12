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
  // Rift-coord positions (0–15000 game space, Y not flipped) parallel to
  // deathTimings, plus matched kill-side arrays. Empty when the timeline
  // hasn't been projected yet (D.1 backfill / pre-D.1 rows).
  deathXs: number[];
  deathYs: number[];
  killTimings: number[];
  killXs: number[];
  killYs: number[];
  snapshotTier?: string;
  snapshotRank?: string;
  snapshotLp?: number;
  // LP/tier/rank state captured BEFORE the match was played. Lets per-match
  // delta = norm(after) - norm(before), so decay between matches doesn't
  // poison the next match's gain/loss.
  snapshotTierBefore?: string;
  snapshotRankBefore?: string;
  snapshotLpBefore?: number;
  laneOpponent: {
    puuid: string;
    championName: string;
    gameName: string;
    tagLine: string;
  } | null;
}
