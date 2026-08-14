import {
  ForbiddenException,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type {
  SyncStatus,
  SyncTick,
  SyncTickAccountResult,
  SyncTriggerResult,
} from "@vyoh/shared";
import { IdentityService } from "../identity/identity.service";
import { RiotError } from "../riot/riot.error";
import { LolService } from "./lol.service";
import { MatchEventsService } from "./match-events.service";

const HISTORY_LIMIT = 10;

function isSyncEnabledFromEnv(): boolean {
  const v = process.env.MATCH_SYNC_ENABLED;
  if (v === undefined) return true;
  return v.toLowerCase() !== "false" && v !== "0";
}

@Injectable()
export class MatchSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MatchSyncService.name);
  private running = false;
  // Initialised from env, mutable at runtime via setEnabled() so operators
  // can pause the cron without a restart (e.g. during a Riot outage).
  private enabled: boolean;
  private lastTick: SyncTick | null = null;
  private readonly history: SyncTick[] = [];

  constructor(
    private readonly lol: LolService,
    private readonly identity: IdentityService,
    private readonly events: MatchEventsService
  ) {
    this.enabled = isSyncEnabledFromEnv();
    if (!this.enabled) {
      this.logger.warn("disabled via MATCH_SYNC_ENABLED=false");
    }
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) return;
    // Fire-and-forget initial sync. The match list now reads only from the DB,
    // so a fresh DB would otherwise show empty until the first 5-minute cron
    // tick. With the Promise.race fetch timeout in RiotService, individual
    // hung fetches can no longer wedge the boot process.
    void this.syncAll().catch((err) => {
      this.logger.warn(`initial sync failed: ${err}`);
    });
  }

  getStatus(): SyncStatus {
    return {
      enabled: this.enabled,
      running: this.running,
      lastTick: this.lastTick,
      history: [...this.history],
    };
  }

  setEnabled(enabled: boolean): SyncStatus {
    if (this.enabled !== enabled) {
      this.enabled = enabled;
      this.logger.log(enabled ? "resumed" : "paused");
    }
    return this.getStatus();
  }

  // Manual trigger: fire-and-forget so the HTTP response returns immediately.
  // The SSE stream will push the completed tick when syncAll resolves.
  // Honours the `enabled` flag — pausing must be explicitly reversed.
  triggerNow(): SyncTriggerResult {
    if (!this.enabled) {
      return { triggered: false, reason: "paused", status: this.getStatus() };
    }
    if (this.running) {
      return { triggered: false, reason: "already running", status: this.getStatus() };
    }
    void this.syncAll().catch((err) => {
      this.logger.warn(`manual sync failed: ${err}`);
    });
    return { triggered: true, status: this.getStatus() };
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: "match-sync" })
  async syncAll(): Promise<void> {
    if (!this.enabled) return;
    if (this.running) {
      this.logger.warn("previous tick still running — skipping");
      return;
    }
    this.running = true;
    const startedAt = new Date();
    const start = Date.now();
    const accountResults: SyncTickAccountResult[] = [];
    try {
      const accounts = this.identity.getSyncableLolAccounts();
      this.logger.log(`syncing ${accounts.length} account(s)`);

      // Sequential, not parallel — we lean on the rate limiter for backpressure
      // either way, but sequential keeps logs ordered and avoids stampeding
      // the limiter when many accounts have many missing matches.
      for (const account of accounts) {
        const label = `${account.gameName}#${account.tagLine}`;
        const result: SyncTickAccountResult = {
          slug: account.slug,
          label,
          head: { error: "skipped" },
          historical: { error: "skipped" },
        };

        // Capture rank snapshot before syncing matches so the LP value is
        // available for attachment to newly-ingested match rows.
        // Fails gracefully when the summoner row doesn't exist yet (first ever tick).
        try {
          await this.lol.captureRankSnapshot(account);
        } catch (err) {
          this.logger.warn(`${label} rank snapshot failed: ${errMsg(err)}`);
        }

        try {
          const head = await this.lol.syncAccountMatches(account);
          result.head = head;
          this.logger.log(`${label}: ${head.backfilled} new of ${head.idCount} ids`);
        } catch (err) {
          result.head = { error: safeSyncError(err) };
          this.logger.warn(`${label} head sync failed: ${errMsg(err)}`);
          // Skip the historical step when head failed — the summoner row may
          // not exist yet, and we don't want to compound rate-limit pressure.
          accountResults.push(result);
          continue;
        }

        // Second snapshot capture: on the very first tick for a new account the
        // summoner row doesn't exist when the pre-sync capture runs, so it
        // returns early without writing anything. Repeating it here guarantees a
        // snapshot is in place for the next tick's new matches. Idempotent on
        // all subsequent ticks (LP unchanged → no new row written).
        try {
          await this.lol.captureRankSnapshot(account);
        } catch (err) {
          this.logger.warn(`${label} post-sync rank snapshot failed: ${errMsg(err)}`);
        }

        // Summoner profile (icon + level) can change at any time — sync every tick.
        try {
          await this.lol.syncSummonerProfile(account);
        } catch (err) {
          this.logger.warn(`${label} summoner profile sync failed: ${errMsg(err)}`);
        }

        // Historical step: one page deeper per tick. Best-effort — a Riot
        // outage on the historical step shouldn't block the next account.
        try {
          const hist = await this.lol.syncAccountHistorical(account);
          result.historical = hist;
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
          result.historical = { error: safeSyncError(err) };
          this.logger.warn(`${label} historical step failed: ${errMsg(err)}`);
        }

        accountResults.push(result);
      }

      const durationMs = Date.now() - start;
      this.logger.log(`tick complete in ${durationMs}ms`);

      const tick: SyncTick = {
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs,
        accounts: accountResults,
      };
      this.lastTick = tick;
      this.history.unshift(tick);
      if (this.history.length > HISTORY_LIMIT) this.history.length = HISTORY_LIMIT;
      this.events.emitSyncTick(tick);
    } finally {
      this.running = false;
    }
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// `/status` is public and re-emitted over SSE every two seconds, so anything
// stored on a tick result is published — and unlike a thrown error, it never
// passes Nest's exception filter, which is what masks internals everywhere
// else. A Prisma connection failure spells out the database host and port in
// its message; that would have been served in a 200 body.
//
// Classified rather than blanked, because the status page is the owner's own
// diagnostic surface and "sync failed" for everything would make it useless.
// Riot's HTTP status is the genuinely useful part and carries nothing private
// (its key travels in a header, not the path). The real message still reaches
// the logs at every call site below.
function safeSyncError(err: unknown): string {
  if (err instanceof RiotError) return `riot ${err.status}`;
  if (err instanceof ForbiddenException) return "account not whitelisted";
  if (err instanceof Error && err.name === "TimeoutError") return "timeout";
  // Prisma's known-request errors are `P` followed by four digits. The code
  // identifies the failure class without quoting the connection string.
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === "string" && /^P\d{4}$/.test(code)) return `database ${code}`;
  return "sync failed";
}
