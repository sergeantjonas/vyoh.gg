/** One champion's record across the owner's sampled ARAM games. */
export interface AramChampionTally {
  /** Riot champion alias (render via `useChampionName()` — never raw). */
  championName: string;
  games: number;
  wins: number;
}

/** Aggregate of the owner's recent non-remake ARAM games — a queue-isolated
 *  dashboard for the most-played mode, which the serious-queues surfaces exclude
 *  by design. Sums (not averages) are returned so the web derives rates/means at
 *  the display site and the DTO stays integer-exact for tests. The sustain/tank
 *  fields come from the owner's full participant in MatchDetailCache. Note:
 *  "healing taken" (healing received from allies) isn't a Match-V5 field, so
 *  sustain is expressed via heal+shield-delivered + damage-taken instead. */
export interface AramProfile {
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  /** Σ effective healing + shielding delivered to allies (challenges field). */
  healAndShield: number;
  /** Σ total damage taken. */
  damageTaken: number;
  /** Σ damage self-mitigated. */
  selfMitigated: number;
  /** Σ damage dealt to champions. */
  damageToChampions: number;
  /** Most-played ARAM champions, desc by games, capped. */
  topChampions: AramChampionTally[];
}
