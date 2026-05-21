export type MatchBaselineState =
  // 5+ games on this champion in this role — primary baseline
  | "full"
  // Fewer than 5 role-specific games; baseline uses all roles for this champion
  | "champion-only"
  // No games on this champion at all
  | "first-game";

export interface MatchBaseline {
  state: MatchBaselineState;
  /** How many games the metrics are computed from */
  sampleSize: number;
  /** Winsorized median KDA across sampled games; undefined when state is "first-game" */
  kda?: number;
  /** Winsorized median damage share (0.0–1.0); undefined when state is "first-game" */
  damageShare?: number;
  /** Winsorized median CS at 10 min; undefined when state is "first-game" */
  csAt10?: number;
  /** Winsorized median vision score; undefined when state is "first-game" */
  visionScore?: number;
}
