export interface GameUnlockTimeline {
  // ISO-8601 timestamps in ascending order. One entry per achievement unlock.
  // The chip detects sessions client-side via inter-unlock gaps — monthly
  // bucketing on the server side hid within-month session structure.
  unlocks: string[];
  total: number;
  // Schema-defined achievement count for the game; null when the schema
  // hasn't been ingested yet (new game, first-deploy edge case) or when the
  // game has no achievements at all. The chip uses this to detect 100%
  // completion (unlocks.length >= achievementCount && achievementCount > 0).
  achievementCount: number | null;
}
