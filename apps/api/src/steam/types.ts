// Raw shapes from the Steam Web API. Mirrors the role of riot/types.ts: server-only
// types for upstream payloads. Public shapes live in packages/shared/src/steam/.

export interface SteamPlayerRaw {
  steamid: string;
  // 1 = private, 2 = friends-only, 3 = public. Anything < 3 means the profile
  // is locked and downstream fields will be sparse.
  communityvisibilitystate: 1 | 2 | 3;
  // 0 = not configured (no display name set yet), 1 = configured.
  profilestate: 0 | 1;
  personaname: string;
  profileurl: string;
  avatarfull: string;
  // 0 offline, 1 online, 2 busy, 3 away, 4 snooze, 5 looking-to-trade, 6 looking-to-play.
  personastate: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  // Present only while in-game.
  gameid?: string;
  gameextrainfo?: string;
}

export interface SteamGetPlayerSummariesResponse {
  response: {
    players: SteamPlayerRaw[];
  };
}
