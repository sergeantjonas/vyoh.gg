/** Owner's participation in one neutral-objective type across recent games.
 *  `takedowns` is how many of the team's kills of this objective the owner got
 *  kill-or-assist credit on (Riot challenges `dragonTakedowns` / `baronTakedowns`
 *  / `riftHeraldTakedowns`); `teamKills` is the team's total kills of it (the
 *  denominator). `takedowns / teamKills` is the participation rate — the op.gg
 *  "objective participation" metric. `games` counts sampled games where the team
 *  killed this objective at least once (the rate's effective sample). */
export interface ObjectiveParticipationTally {
  takedowns: number;
  teamKills: number;
  games: number;
}

export interface ObjectiveParticipation {
  /** Non-remake Summoner's Rift games sampled (owner had a team position). */
  games: number;
  dragons: ObjectiveParticipationTally;
  barons: ObjectiveParticipationTally;
  heralds: ObjectiveParticipationTally;
}
