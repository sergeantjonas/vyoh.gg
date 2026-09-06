import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import Bottleneck from "bottleneck";

// Steam Web API quota: 100,000 calls / 24h per key (documented). No documented
// per-second ceiling; community consensus is ~1 req/s sustained with burst
// tolerance. We pick `minTime: 200` (5 req/s) as a conservative cap, well below
// observed soft throttling thresholds.
//
// The reservoir is sized to the daily quota with a 24h refresh window. Mirrors
// the slow-reservoir shape from the Riot rate-limiter, minus the regional
// fan-out (Steam Web API is single-host).
const SCHEDULE_DEADLINE_MS = 15_000;
const STILL_QUEUED_WARNING_MS = 10_000;
const APP_DAILY_RESERVOIR = 100_000;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const MIN_TIME_MS = 200;
const MAX_CONCURRENT = 4;

export class SteamRateLimiterTimeoutError extends Error {
  constructor(
    readonly family: string,
    readonly deadlineMs: number
  ) {
    super(`Steam ${family} exceeded ${deadlineMs}ms schedule deadline`);
    this.name = "SteamRateLimiterTimeoutError";
  }
}

@Injectable()
export class SteamRateLimiterService implements OnModuleDestroy {
  private readonly logger = new Logger(SteamRateLimiterService.name);
  private readonly limiter: Bottleneck;

  // Overridable so tests can use a tiny deadline without fake timers fighting
  // Bottleneck's internal scheduler.
  deadlineMs: number = SCHEDULE_DEADLINE_MS;

  constructor() {
    this.limiter = new Bottleneck({
      reservoir: APP_DAILY_RESERVOIR,
      reservoirRefreshAmount: APP_DAILY_RESERVOIR,
      reservoirRefreshInterval: REFRESH_INTERVAL_MS,
      minTime: MIN_TIME_MS,
      maxConcurrent: MAX_CONCURRENT,
    });
  }

  async onModuleDestroy(): Promise<void> {
    // Stop dispatching; in-flight work is left to settle so callers see a real
    // result rather than a synthetic shutdown error.
    await this.limiter.stop({ dropWaitingJobs: true });
  }

  async schedule<T>(family: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const deadlineMs = this.deadlineMs;

    const stillQueuedWarn = setTimeout(() => {
      const c = this.limiter.counts();
      this.logger.warn(
        `steam:${family} still pending after ${STILL_QUEUED_WARNING_MS}ms — ${c.QUEUED} queued, ${c.EXECUTING} in flight`
      );
    }, STILL_QUEUED_WARNING_MS);

    const queued = this.limiter.schedule(async () => {
      const waited = Date.now() - start;
      // The outer deadline race may have already rejected — short-circuit so we
      // don't burn a Bottleneck slot on a request the caller has abandoned. Same
      // wedge-prevention pattern as the Riot limiter.
      if (waited >= deadlineMs) {
        throw new SteamRateLimiterTimeoutError(family, deadlineMs);
      }
      return fn();
    });

    queued.catch(() => {});

    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      deadlineTimer = setTimeout(() => {
        const c = this.limiter.counts();
        this.logger.error(
          `steam:${family} exceeded ${deadlineMs}ms deadline — abandoning (queued: ${c.QUEUED}, executing: ${c.EXECUTING})`
        );
        reject(new SteamRateLimiterTimeoutError(family, deadlineMs));
      }, deadlineMs);
    });

    try {
      return await Promise.race([queued, deadline]);
    } finally {
      clearTimeout(stillQueuedWarn);
      if (deadlineTimer) clearTimeout(deadlineTimer);
    }
  }
}
