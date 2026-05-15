import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { SteamPlayerUnlocksService } from "./player-unlocks.service";

// Daily per-owner unlock sync. Steam's `unlocktime` is real historical data —
// every poll backfills retroactively, so the table reflects the full unlock
// timeline regardless of when we first polled (the "Day 1 looks like year N"
// property). `createMany({ skipDuplicates: true })` on the composite PK keeps
// the operation idempotent across re-runs.
//
// Anchored to 06:00 Europe/Brussels so it lands 2 hours after the daily
// owned-games sync (4:00) — any newly-added games already have their schema
// fetched in the same sync tick (the on-add hook in syncOwnedGames), so the
// FK on `SteamPlayerUnlock(appid, apiName)` resolves cleanly.
@Injectable()
export class SteamPlayerUnlocksPoller implements OnModuleInit {
  private readonly logger = new Logger(SteamPlayerUnlocksPoller.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly service: SteamPlayerUnlocksService
  ) {}

  async onModuleInit(): Promise<void> {
    // Boot backfill: games with a known achievement schema (count > 0) that
    // haven't had an unlock check yet. First deploy populates the unlock
    // table without waiting for tomorrow's cron — important so the per-game
    // panel renders real data on day 1.
    const candidates = await this.prisma.steamOwnedGame.findMany({
      where: {
        removedAt: null,
        achievementMeta: {
          achievementCount: { gt: 0 },
          lastUnlocksCheckedAt: null,
        },
      },
      select: { appid: true },
    });
    if (candidates.length === 0) return;
    this.logger.log(`backfilling unlocks for ${candidates.length} apps at boot`);
    try {
      await this.service.syncUnlocks(candidates.map((g) => g.appid));
    } catch (err) {
      // Boot must not block on Steam — log and move on. Tomorrow's cron
      // picks up wherever this run left off.
      this.logger.warn(`boot backfill failed: ${err}`);
    }
  }

  @Cron("0 6 * * *", { name: "steam-player-unlocks", timeZone: "Europe/Brussels" })
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
      await this.service.syncUnlocks(candidates.map((g) => g.appid));
    } catch (err) {
      this.logger.warn(`unlock sync failed: ${err}`);
    } finally {
      this.running = false;
    }
  }
}
