import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { SteamAchievementSchemaService } from "./achievement-schema.service";

// Per-game achievement schemas rarely change — monthly refresh is plenty.
// Anchored to 05:00 Europe/Brussels on the 1st so it lands 30 minutes after
// the enrichment cron and an hour after the daily owned-games poll, with no
// window overlap.
//
// On-add coverage comes from the syncOwnedGames diff hook (see
// owned-games.service.ts). On-boot backfill targets owned games that have
// never been checked (no meta row yet) so a fresh deploy doesn't sit with
// missing schemas until the monthly tick.
@Injectable()
export class SteamAchievementSchemaPoller implements OnModuleInit {
  private readonly logger = new Logger(SteamAchievementSchemaPoller.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly service: SteamAchievementSchemaService
  ) {}

  async onModuleInit(): Promise<void> {
    // Backfill games that have never had a schema check (no meta row). Games
    // with an existing meta row — even count=0 — are left for the monthly
    // tick to re-evaluate, keeping boot fast and self-healing.
    const unchecked = await this.prisma.steamOwnedGame.findMany({
      where: { removedAt: null, achievementMeta: null },
      select: { appid: true },
    });
    if (unchecked.length === 0) return;
    this.logger.log(
      `backfilling ${unchecked.length} unchecked achievement schemas at boot`
    );
    try {
      await this.service.refreshSchemas(unchecked.map((g) => g.appid));
    } catch (err) {
      // Boot must not block on Steam — log and move on. Next month's cron
      // (or the on-add hook for incremental additions) will reconcile.
      this.logger.warn(`boot backfill failed: ${err}`);
    }
  }

  // Weekly Sunday 05:00. Was monthly — bumped 2026-05-15 to pick up
  // publisher-side string changes (achievement renames, description edits)
  // faster. The on-add hook already covers new games immediately; this
  // cron only catches drift on existing schemas, which is rare. ~25
  // calls/day amortized (175 owned games / 7 days). Lands 30 min before
  // the rarity cron on the same day for a contained Sunday-morning batch.
  @Cron("0 5 * * 0", {
    name: "steam-achievement-schema",
    timeZone: "Europe/Brussels",
  })
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn("previous tick still running — skipping");
      return;
    }
    this.running = true;
    try {
      // Re-check the whole library — schemas can grow (patches add achievements)
      // and a stale `achievementCount` on a previously-empty game would otherwise
      // permanently hide newly-added achievements.
      const owned = await this.prisma.steamOwnedGame.findMany({
        where: { removedAt: null },
        select: { appid: true },
      });
      await this.service.refreshSchemas(owned.map((g) => g.appid));
    } catch (err) {
      this.logger.warn(`schema sync failed: ${err}`);
    } finally {
      this.running = false;
    }
  }
}
