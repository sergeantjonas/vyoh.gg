/**
 * Cross-stream "minutes-by-hour-of-day, split by stream" surface for `/`.
 * LoL minutes come from `Match.playedAt` + `durationSec`; Steam minutes come
 * from closed `SteamPlaySession` rows. Intervals crossing hour boundaries are
 * split proportionally — a 70-minute block from 21:50 to 23:00 contributes
 * 10 min to 21h and 60 min to 22h.
 */
export interface HomeDaySplitHour {
  /** Hour of day, 0..23, in the response `timeZone`. */
  hour: number;
  lolMinutes: number;
  steamMinutes: number;
}

export interface HomeDaySplit {
  /** Always length 24, sorted 0..23. */
  hours: HomeDaySplitHour[];
  totalLolMinutes: number;
  totalSteamMinutes: number;
  /** IANA timezone used to bucket hours. */
  timeZone: string;
}
