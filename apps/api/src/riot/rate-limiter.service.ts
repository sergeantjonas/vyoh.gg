import { Injectable, Logger } from "@nestjs/common";
import Bottleneck from "bottleneck";
import { METHOD_LIMITS, type MethodFamily } from "./method-families";
import type { Regional } from "./regions";
import { RateLimiterTimeoutError } from "./riot.error";

const REGIONALS: Regional[] = ["americas", "europe", "asia", "sea"];

const SCHEDULE_DEADLINE_MS = 30_000;
const STILL_QUEUED_WARNING_MS = 10_000;
const SLOW_QUEUE_LOG_MS = 2_000;
const MAX_CONCURRENT_PER_REGIONAL = 8;

type AppWindow = { limiter: Bottleneck; windowSec: number };
type MethodEntry = { limiter: Bottleneck; windowSec: number };

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly appWindows = new Map<Regional, AppWindow[]>();
  private readonly methodLimiters = new Map<string, MethodEntry>();

  // Overridable so tests can use a tiny deadline without fake timers
  // fighting Bottleneck's internal scheduler.
  deadlineMs: number = SCHEDULE_DEADLINE_MS;

  constructor() {
    for (const regional of REGIONALS) {
      const fast = new Bottleneck({
        reservoir: 20,
        reservoirRefreshAmount: 20,
        reservoirRefreshInterval: 1_000,
        minTime: 50,
        maxConcurrent: MAX_CONCURRENT_PER_REGIONAL,
      });
      const slow = new Bottleneck({
        reservoir: 100,
        reservoirRefreshAmount: 100,
        reservoirRefreshInterval: 120_000,
      });
      fast.chain(slow);
      this.appWindows.set(regional, [
        { limiter: fast, windowSec: 1 },
        { limiter: slow, windowSec: 120 },
      ]);
    }
  }

  async schedule<T>(
    regional: Regional,
    family: MethodFamily,
    fn: () => Promise<T>
  ): Promise<T> {
    const limiter = this.methodLimiterFor(regional, family).limiter;
    const start = Date.now();

    const stillQueuedWarn = setTimeout(() => {
      const c = limiter.counts();
      // EXECUTING > 0 means the inner callback (incl. the actual fetch) is in
      // flight; QUEUED > 0 means we're waiting for limiter capacity. Either
      // can be the cause of a slow request — print both so the operator can
      // tell network-stall from queue-starvation at a glance.
      this.logger.warn(
        `${regional}:${family} still pending after ${STILL_QUEUED_WARNING_MS}ms — ${c.QUEUED} queued, ${c.EXECUTING} in flight`
      );
    }, STILL_QUEUED_WARNING_MS);

    const queued = limiter.schedule(async () => {
      const waited = Date.now() - start;
      // Diagnostic: log every callback dispatch with its queue wait so we can
      // tell apart "callback never ran" (no log at all) from "callback ran
      // and the inner fetch hung" (log present, no fetch result).
      this.logger.log(`${regional}:${family} callback dispatched after ${waited}ms`);
      try {
        const result = await fn();
        this.logger.log(`${regional}:${family} callback resolved`);
        return result;
      } catch (err) {
        this.logger.warn(
          `${regional}:${family} callback rejected: ${err instanceof Error ? err.name : String(err)}`
        );
        throw err;
      }
    });

    const deadlineMs = this.deadlineMs;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      deadlineTimer = setTimeout(() => {
        const c = limiter.counts();
        this.logger.error(
          `${regional}:${family} exceeded ${deadlineMs}ms deadline — abandoning (queued: ${c.QUEUED}, executing: ${c.EXECUTING})`
        );
        reject(new RateLimiterTimeoutError(regional, family, deadlineMs));
      }, deadlineMs);
    });

    try {
      return await Promise.race([queued, deadline]);
    } finally {
      clearTimeout(stillQueuedWarn);
      if (deadlineTimer) clearTimeout(deadlineTimer);
    }
  }

  async syncFromHeaders(
    regional: Regional,
    family: MethodFamily,
    headers: Headers
  ): Promise<void> {
    const appLimits = parsePairs(headers.get("X-App-Rate-Limit"));
    const appCounts = parsePairs(headers.get("X-App-Rate-Limit-Count"));
    const windows = this.appWindows.get(regional);
    if (windows) {
      for (const limit of appLimits) {
        const count = appCounts.find((c) => c.windowSec === limit.windowSec);
        const window = windows.find((w) => w.windowSec === limit.windowSec);
        if (!count || !window) continue;
        const remaining = Math.max(0, limit.value - count.value);
        await shrinkReservoir(window.limiter, remaining);
      }
    }

    const methodLimits = parsePairs(headers.get("X-Method-Rate-Limit"));
    const methodCounts = parsePairs(headers.get("X-Method-Rate-Limit-Count"));
    if (methodLimits.length) {
      const method = this.methodLimiterFor(regional, family);
      const limit = methodLimits.find((l) => l.windowSec === method.windowSec);
      const count = methodCounts.find((c) => c.windowSec === method.windowSec);
      if (limit && count) {
        const remaining = Math.max(0, limit.value - count.value);
        await shrinkReservoir(method.limiter, remaining);
      }
    }
  }

  private methodLimiterFor(regional: Regional, family: MethodFamily): MethodEntry {
    const key = `${regional}:${family}`;
    const existing = this.methodLimiters.get(key);
    if (existing) return existing;

    const { reservoir, intervalMs } = METHOD_LIMITS[family];
    const limiter = new Bottleneck({
      reservoir,
      reservoirRefreshAmount: reservoir,
      reservoirRefreshInterval: intervalMs,
    });
    const fastApp = this.appWindows.get(regional)?.[0];
    if (fastApp) limiter.chain(fastApp.limiter);

    const entry: MethodEntry = { limiter, windowSec: intervalMs / 1000 };
    this.methodLimiters.set(key, entry);
    return entry;
  }
}

type RatePair = { value: number; windowSec: number };

// "20:1,100:120" → [{ value: 20, windowSec: 1 }, { value: 100, windowSec: 120 }]
function parsePairs(header: string | null): RatePair[] {
  if (!header) return [];
  return header.split(",").flatMap((pair) => {
    const [valueStr, windowStr] = pair.split(":");
    const value = Number(valueStr);
    const windowSec = Number(windowStr);
    if (!Number.isFinite(value) || !Number.isFinite(windowSec) || windowSec <= 0) {
      return [];
    }
    return [{ value, windowSec }];
  });
}

async function shrinkReservoir(limiter: Bottleneck, target: number): Promise<void> {
  const current = await limiter.currentReservoir();
  if (current === null || current === undefined) return;
  if (target < current) {
    await limiter.updateSettings({ reservoir: target });
  }
}
