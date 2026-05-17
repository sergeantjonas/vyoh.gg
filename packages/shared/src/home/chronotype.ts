export interface HomeChronotypeHour {
  /** Hour of day, 0..23, in the response `timeZone`. */
  hour: number;
  /** lol + steam — convenience for the "Both" view. */
  total: number;
  lol: number;
  steam: number;
}

export interface HomeChronotype {
  /** Always length 24, sorted 0..23. */
  hours: HomeChronotypeHour[];
  totalLolCount: number;
  totalSteamCount: number;
  /** IANA timezone used to bucket hours. */
  timeZone: string;
}
