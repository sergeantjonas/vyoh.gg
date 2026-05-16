import { Injectable, Logger } from "@nestjs/common";
import type { SteamPlayerState } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SteamClientService } from "./steam-client.service";
import { STEAM_OWNER_ID } from "./steam.config";
import type { SteamPlayerRaw } from "./types";

// Same mapping as SteamService.mapPlayerToSummary. Duplicated rather than
// shared because the persisted state row is the canonical home for the
// normalized string going forward — once chunk 4 wires session events,
// surfaces should read from this table, not re-derive on each /summary call.
const PERSONA_STATE: Record<
  SteamPlayerRaw["personastate"],
  SteamPlayerState["personaState"]
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
export class SteamPlayerStateService {
  private readonly logger = new Logger(SteamPlayerStateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SteamClientService
  ) {}

  // Single GetPlayerSummaries call → upsert. Shared by the cron tick and the
  // boot backfill so a fresh deploy doesn't sit with a missing state row
  // until the first 2-min tick fires (the frontend chip 404s in the gap).
  async syncPlayerState(): Promise<void> {
    const player = await this.client.getPlayerSummary(STEAM_OWNER_ID);
    if (!player) {
      this.logger.warn(`GetPlayerSummaries returned no player for ${STEAM_OWNER_ID}`);
      return;
    }
    // `gameid` is a string in the Steam API (consistent with other 64-bit
    // ids), but `appid` fits comfortably in an int32 — parsing here keeps
    // the column an Int.
    const currentAppid = player.gameid ? Number.parseInt(player.gameid, 10) : null;
    const currentGameName = player.gameextrainfo ?? null;
    const personaState = PERSONA_STATE[player.personastate];

    await this.prisma.steamPlayerState.upsert({
      where: { steamId: player.steamid },
      create: {
        steamId: player.steamid,
        personaName: player.personaname,
        avatarUrl: player.avatarfull,
        personaState,
        profileVisibility: player.communityvisibilitystate,
        currentAppid,
        currentGameName,
      },
      update: {
        personaName: player.personaname,
        avatarUrl: player.avatarfull,
        personaState,
        profileVisibility: player.communityvisibilitystate,
        currentAppid,
        currentGameName,
        lastPolledAt: new Date(),
      },
    });
  }

  // Null only between fresh-DB boot and the first successful sync — boot
  // backfill should close that gap in practice. Controller translates null
  // to a 404 so the frontend can render its loading state.
  async getPlayerState(): Promise<SteamPlayerState | null> {
    const row = await this.prisma.steamPlayerState.findUnique({
      where: { steamId: STEAM_OWNER_ID },
    });
    if (!row) return null;

    // Join the latest playtime snapshot for the in-game appid so the
    // "Now playing" surface can render "Xh lifetime" without forcing the
    // frontend to fetch the entire owned-games list. Null path covers
    // three real cases: not in-game, non-owned title (family-share /
    // demo / pirate), and fresh-DB owned games the daily snapshotter
    // hasn't touched yet.
    let currentGamePlaytimeForeverMinutes: number | null = null;
    if (row.currentAppid !== null) {
      const snapshot = await this.prisma.steamPlaytimeSnapshot.findFirst({
        where: { appid: row.currentAppid },
        orderBy: { snapshotDate: "desc" },
        select: { playtimeForeverMinutes: true },
      });
      if (snapshot) currentGamePlaytimeForeverMinutes = snapshot.playtimeForeverMinutes;
    }

    return {
      steamId: row.steamId,
      personaName: row.personaName,
      avatarUrl: row.avatarUrl,
      personaState: row.personaState as SteamPlayerState["personaState"],
      profileVisibility: row.profileVisibility as 1 | 2 | 3,
      currentGame:
        row.currentAppid !== null
          ? {
              appid: row.currentAppid,
              name: row.currentGameName ?? `App ${row.currentAppid}`,
            }
          : null,
      currentGamePlaytimeForeverMinutes,
      lastPolledAt: row.lastPolledAt.toISOString(),
    };
  }
}
