/** One member of a recurring squad — a teammate of the owner, not the owner. */
export interface SquadMember {
  puuid: string;
  gameName: string;
  tagLine: string;
  /** Most-frequent champion this member plays while the squad is together. */
  topChampion: string;
}

/**
 * A recurring group the owner queues with: a set of 2–4 teammates that show up
 * on the owner's team across multiple matches. The owner is implicit and not
 * listed, so `members.length` of 2 is a 3-stack, 3 a 4-stack, 4 a full 5-stack.
 *
 * Detection extends duo detection: instead of bucketing single teammates by
 * puuid, it buckets recurring teammate *sets* and reuses the same temporal
 * clustering gate (a premade plays back-to-back; random matchmaking repeats
 * scatter in time). Subgroups fully explained by a larger recurring group are
 * dropped, so the surface shows the real stacks, not every sub-combination.
 */
export interface Squad {
  members: SquadMember[];
  /** Total stack size including the owner (`members.length + 1`). */
  size: number;
  games: number;
  wins: number;
  /**
   * Match IDs (within the detection window) the full squad played together,
   * newest-first. Same windowing as {@link Duo} detection.
   */
  matchIds: string[];
}
