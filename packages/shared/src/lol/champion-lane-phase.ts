/** One lane-phase metric, aggregated across the owner's games on a champion as
 *  the average owner-minus-laneOpponent differential, plus how often the owner
 *  came out ahead (diff > 0). A positive `diff` means the owner out-paced their
 *  direct lane opponent on that metric on average. */
export interface LanePhaseMetric {
  /** Average (owner − lane opponent) differential across sampled games. */
  diff: number;
  /** Fraction of sampled games where the owner's differential was positive (0–1). */
  aheadRate: number;
}

export interface ChampionLanePhase {
  /** Games on the champion with a usable lane opponent + 10-min timeline frame. */
  sampleSize: number;
  /** Creep score (lane minions + jungle) at 10 minutes. */
  csAt10: LanePhaseMetric;
  /** Creep score at 15 minutes. */
  csAt15: LanePhaseMetric;
  /** Total gold at 10 minutes. */
  goldAt10: LanePhaseMetric;
}
