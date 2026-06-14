export interface Duo {
  puuid: string;
  gameName: string;
  tagLine: string;
  games: number;
  wins: number;
  /** Most-frequent champion this duo plays. */
  topChampion: string;
  /**
   * Match IDs (within the duo-detection window) this duo played alongside the
   * user. Lets the match list flag rows played with a recurring duo without
   * shipping the full participant list on every match summary. Windowed to the
   * same recent-match scope as the rest of the duo aggregation.
   */
  matchIds: string[];
}
