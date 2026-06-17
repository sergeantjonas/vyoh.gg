export interface ChampionRuneDiversityEntry {
  /** Keystone perk id (e.g. 8005 Press the Attack). Resolved to name/icon on the client. */
  keystoneId: number;
  games: number;
  wins: number;
}
