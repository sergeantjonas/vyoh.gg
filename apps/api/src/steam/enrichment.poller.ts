import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { SteamEnrichmentService } from "./enrichment.service";

// Enrichment data (asset hashes, type, release date, tags) shifts only when a
// publisher updates store art or metadata — monthly is plenty. Anchored to
// 04:30 Europe/Brussels on the 1st so it lands 30 minutes after the daily
// owned-games poll, never overlapping the playtime sync window.
//
// On-add coverage comes from the syncOwnedGames diff hook (see
// owned-games.service.ts); on-boot coverage of unenriched rows comes from
// OnModuleInit. Together those keep the table populated without leaning on
// the cron firing for newly-owned titles.
@Injectable()
export class SteamEnrichmentPoller implements OnModuleInit {
  private readonly logger = new Logger(SteamEnrichmentPoller.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly service: SteamEnrichmentService
  ) {}

  async onModuleInit(): Promise<void> {
    // Backfill unenriched rows once at boot so a first deploy (or a new game
    // added by an out-of-band path) doesn't sit with placeholder assets until
    // the monthly tick. Self-healing — re-deploys are no-ops once every owned
    // appid has an enrichment row.
    const unenriched = await this.prisma.steamOwnedGame.findMany({
      where: { removedAt: null, enrichment: null },
      select: { appid: true },
    });
    if (unenriched.length === 0) return;
    this.logger.log(`backfilling ${unenriched.length} unenriched apps at boot`);
    try {
      await this.service.enrichApps(unenriched.map((g) => g.appid));
    } catch (err) {
      // Boot must not block on Steam — log and move on. Next month's cron
      // (or the on-add hook for incremental additions) will reconcile.
      this.logger.warn(`boot backfill failed: ${err}`);
    }
  }

  @Cron("30 4 1 * *", { name: "steam-enrichment", timeZone: "Europe/Brussels" })
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn("previous tick still running — skipping");
      return;
    }
    this.running = true;
    try {
      // Full refresh — re-pulls every currently-owned appid. Lets us detect
      // publisher art swaps via assetTimestamp without per-row diff logic.
      const owned = await this.prisma.steamOwnedGame.findMany({
        where: { removedAt: null },
        select: { appid: true },
      });
      await this.service.enrichApps(owned.map((g) => g.appid));
    } catch (err) {
      this.logger.warn(`enrichment sync failed: ${err}`);
    } finally {
      this.running = false;
    }
  }
}
