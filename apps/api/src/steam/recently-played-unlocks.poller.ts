import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { SteamOwnedGamesService } from "./owned-games.service";
import { SteamPlayerUnlocksService } from "./player-unlocks.service";
import { SteamClientService } from "./steam-client.service";
import { STEAM_OWNER_ID } from "./steam.config";

// Hourly backstop using `GetRecentlyPlayedGames` (≤10 rows, one Steam
// call). Covers two gaps:
//   1. Offline-play sessions the session-close hook missed entirely
//      (owner played offline; `personastate` never flipped to in-game).
//   2. Newly-owned games. If an appid appears here that we don't have in
//      `SteamOwnedGame` yet, the owner bought + launched a game between
//      daily owned-syncs — trigger a full `syncOwnedGames` proactively
//      so the on-add hooks (enrichment, schema, unlocks, rarity)
//      bootstrap immediately instead of waiting up to 24h.
//
// The session-close hook stays the primary realtime signal; this poller
// is a 1-hour reconciliation pass for the cases it doesn't catch.
@Injectable()
export class SteamRecentlyPlayedUnlocksPoller {
  private readonly logger = new Logger(SteamRecentlyPlayedUnlocksPoller.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SteamClientService,
    private readonly ownedGames: SteamOwnedGamesService,
    private readonly playerUnlocks: SteamPlayerUnlocksService
  ) {}

  @Cron("15 * * * *", {
    name: "steam-recently-played-unlocks",
    timeZone: "Europe/Brussels",
  })
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn("previous tick still running — skipping");
      return;
    }
    this.running = true;
    try {
      const recent = await this.client.getRecentlyPlayedGames(STEAM_OWNER_ID);
      const candidates = recent.filter(
        (g) => typeof g.playtime_2weeks === "number" && g.playtime_2weeks > 0
      );
      if (candidates.length === 0) return;

      // Detect previously-unknown appids and trigger a full owned-games
      // sync if any appear. The on-add hooks inside `syncOwnedGames` then
      // bootstrap schema/unlocks/rarity for the new entries, so the
      // per-appid refresh loop below will find populated meta rows. We
      // gate on `removedAt: null` so a re-acquired game (rare — uninstall
      // a freebie, claim it again) also triggers a resync.
      const appids = candidates.map((g) => g.appid);
      const knownRows = await this.prisma.steamOwnedGame.findMany({
        where: { appid: { in: appids }, removedAt: null },
        select: { appid: true },
      });
      const known = new Set(knownRows.map((r) => r.appid));
      const unknown = appids.filter((id) => !known.has(id));
      if (unknown.length > 0) {
        this.logger.log(
          `recently-played reports ${unknown.length} unknown appid(s) — triggering owned-games resync: ${unknown.join(", ")}`
        );
        try {
          await this.ownedGames.syncOwnedGames();
        } catch (err) {
          this.logger.warn(`proactive owned-games resync failed: ${err}`);
        }
      }

      // `refreshUnlocksForGame` already pre-checks `achievementCount > 0`,
      // so schema-less games (CS2, demos) short-circuit cleanly here —
      // no need to filter upstream.
      for (const appid of appids) {
        try {
          await this.playerUnlocks.refreshUnlocksForGame(appid);
        } catch (err) {
          this.logger.warn(
            `recently-played unlock refresh for appid=${appid} failed: ${err}`
          );
        }
      }
    } catch (err) {
      this.logger.warn(`recently-played backstop failed: ${err}`);
    } finally {
      this.running = false;
    }
  }
}
