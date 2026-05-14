export interface ChronotypeHour {
  /** Hour of day, 0..23, in the response `timezone`. */
  hour: number;
  games: number;
  wins: number;
}

export interface Chronotype {
  /** Always length 24, sorted 0..23. */
  hours: ChronotypeHour[];
  totalGames: number;
  totalWins: number;
  /** IANA timezone used to bucket hours. */
  timezone: string;
}
