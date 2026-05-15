import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { SteamTagService } from "./tag.service";

// Tag catalog cron — monthly at 04:45 Europe/Brussels, 15 min after the
// enrichment cron so the two never overlap. The catalog rarely changes in
// shape (Steam adds tags occasionally), so a monthly cadence is plenty.
//
// On-boot backfill runs only when the table is empty so a first deploy ships
// a populated catalog without waiting for the next cron tick. Subsequent
// reboots are no-ops — re-pulling thousands of tags on every container start
// would burn budget for no gain over the monthly refresh.
@Injectable()
export class SteamTagPoller implements OnModuleInit {
  private readonly logger = new Logger(SteamTagPoller.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly service: SteamTagService
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.prisma.steamTag.count();
    if (count > 0) return;
    this.logger.log("tag catalog empty at boot — pulling initial catalog");
    try {
      await this.service.syncTags();
    } catch (err) {
      // Don't block boot on Steam. Next month's cron will reconcile; the
      // frontend gracefully renders unknown tag ids as numeric until then.
      this.logger.warn(`boot tag-catalog pull failed: ${err}`);
    }
  }

  @Cron("45 4 1 * *", { name: "steam-tag-catalog", timeZone: "Europe/Brussels" })
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn("previous tick still running — skipping");
      return;
    }
    this.running = true;
    try {
      await this.service.syncTags();
    } catch (err) {
      this.logger.warn(`tag-catalog sync failed: ${err}`);
    } finally {
      this.running = false;
    }
  }
}
