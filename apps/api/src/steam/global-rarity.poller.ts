import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { OWNER_TIME_ZONE } from "@vyoh/shared";
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
export const RARITY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// …except in the weeks after a game releases, where that premise is false. A
// launch-window title's percentages are still finding their level as the
// owned-but-unplayed population works through content nobody has reached yet:
// Beast of Reincarnation moved up to 30pp in a single week, against a 0.30pp
// ceiling across 512 series from settled titles. Sampling that weekly records
// two points on a curve that moves 20pp between them, and the history table
// has no way to reconstruct what it did not observe — so an under-sampled
// launch window is lost permanently, not merely deferred.
export const RARITY_LAUNCH_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Matches the cohort split the drift probe reports against
// (`probe-rarity-drift.ts --launch-window`). A game with no known release date
// is treated as settled: enrichment refreshes daily against a 30-day window, so
// an unenriched release resolves within a day or two, and guessing the other
// way would put the whole unenriched tail on daily polls.
export const LAUNCH_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

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
  @Cron("30 5 * * *", { name: "steam-global-rarity", timeZone: OWNER_TIME_ZONE })
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
  //
  // The two cohorts are selected separately rather than in one query with a
  // conditional cutoff, because they must not compete on the same ordering.
  // Draining oldest-first across a merged set sorts a daily-polled launch
  // title *behind* every weekly one — it was checked more recently, so its
  // timestamp is newer — which parks the only cohort that moves at the back of
  // the queue, and behind the cap entirely whenever a backlog exists.
  private async dueAppids(): Promise<number[]> {
    const now = Date.now();
    const launchAppids = await this.launchWindowAppids(new Date(now - LAUNCH_WINDOW_MS));

    // Skipped entirely when the library holds no launch-window title, rather
    // than issued with an empty cohort filter — an unfiltered query at the
    // 24-hour cutoff would put the whole library on daily polls.
    const launch =
      launchAppids.length === 0
        ? []
        : await this.selectDue(
            new Date(now - RARITY_LAUNCH_MAX_AGE_MS),
            { appid: { in: launchAppids } },
            RARITY_BATCH_CAP
          );

    // Launch-window titles take their slots off the top; the rest of the pass
    // drains the settled backlog exactly as before.
    const remaining = RARITY_BATCH_CAP - launch.length;
    if (remaining <= 0) return launch;

    const settled = await this.selectDue(
      new Date(now - RARITY_MAX_AGE_MS),
      launchAppids.length > 0 ? { appid: { notIn: launchAppids } } : null,
      remaining
    );
    return [...launch, ...settled];
  }

  private async launchWindowAppids(cutoff: Date): Promise<number[]> {
    const recent = await this.prisma.steamGameEnrichment.findMany({
      where: { releaseDate: { gte: cutoff } },
      select: { appid: true },
    });
    return recent.map((r) => r.appid);
  }

  private async selectDue(
    cutoff: Date,
    cohort: { appid: { in: number[] } | { notIn: number[] } } | null,
    take: number
  ): Promise<number[]> {
    const due = await this.prisma.steamGameAchievementMeta.findMany({
      where: {
        game: { removedAt: null },
        achievementCount: { gt: 0 },
        ...(cohort ?? {}),
        OR: [{ lastRarityCheckedAt: null }, { lastRarityCheckedAt: { lt: cutoff } }],
      },
      orderBy: { lastRarityCheckedAt: { sort: "asc", nulls: "first" } },
      select: { appid: true },
      take,
    });
    return due.map((r) => r.appid);
  }
}
