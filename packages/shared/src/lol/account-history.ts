// How far back the tracked history for one account reaches. Remakes are left
// out of both halves, and every queue counts: this is the account's own story,
// not a performance read.
export interface AccountFirstGame {
  matchId: string;
  playedAt: string;
  champion: string;
  queueId: number;
  win: boolean;
}

export interface AccountHistory {
  totalGames: number;
  /** Null when the account has no tracked games yet. */
  firstGame: AccountFirstGame | null;
}
