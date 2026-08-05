import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { SteamGlobalRarityService } from "./global-rarity.service";

// Global achievement rarity shifts slowly — Steam aggregates across the
// entire player base, so each row wants refreshing about weekly, and the
// daily budget stays reserved for the per-owner unlocks poll.
//
// That week is expressed as an age rather than a Sunday wall-clock fire, for
// the reason spelled out in achievement-schema.poller.ts: `@nestjs/schedule`
// does not replay a fire the process was down for. Boot runs the same
// selection as the tick, so a restart reconciles whatever the missed windows
// left behind.
const RARITY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Bounds one pass. Steady state is ~158 games with a schema / 7 ≈ 23 a day,
// so the cap only engages after downtime — and it has to stay above that
// arrival rate or the oldest rows never drain.
const RARITY_BATCH_CAP = 40;

@Injectable()
export class SteamGlobalRarityPoller implements OnModuleInit {
  private readonly logger = new Logger(SteamGlobalRarityPoller.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly service: SteamGlobalRarityService
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.refreshDue("boot");
    } catch (err) {
      // Boot must not block on Steam. The daily tick, or the next restart,
      // picks up whatever this pass missed.
      this.logger.warn(`boot backfill failed: ${err}`);
    }
  }

  // Daily at 05:30 Europe/Brussels, 30 min after the schema tick so the two
  // never overlap. Was Sunday-only until 2026-08-06.
  @Cron("30 5 * * *", { name: "steam-global-rarity", timeZone: "Europe/Brussels" })
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn("previous tick still running — skipping");
      return;
    }
    this.running = true;
    try {
      await this.refreshDue("tick");
    } catch (err) {
      this.logger.warn(`rarity sync failed: ${err}`);
    } finally {
      this.running = false;
    }
  }

  private async refreshDue(source: string): Promise<void> {
    const appids = await this.dueAppids();
    if (appids.length === 0) return;
    this.logger.log(`refreshing rarity for ${appids.length} due apps (${source})`);
    await this.service.refreshRarity(appids);
  }

  // Only games with a known schema have rarity to fetch, so unlike the schema
  // poller this needs no separate never-seen pass — a game with no meta row
  // has nothing to ask Steam about yet. `nulls: "first"` is still load-bearing:
  // Postgres sorts NULLS LAST on ASC, which would park a never-checked row
  // permanently behind the batch cap.
  private async dueAppids(): Promise<number[]> {
    const due = await this.prisma.steamGameAchievementMeta.findMany({
      where: {
        game: { removedAt: null },
        achievementCount: { gt: 0 },
        OR: [
          { lastRarityCheckedAt: null },
          { lastRarityCheckedAt: { lt: new Date(Date.now() - RARITY_MAX_AGE_MS) } },
        ],
      },
      orderBy: { lastRarityCheckedAt: { sort: "asc", nulls: "first" } },
      select: { appid: true },
      take: RARITY_BATCH_CAP,
    });
    return due.map((r) => r.appid);
  }
}
