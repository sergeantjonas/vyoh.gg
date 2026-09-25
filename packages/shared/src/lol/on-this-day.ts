// The account's games on today's calendar date in earlier years, one entry per
// year that has any. "Today" is the owner's Brussels day, fixed by the api when
// it answers, so nothing on the page reads the clock to render it.
export interface OnThisDayGame {
  matchId: string;
  champion: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
}

export interface OnThisDayYear {
  /** 1 for a year ago. */
  yearsAgo: number;
  /** Brussels calendar date the games were played, `YYYY-MM-DD`. */
  date: string;
  /**
   * False when that year had nothing on the exact date and the nearest day
   * within `ON_THIS_DAY_WINDOW_DAYS` stood in for it.
   */
  exact: boolean;
  games: number;
  wins: number;
  /** The champion played most that day. */
  topChampion: string;
  /** The day's best game: its best-KDA win, or its best KDA when it had none. */
  headline: OnThisDayGame;
}

export interface OnThisDay {
  /** Most recent year first; empty when no earlier year has games near the date. */
  years: OnThisDayYear[];
}

export const ON_THIS_DAY_WINDOW_DAYS = 3;
