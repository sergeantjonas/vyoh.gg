// Single hardcoded owner per the Steam integration account model (steam-integration.md).
// Not env-driven: the SteamID64 is already public via the owner's profile URL, but the
// constant lives server-side so the client bundle never carries it.
export const STEAM_OWNER_ID = "76561198020053778" as const;
