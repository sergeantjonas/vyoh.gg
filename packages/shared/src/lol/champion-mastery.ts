// Riot's champion mastery for one champion on one account. It is Riot's
// lifetime counter, so it reaches back past the match history tracked here —
// the one number on the champion page that does.
export interface ChampionMastery {
  level: number;
  points: number;
  /** ISO timestamp of the last game Riot counted on this champion. */
  lastPlayedAt: string;
}

export interface ChampionMasteryResponse {
  /**
   * Null when the account has never played the champion, or when the champion
   * is not in the static sync yet.
   */
  mastery: ChampionMastery | null;
}
