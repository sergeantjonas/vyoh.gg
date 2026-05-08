import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { IdentityService } from "../identity/identity.service";
import { LolService } from "./lol.service";

function isSyncEnabled(): boolean {
  const v = process.env.MATCH_SYNC_ENABLED;
  if (v === undefined) return true;
  return v.toLowerCase() !== "false" && v !== "0";
}

@Injectable()
export class MatchSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MatchSyncService.name);
  private running = false;

  constructor(
    private readonly lol: LolService,
    private readonly identity: IdentityService
  ) {
    if (!isSyncEnabled()) {
      this.logger.warn("disabled via MATCH_SYNC_ENABLED=false");
    }
  }

  onApplicationBootstrap(): void {
    if (!isSyncEnabled()) return;
    // Fire-and-forget initial sync. The match list now reads only from the DB,
    // so a fresh DB would otherwise show empty until the first 5-minute cron
    // tick. With the Promise.race fetch timeout in RiotService, individual
    // hung fetches can no longer wedge the boot process.
    void this.syncAll().catch((err) => {
      this.logger.warn(`initial sync failed: ${err}`);
    });
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: "match-sync" })
  async syncAll(): Promise<void> {
    if (!isSyncEnabled()) return;
    if (this.running) {
      this.logger.warn("previous tick still running — skipping");
      return;
    }
    this.running = true;
    const start = Date.now();
    try {
      const accounts = this.identity.getLolAccounts();
      this.logger.log(`syncing ${accounts.length} account(s)`);

      // Sequential, not parallel — we lean on the rate limiter for backpressure
      // either way, but sequential keeps logs ordered and avoids stampeding
      // the limiter when many accounts have many missing matches.
      for (const account of accounts) {
        const label = `${account.gameName}#${account.tagLine}`;

        try {
          const head = await this.lol.syncAccountMatches(account);
          this.logger.log(`${label}: ${head.backfilled} new of ${head.idCount} ids`);
        } catch (err) {
          this.logger.warn(
            `${label} head sync failed: ${err instanceof Error ? err.message : String(err)}`
          );
          // Skip the historical step when head failed — the summoner row may
          // not exist yet, and we don't want to compound rate-limit pressure.
          continue;
        }

        // Historical step: one page deeper per tick. Best-effort — a Riot
        // outage on the historical step shouldn't block the next account.
        try {
          const hist = await this.lol.syncAccountHistorical(account);
          if (hist.skipped) {
            // No-op tick (no matches yet, or already done) — silent.
          } else if (hist.done) {
            this.logger.log(
              `${label}: historical done (last page +${hist.backfilled} of ${hist.idCount})`
            );
          } else {
            this.logger.log(
              `${label}: historical +${hist.backfilled} of ${hist.idCount}`
            );
          }
        } catch (err) {
          this.logger.warn(
            `${label} historical step failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      this.logger.log(`tick complete in ${Date.now() - start}ms`);
    } finally {
      this.running = false;
    }
  }
}
