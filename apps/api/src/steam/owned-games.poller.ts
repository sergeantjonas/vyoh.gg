import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { OWNER_TIME_ZONE } from "@vyoh/shared";
import { SyncJobRegistry } from "../sync-jobs/sync-job-registry.service";
import { SYNC_JOBS } from "../sync-jobs/sync-jobs.catalog";
import { SteamOwnedGamesService } from "./owned-games.service";

const JOB = "steam-owned-games";

// Steam's playtime is essentially read-only between launches — once-daily is
// the right cadence. 04:00 Europe/Brussels lands in the owner's quiet hours,
// well outside any plausible peer-traffic window, and keeps the snapshot
// boundary stable across DST transitions (Brussels never crosses 04:00
// during a spring-forward / fall-back).
@Injectable()
export class SteamOwnedGamesPoller {
  constructor(
    private readonly service: SteamOwnedGamesService,
    private readonly jobs: SyncJobRegistry
  ) {}

  // Every 15 min. Was daily 04:00 — bumped 2026-05-15 since owned-games is a
  // single `GetOwnedGames` call (1 req/tick) and "I bought a game, it should
  // show up shortly" is a flow worth optimizing for. Sub-percent of the daily
  // Steam budget at this rate. Offset to xx:00 marks; unlocks poller offsets
  // to xx:05/20/35/50 to keep the on-add chain (owned → schema → unlocks)
  // ordered without contention.
  // Steam is occasionally flaky around their own maintenance windows, so the
  // registry swallows the failure and records it — the scheduler keeps firing
  // tomorrow and the next run picks up wherever today's left off.
  @Cron(SYNC_JOBS[JOB].cron, { name: JOB, timeZone: OWNER_TIME_ZONE })
  async tick(): Promise<void> {
    await this.jobs.run(JOB, () => this.service.syncOwnedGames());
  }
}
