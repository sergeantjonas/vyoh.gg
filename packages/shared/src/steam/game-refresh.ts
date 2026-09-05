// Result of the owner's per-game "fetch now": POST /steam/game/:appid/refresh.
//
// Unlike the status-page triggers, the route awaits the work — five Steam calls,
// a few seconds — so the response can say what changed rather than only that a
// run began. `ran: false` is the same refusal the status triggers report when
// the job is already in flight; there is one job for every appid, so a second
// click on any game is refused while one refresh runs.

export interface SteamGameRefreshLegs {
  // Achievement schema (GetSchemaForGame). `achievementCount` is the count the
  // meta row holds after the leg — null when the schema fetch has never landed.
  schema: { achievementCount: number | null; failed: boolean };
  // Owner unlocks (GetPlayerAchievements). `statsPrivate` is Steam's per-app
  // refusal for a game marked private in the library; the leg is not a failure
  // in that case, it is the answer.
  unlocks: { newUnlocks: number; statsPrivate: boolean; failed: boolean };
  // Global rarity rows rewritten (GetGlobalAchievementPercentagesForApp).
  rarity: { rowsWritten: number; failed: boolean };
  // Store enrichment (GetItems + a PICS logon for the logo).
  enrichment: { written: boolean; failed: boolean };
  // Steam has no per-game playtime call: this leg is one whole-library
  // GetOwnedGames snapshot, and the numbers are this game's minutes before and
  // after it. Either is null when no snapshot names the game.
  playtime: {
    beforeMinutes: number | null;
    afterMinutes: number | null;
    failed: boolean;
  };
}

export interface SteamGameRefreshRun {
  ran: true;
  appid: number;
  startedAt: string;
  durationMs: number;
  legs: SteamGameRefreshLegs;
}

export type SteamGameRefreshResult =
  | SteamGameRefreshRun
  | { ran: false; reason: "already running" };
