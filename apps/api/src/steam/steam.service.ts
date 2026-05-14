import { Injectable } from "@nestjs/common";
import type { SteamSummary } from "@vyoh/shared";
import { SteamClientService } from "./steam-client.service";
import { STEAM_OWNER_ID } from "./steam.config";
import type { SteamPlayerRaw } from "./types";

const PERSONA_STATE: Record<
  SteamPlayerRaw["personastate"],
  SteamSummary["personaState"]
> = {
  0: "offline",
  1: "online",
  2: "busy",
  3: "away",
  4: "snooze",
  5: "looking-to-trade",
  6: "looking-to-play",
};

@Injectable()
export class SteamService {
  constructor(private readonly client: SteamClientService) {}

  async getOwnerSummary(): Promise<SteamSummary> {
    const player = await this.client.getPlayerSummary(STEAM_OWNER_ID);
    if (!player) {
      // GetPlayerSummaries returns an empty players array only when the SteamID
      // does not resolve at all — wrong ID, deleted account. Distinct from
      // privacy-locked, which still returns a player with communityvisibilitystate < 3.
      throw new Error(`Steam profile not found for owner id ${STEAM_OWNER_ID}`);
    }
    return mapPlayerToSummary(player);
  }
}

function mapPlayerToSummary(player: SteamPlayerRaw): SteamSummary {
  const profilePublic = player.communityvisibilitystate === 3;
  // Game-details visibility can't be verified from GetPlayerSummaries — that
  // probe requires GetOwnedGames, which lands in S3. Surface "unknown" rather
  // than guessing so the frontend can render honest copy.
  const currentGame =
    player.gameid !== undefined
      ? { appid: Number(player.gameid), name: player.gameextrainfo ?? "" }
      : null;

  return {
    steamId: player.steamid,
    personaName: player.personaname,
    profileUrl: player.profileurl,
    avatarUrl: player.avatarfull,
    personaState: PERSONA_STATE[player.personastate],
    currentGame,
    privacyPrereqs: {
      profilePublic,
      gameDetailsPublic: "unknown",
    },
  };
}
