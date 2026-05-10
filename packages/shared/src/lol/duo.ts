export interface Duo {
  puuid: string;
  gameName: string;
  tagLine: string;
  games: number;
  wins: number;
  /** Most-frequent champion this duo plays. */
  topChampion: string;
}
