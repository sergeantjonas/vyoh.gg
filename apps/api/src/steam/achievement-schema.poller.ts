import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { OWNER_TIME_ZONE } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SteamAchievementSchemaService } from "./achievement-schema.service";

// Per-game achievement schemas rarely change, so each row wants refreshing
// about weekly. That is expressed as an age rather than a weekly wall-clock
// fire: `@nestjs/schedule` holds crons as in-process timers with no
// persistence and no catch-up, so a `0 5 * * 0` tick that the process misses
// is skipped outright, not deferred. The daily tick below plus the identical
// boot pass mean a missed window costs a day and self-corrects at the next
// restart — which is the one event guaranteed to follow downtime.
//
// Budget is unchanged by the conversion. A weekly sweep of ~195 games and a
// daily sweep of everything older than seven days both average ~28 calls a
// day; the daily shape just stops bunching them into one fire that has to
// land.
const SCHEMA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Bounds one tick so a cold database doesn't fetch the whole library at
// once. Must stay above the steady-state arrival rate (~195/7 ≈ 28/day) or
// the oldest rows would never drain; oldest-first ordering does the rest.
const SCHEMA_BATCH_CAP = 40;

@Injectable()
export class SteamAchievementSchemaPoller implements OnModuleInit {
  private readonly logger = new Logger(SteamAchievementSchemaPoller.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly service: SteamAchievementSchemaService
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.refreshDue("boot");
    } catch (err) {
      // Boot must not block on Steam — log and move on. The daily tick (or
      // the next restart) reconciles whatever this pass missed.
      this.logger.warn(`boot backfill failed: ${err}`);
    }
  }

  // Daily at 05:00 Europe/Brussels, 30 min before the rarity tick so the two
  // never overlap. Was Sunday-only until 2026-08-06.
  @Cron("0 5 * * *", {
    name: "steam-achievement-schema",
    timeZone: OWNER_TIME_ZONE,
  })
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn("previous tick still running — skipping");
      return;
    }
    this.running = true;
    try {
      await this.refreshDue("tick");
    } catch (err) {
      this.logger.warn(`schema sync failed: ${err}`);
    } finally {
      this.running = false;
    }
  }

  private async refreshDue(source: string): Promise<void> {
    const appids = await this.dueAppids();
    if (appids.length === 0) return;
    this.logger.log(`refreshing ${appids.length} due achievement schemas (${source})`);
    await this.service.refreshSchemas(appids);
  }

  // Never-checked games first, then the oldest checked. Games with a meta row
  // are included even at `achievementCount: 0` — a game bought before release
  // records a legitimate zero that every unlock path then treats as a closed
  // door, so the zero has to be re-derived rather than trusted.
  private async dueAppids(): Promise<number[]> {
    const unchecked = await this.prisma.steamOwnedGame.findMany({
      where: { removedAt: null, achievementMeta: null },
      select: { appid: true },
      take: SCHEMA_BATCH_CAP,
    });
    const remaining = SCHEMA_BATCH_CAP - unchecked.length;
    if (remaining <= 0) return unchecked.map((g) => g.appid);

    // `nulls: "first"` is load-bearing: the column is nullable, and Postgres
    // sorts NULLS LAST on ASC by default, which would park a never-stamped
    // row permanently behind the batch cap.
    const stale = await this.prisma.steamGameAchievementMeta.findMany({
      where: {
        game: { removedAt: null },
        OR: [
          { lastSchemaCheckedAt: null },
          { lastSchemaCheckedAt: { lt: new Date(Date.now() - SCHEMA_MAX_AGE_MS) } },
        ],
      },
      orderBy: { lastSchemaCheckedAt: { sort: "asc", nulls: "first" } },
      select: { appid: true },
      take: remaining,
    });
    return [...unchecked.map((g) => g.appid), ...stale.map((r) => r.appid)];
  }
}
