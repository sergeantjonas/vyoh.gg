import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { OWNER_TIME_ZONE } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SyncJobRegistry } from "../sync-jobs/sync-job-registry.service";
import { SYNC_JOBS } from "../sync-jobs/sync-jobs.catalog";
import { SteamAchievementSchemaService } from "./achievement-schema.service";
import { SteamOwnedGamesService } from "./owned-games.service";
import { SteamPlayerUnlocksService } from "./player-unlocks.service";
import { SteamClientService } from "./steam-client.service";
import { STEAM_OWNER_ID } from "./steam.config";

// Hourly backstop using `GetRecentlyPlayedGames` (≤10 rows, one Steam
// call). Covers three gaps:
//   1. Offline-play sessions the session-close hook missed entirely
//      (owner played offline; `personastate` never flipped to in-game).
//   2. Newly-owned games. If an appid appears here that we don't have in
//      `SteamOwnedGame` yet, the owner bought + launched a game between
//      daily owned-syncs — trigger a full `syncOwnedGames` proactively
//      so the on-add hooks (enrichment, schema, unlocks, rarity)
//      bootstrap immediately instead of waiting up to 24h.
//   3. Games whose achievement schema was empty when we first checked and
//      has since been published (see the re-check below).
//
// The session-close hook stays the primary realtime signal; this poller
// is a 1-hour reconciliation pass for the cases it doesn't catch.

// How long a recorded `achievementCount` of zero is trusted for a game the
// owner is actively playing. One day keeps permanently schema-less titles
// (CS2, demos, Dota 2) at one wasted call per day rather than one per tick.
const ZERO_SCHEMA_RECHECK_MS = 24 * 60 * 60 * 1000;

const JOB = "steam-recently-played-unlocks";

@Injectable()
export class SteamRecentlyPlayedUnlocksPoller {
  private readonly logger = new Logger(SteamRecentlyPlayedUnlocksPoller.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SteamClientService,
    private readonly ownedGames: SteamOwnedGamesService,
    private readonly playerUnlocks: SteamPlayerUnlocksService,
    private readonly achievementSchema: SteamAchievementSchemaService,
    private readonly jobs: SyncJobRegistry
  ) {}

  @Cron(SYNC_JOBS[JOB].cron, { name: JOB, timeZone: OWNER_TIME_ZONE })
  async tick(): Promise<void> {
    await this.jobs.run(JOB, () => this.backstop());
  }

  private async backstop(): Promise<void> {
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

    // A zero `achievementCount` is a self-sealing dead end: every unlock
    // path gates on `> 0`, so once we record a zero nothing fetches
    // unlocks for that game again, and the boot backfill skips it because
    // a meta row exists. Only the weekly schema cron re-evaluates it. That
    // is too slow for the case that produces it — a game bought before
    // release publishes its achievements days after we recorded the zero,
    // and by then the owner is already earning them. Re-check the ones
    // showing up in recently-played, so the refresh below sees the real
    // count in this same tick.
    const cutoff = new Date(Date.now() - ZERO_SCHEMA_RECHECK_MS);
    const stale = await this.prisma.steamGameAchievementMeta.findMany({
      where: {
        appid: { in: appids },
        AND: [
          { OR: [{ achievementCount: 0 }, { achievementCount: null }] },
          {
            OR: [{ lastSchemaCheckedAt: null }, { lastSchemaCheckedAt: { lt: cutoff } }],
          },
        ],
      },
      select: { appid: true },
    });
    if (stale.length > 0) {
      try {
        await this.achievementSchema.refreshSchemas(stale.map((r) => r.appid));
      } catch (err) {
        this.logger.warn(`empty-schema re-check failed: ${err}`);
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
  }
}
