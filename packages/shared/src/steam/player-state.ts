import type { SteamCurrentGame } from "./summary.ts";

// Live owner presence — persisted snapshot of GetPlayerSummaries, refreshed
// every 2 min by the player-state poller. The frontend can poll this on a
// short stale-time (30–60s) without hitting Steam directly.
//
// `currentGame` is the same shape used by SteamSummary; null when the owner
// isn't in-game. `lastPolledAt` lets surfaces show "last seen N min ago"
// instead of pretending real-time when the poller is paused.
export interface SteamPlayerState {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  personaState:
    | "offline"
    | "online"
    | "busy"
    | "away"
    | "snooze"
    | "looking-to-trade"
    | "looking-to-play";
  // 1 = private, 2 = friends-only, 3 = public. Mirrors
  // `communityvisibilitystate` so a future "presence is private" surface can
  // tell the difference between "offline" and "the owner has locked their
  // profile so we can't tell either way".
  profileVisibility: 1 | 2 | 3;
  currentGame: SteamCurrentGame | null;
  // Lifetime playtime for the in-game appid in minutes — denormalized off
  // the latest SteamPlaytimeSnapshot so the Now-playing surface can render
  // "Xh lifetime" without a separate owned-games fetch. Null when not
  // in-game, when the owner is playing a non-owned title (family-share,
  // demo), or when the daily playtime poller hasn't snapshotted the game
  // yet on a fresh deploy.
  currentGamePlaytimeForeverMinutes: number | null;
  lastPolledAt: string;
}
