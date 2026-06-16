import type { ChampionPair } from "./champion-pair.ts";

export interface Duo {
  puuid: string;
  gameName: string;
  tagLine: string;
  games: number;
  wins: number;
  /** Most-frequent champion this duo plays. */
  topChampion: string;
  /**
   * Champion pairings this duo ran with the owner (owner's champ in
   * {@link ChampionPair.yourChamp}, the duo's champ in `teammateChamp`),
   * ranked by games together and truncated to the top few. Distinct from the
   * global champion-synergy surface: scoped to this one recurring partner, so
   * it answers "what do we two actually play together, and does it work" rather
   * than "which champ pairs well with my Ahri across anyone".
   */
  championPairs: ChampionPair[];
  /**
   * Match IDs (within the duo-detection window) this duo played alongside the
   * user. Lets the match list flag rows played with a recurring duo without
   * shipping the full participant list on every match summary. Windowed to the
   * same recent-match scope as the rest of the duo aggregation.
   */
  matchIds: string[];
}
