import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { OWNER_TIME_ZONE } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SyncJobRegistry } from "../sync-jobs/sync-job-registry.service";
import { SYNC_JOBS } from "../sync-jobs/sync-jobs.catalog";
import { SteamPlayerUnlocksService } from "./player-unlocks.service";

const JOB = "steam-player-unlocks";

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly service: SteamPlayerUnlocksService,
    private readonly jobs: SyncJobRegistry
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
    // Routed through the registry like the tick: the boot pass does the same
    // reconciliation, and it is the pass that actually runs on a machine that
    // is not alive at the cron's wall-clock hour.
    await this.jobs.run(JOB, () =>
      this.service.syncUnlocks(candidates.map((g) => g.appid))
    );
  }

  // Every 4 hours at xx:05 (00:05, 04:05, 08:05, 12:05, 16:05, 20:05). Was
  // every 15 min until S6.D (2026-05-16) — slowed to a backstop role now
  // that two cheaper signals catch unlocks promptly: the session-close
  // hook in play-sessions.service refreshes the just-closed appid inline,
  // and the recently-played poller picks up offline-play sessions hourly.
  // This full sweep is the safety net for the long tail (games with no
  // playerstats configured at the time of close, edge cases the cheaper
  // paths miss). ~142 calls/tick × 6 ticks/day = ~850 calls/day on this
  // path alone — was 13.6k.
  @Cron(SYNC_JOBS[JOB].cron, { name: JOB, timeZone: OWNER_TIME_ZONE })
  async tick(): Promise<void> {
    await this.jobs.run(JOB, () => this.sweepEligible());
  }

  private async sweepEligible(): Promise<void> {
    const candidates = await this.prisma.steamOwnedGame.findMany({
      where: {
        removedAt: null,
        achievementMeta: { achievementCount: { gt: 0 } },
      },
      select: { appid: true },
    });
    await this.service.syncUnlocks(candidates.map((g) => g.appid));
  }
}
