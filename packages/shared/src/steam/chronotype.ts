export interface SteamChronotypeHour {
  /** Hour of day, 0..23, in the response `timeZone`. */
  hour: number;
  count: number;
}

export interface SteamChronotype {
  /** Always length 24, sorted 0..23. */
  hours: SteamChronotypeHour[];
  totalCount: number;
  /** IANA timezone used to bucket hours. */
  timeZone: string;
}
