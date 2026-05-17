export interface HomeWeeklyTotals {
  /** LoL matches played within the window (remakes excluded). */
  lolMatchCount: number;
  /** Sum of LoL match durations within the window, in minutes. Remakes excluded. */
  lolMinutes: number;
  /**
   * Sum of per-appid playtime deltas within the window, in minutes. Computed
   * from `SteamPlaytimeSnapshot`: latest snapshot minus the latest snapshot at
   * or before `weekStart`. Appids without a snapshot at-or-before `weekStart`
   * are excluded — their baseline is unknown.
   */
  steamMinutes: number;
  /** `lolMinutes + steamMinutes`. */
  totalMinutes: number;
  /** ISO start of the rolling window (now − 7 days). */
  weekStart: string;
  /** ISO end of the rolling window (now). */
  weekEnd: string;
  /** IANA timezone used to label the window. */
  timeZone: string;
}
