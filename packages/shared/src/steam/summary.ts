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
  // Equipped profile cosmetics from IPlayerService/GetProfileItemsEquipped/v1/.
  // All optional — accounts on the default profile have nothing equipped, and a
  // failure on the items call leaves these undefined so the summary still resolves
  // with the player payload.
  //
  // `animatedAvatarUrl` is the canonical animated form (a .gif Steam serves at
  // `image_small`, name notwithstanding — refers to display size, not file size).
  // `profileBackgroundUrl` is the static still; `profileBackgroundVideoUrl` is
  // present only for animated backgrounds and lets the frontend opt into the
  // video form per surface (heavy on every page load, so callers decide).
  animatedAvatarUrl?: string;
  profileBackgroundUrl?: string;
  profileBackgroundVideoUrl?: string;
  personaState:
    | "offline"
    | "online"
    | "busy"
    | "away"
    | "snooze"
    | "looking-to-trade"
    | "looking-to-play";
  currentGame: SteamCurrentGame | null;
  // Account-creation epoch (seconds), for the "member since {year}" headline.
  // Optional — privacy-locked profiles omit `timecreated` upstream.
  memberSinceUnix?: number;
  // Steam community level (e.g. 14). Optional — the level call can fail or be
  // privacy-locked without blocking the rest of the summary.
  steamLevel?: number;
  // Percentile of accounts at or below `steamLevel` (e.g. 94.66 ⇒ "higher than
  // ~95%"). Only meaningful alongside `steamLevel`; both come from separate
  // optional calls, so either may be absent.
  steamLevelPercentile?: number;
  privacyPrereqs: SteamPrivacyPrereqs;
}
