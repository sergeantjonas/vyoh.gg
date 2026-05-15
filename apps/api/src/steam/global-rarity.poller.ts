import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { SteamGlobalRarityService } from "./global-rarity.service";

// Global achievement rarity shifts slowly — Steam aggregates across the
// entire player base, so weekly refresh is plenty and keeps the daily budget
// reserved for the per-owner unlocks poll. Anchored to 05:30 Sunday
// Europe/Brussels so the weekly window doesn't overlap any of the
// daily/monthly crons.
@Injectable()
export class SteamGlobalRarityPoller implements OnModuleInit {
  private readonly logger = new Logger(SteamGlobalRarityPoller.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly service: SteamGlobalRarityService
  ) {}

  async onModuleInit(): Promise<void> {
    // Boot backfill: games with achievements that haven't had a rarity poll
    // yet. First-deploy populates the badge data immediately so the per-game
    // panel doesn't sit empty until the first Sunday.
    const candidates = await this.prisma.steamOwnedGame.findMany({
      where: {
        removedAt: null,
        achievementMeta: {
          achievementCount: { gt: 0 },
          lastRarityCheckedAt: null,
        },
      },
      select: { appid: true },
    });
    if (candidates.length === 0) return;
    this.logger.log(`backfilling rarity for ${candidates.length} apps at boot`);
    try {
      await this.service.refreshRarity(candidates.map((g) => g.appid));
    } catch (err) {
      this.logger.warn(`boot backfill failed: ${err}`);
    }
  }

  @Cron("30 5 * * 0", { name: "steam-global-rarity", timeZone: "Europe/Brussels" })
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn("previous tick still running — skipping");
      return;
    }
    this.running = true;
    try {
      const candidates = await this.prisma.steamOwnedGame.findMany({
        where: {
          removedAt: null,
          achievementMeta: { achievementCount: { gt: 0 } },
        },
        select: { appid: true },
      });
      await this.service.refreshRarity(candidates.map((g) => g.appid));
    } catch (err) {
      this.logger.warn(`rarity sync failed: ${err}`);
    } finally {
      this.running = false;
    }
  }
}
