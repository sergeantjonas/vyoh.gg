import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SteamOwnedGamesService } from "./owned-games.service";

// Steam's playtime is essentially read-only between launches — once-daily is
// the right cadence. 04:00 Europe/Brussels lands in the owner's quiet hours,
// well outside any plausible peer-traffic window, and keeps the snapshot
// boundary stable across DST transitions (Brussels never crosses 04:00
// during a spring-forward / fall-back).
@Injectable()
export class SteamOwnedGamesPoller {
  private readonly logger = new Logger(SteamOwnedGamesPoller.name);
  private running = false;

  constructor(private readonly service: SteamOwnedGamesService) {}

  // Every 15 min. Was daily 04:00 — bumped 2026-05-15 since owned-games is a
  // single `GetOwnedGames` call (1 req/tick) and "I bought a game, it should
  // show up shortly" is a flow worth optimizing for. Sub-percent of the daily
  // Steam budget at this rate. Offset to xx:00 marks; unlocks poller offsets
  // to xx:05/20/35/50 to keep the on-add chain (owned → schema → unlocks)
  // ordered without contention.
  @Cron("*/15 * * * *", { name: "steam-owned-games", timeZone: "Europe/Brussels" })
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn("previous tick still running — skipping");
      return;
    }
    this.running = true;
    try {
      await this.service.syncOwnedGames();
    } catch (err) {
      // Steam is occasionally flaky around their own maintenance windows.
      // Swallow so the scheduler keeps firing tomorrow; the next run picks
      // up wherever today's left off.
      this.logger.warn(`owned-games sync failed: ${err}`);
    } finally {
      this.running = false;
    }
  }
}
