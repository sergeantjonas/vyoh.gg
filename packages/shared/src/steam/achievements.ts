// Per-game achievement panel payload — schema + owner unlock state + global
// rarity, in one shot. Returned by GET /api/steam/game/:appid/achievements.
//
// Spoiler masking is the frontend's job, not the API's: the server returns
// the real `displayName` and `description` along with the `hidden` flag, and
// the panel renders `???` only when `hidden === true && unlockedAt === null`.
// Once unlocked, hidden achievements reveal fully — the spoiler is moot.
// Keeping the server honest lets other surfaces (Profile recent-unlocks,
// global page) reuse the same payload with surface-specific masking rules.

export interface SteamAchievement {
  apiName: string;
  displayName: string;
  description: string;
  iconUrl: string;
  iconGrayUrl: string;
  hidden: boolean;
  // ISO-8601 unlock timestamp (Steam's `unlocktime`), or null when locked.
  unlockedAt: string | null;
  // 0..100 global unlock percentage from
  // GetGlobalAchievementPercentagesForApp, or null when the weekly poll
  // hasn't covered this achievement yet (newly-added game's first hours).
  globalPercent: number | null;
}

export interface SteamGameAchievements {
  appid: number;
  // Null when the game has no achievement schema (CS2, demos, schema-less
  // titles) — frontend hides the panel section entirely. Empty array means
  // a schema exists but no rows have been ingested yet (first-deploy edge
  // case before the schema poller has run for this appid).
  achievements: SteamAchievement[] | null;
  // Bookkeeping timestamps for UI freshness display. Null when the
  // respective poller has never run for this game.
  lastSchemaCheckedAt: string | null;
  lastUnlocksCheckedAt: string | null;
  lastRarityCheckedAt: string | null;
}

// Cross-game recent-unlocks feed. Returned by
// GET /api/steam/achievements/recent?limit=N. Ordered by unlockedAt
// descending. All entries are unlocked by definition, so unlockedAt is
// non-nullable here (distinct from SteamAchievement, where locked rows
// carry null).
//
// Hidden flag is informational only — once unlocked, the name + icon
// reveal fully (Steam's own client behaves the same way).
export interface SteamRecentUnlock {
  appid: number;
  gameName: string;
  apiName: string;
  displayName: string;
  iconUrl: string;
  hidden: boolean;
  unlockedAt: string;
  globalPercent: number | null;
}

export interface SteamRecentUnlocks {
  unlocks: SteamRecentUnlock[];
}
