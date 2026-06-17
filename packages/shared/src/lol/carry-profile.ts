/** Win/loss split by where the owner ranked in their own team's champion damage.
 *  Neutral framing: a high-damage role isn't "better" than a low-damage one —
 *  the split just shows how results track with the owner's damage contribution. */
export interface CarryProfileSplit {
  games: number;
  wins: number;
}

export interface CarryProfile {
  /** Non-remake games sampled where the owner's team had a full roster. */
  games: number;
  /** Games where the owner ranked top-3 in their team's champion damage. */
  topThree: CarryProfileSplit;
  /** Games where the owner ranked bottom-2 in their team's champion damage. */
  bottomTwo: CarryProfileSplit;
}
