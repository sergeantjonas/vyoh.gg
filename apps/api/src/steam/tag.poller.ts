import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { OWNER_TIME_ZONE } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SyncJobRegistry } from "../sync-jobs/sync-job-registry.service";
import { SYNC_JOBS } from "../sync-jobs/sync-jobs.catalog";
import { SteamTagService } from "./tag.service";

const JOB = "steam-tag-catalog";

// Tag catalog cron — monthly at 04:45 Europe/Brussels, 15 min after the
// enrichment cron so the two never overlap. The catalog rarely changes in
// shape (Steam adds tags occasionally), so a monthly cadence is plenty.
//
// On-boot backfill runs when the catalog is empty *or* older than the cron
// interval it is meant to be kept at. Emptiness alone is not enough: a
// monthly cron only fires if the process happens to be alive at 04:45 on the
// 1st, and `@nestjs/schedule` does not replay a fire it missed. A catalog
// that is populated but four months stale then has no path back — boot
// returns early because rows exist, and the cron that would refresh them is
// the one that already didn't run. Checking age instead means a restart
// reconciles, which is the one event guaranteed to happen after downtime.
const CATALOG_MAX_AGE_MS = 31 * 24 * 60 * 60 * 1000;
@Injectable()
export class SteamTagPoller implements OnModuleInit {
  private readonly logger = new Logger(SteamTagPoller.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly service: SteamTagService,
    private readonly jobs: SyncJobRegistry
  ) {}

  async onModuleInit(): Promise<void> {
    const newest = await this.prisma.steamTag.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });
    const age = newest ? Date.now() - newest.updatedAt.getTime() : null;
    if (age !== null && age < CATALOG_MAX_AGE_MS) return;
    this.logger.log(
      newest
        ? `tag catalog is ${Math.floor((age ?? 0) / 86_400_000)} days old at boot — refreshing`
        : "tag catalog empty at boot — pulling initial catalog"
    );
    // Routed through the registry like the tick: the boot pass does the same
    // reconciliation, and it is the pass that actually runs on a machine that
    // is not alive at the cron's wall-clock hour.
    await this.jobs.run(JOB, () => this.service.syncTags());
  }

  @Cron(SYNC_JOBS[JOB].cron, { name: JOB, timeZone: OWNER_TIME_ZONE })
  async tick(): Promise<void> {
    await this.jobs.run(JOB, () => this.service.syncTags());
  }
}
