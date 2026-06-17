/** A single "first objective" tally across the owner's recent games: how many
 *  games the owner (or their team) drew the objective first, and how many of
 *  those were wins. `count / games` is the rate; `wins / count` is the win rate
 *  in games where it happened. */
export interface ObjectiveFirstTally {
  count: number;
  wins: number;
}

export interface ObjectiveFirsts {
  /** Non-remake games sampled. */
  games: number;
  /** Owner personally landed first blood (participant `firstBloodKill`). */
  firstBlood: ObjectiveFirstTally;
  /** Owner's team took the first tower (team objective `tower.first`). */
  firstTower: ObjectiveFirstTally;
}
