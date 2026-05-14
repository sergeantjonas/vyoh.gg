export interface SteamCurrentGame {
  appid: number;
  name: string;
}

// `profilePublic` is verifiable from GetPlayerSummaries (communityvisibilitystate === 3).
// `gameDetailsPublic` requires a probe of GetOwnedGames, which lands in S3 — until
// then we surface "unknown" rather than guessing, so the frontend can render
// honest "we can't tell yet" copy instead of false certainty.
export interface SteamPrivacyPrereqs {
  profilePublic: boolean;
  gameDetailsPublic: boolean | "unknown";
}

export interface SteamSummary {
  steamId: string;
  personaName: string;
  profileUrl: string;
  avatarUrl: string;
  personaState:
    | "offline"
    | "online"
    | "busy"
    | "away"
    | "snooze"
    | "looking-to-trade"
    | "looking-to-play";
  currentGame: SteamCurrentGame | null;
  privacyPrereqs: SteamPrivacyPrereqs;
}
