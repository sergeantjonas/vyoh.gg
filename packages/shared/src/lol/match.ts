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
  // Explicit "this row has timeline-derived metrics" flag. csAt10 alone is no
  // longer a reliable sentinel: PN3 seeds csAt10 from
  // challenges.laneMinionsFirst10Minutes for matches that never had a timeline
  // fetched. Use `hasTimeline` for any "do we have timeline data" check.
  // Optional so older cached MatchSummary rows in client-side caches keep
  // typechecking (undefined → falsy → same as the new false default).
  hasTimeline?: boolean;
  // Timeline-derived fields. 0 / empty when the timeline hasn't been
  // projected yet (historical matches before the eager-fetch wiring).
  // Note: csAt10 may be non-zero without a timeline (PN3 backfill from
  // owner challenge `laneMinionsFirst10Minutes`); the other fields here
  // remain strictly timeline-sourced.
  csAt10: number;
  csAt15: number;
  goldAt10: number;
  goldAt15: number;
  teamGoldDiffAt15: number;
  // Per-minute team-gold-diff across every frame in the match (user-team
  // minus enemy-team), oldest first. Drives the match-row gold-lead
  // sparkline. Empty for matches whose timeline hasn't been projected yet
  // (pre-backfill rows or remakes without a 15-min frame).
  teamGoldDiffSeries: number[];
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
