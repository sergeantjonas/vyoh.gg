import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SteamPlayerStateService } from "./player-state.service";

// GetPlayerSummaries is the cheapest Steam endpoint we touch — one call per
// tick regardless of library size. Every 2 min = 720 calls/day, sub-1% of
// the 100k daily budget, and frequent enough that "Now playing" feels live
// without being silly. Schedule isn't timezone-sensitive — every-2-min runs
// continuously — but tagging Europe/Brussels keeps the cron-introspection
// surface (status board) honest.
//
// This is the event source for later S6 chunks: chunk 3 reads transitions
// off this row to persist sessions, chunk 4 fires achievement refresh on
// session-end. Keeping the poller dumb (just upsert) lets those layers
// stay decoupled.
@Injectable()
export class SteamPlayerStatePoller implements OnModuleInit {
  private readonly logger = new Logger(SteamPlayerStatePoller.name);
  private running = false;

  constructor(private readonly service: SteamPlayerStateService) {}

  async onModuleInit(): Promise<void> {
    // Backfill on boot so the read endpoint can serve a row immediately
    // rather than 404ing for up to 2 min after a fresh deploy. Failure is
    // soft — the next cron tick will retry.
    try {
      await this.service.syncPlayerState();
    } catch (err) {
      this.logger.warn(`boot player-state sync failed: ${err}`);
    }
  }

  @Cron("*/2 * * * *", {
    name: "steam-player-state",
    timeZone: "Europe/Brussels",
  })
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn("previous tick still running — skipping");
      return;
    }
    this.running = true;
    try {
      await this.service.syncPlayerState();
    } catch (err) {
      this.logger.warn(`player-state sync failed: ${err}`);
    } finally {
      this.running = false;
    }
  }
}
