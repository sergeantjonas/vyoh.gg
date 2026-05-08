import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import Bottleneck from "bottleneck";
import { METHOD_LIMITS, type MethodFamily } from "./method-families";
import type { Regional } from "./regions";
import { RateLimiterTimeoutError } from "./riot.error";

const REGIONALS: Regional[] = ["americas", "europe", "asia", "sea"];

const SCHEDULE_DEADLINE_MS = 15_000;
const STILL_QUEUED_WARNING_MS = 10_000;
const SLOW_QUEUE_LOG_MS = 2_000;
const MAX_CONCURRENT_PER_REGIONAL = 8;
const COUNTER_DUMP_INTERVAL_MS = 30_000;

const APP_FAST_RESERVOIR = 20;
const APP_SLOW_RESERVOIR = 100;

// 100 calls per 120 s = 1 call per 1.2 s. Reservoir increase semantics
// (vs the older refresh semantics) approximate Riot's rolling window —
// each tick adds one slot back, instead of resetting the entire reservoir
// only at the 120 s boundary. Important when syncFromHeaders shrinks the
// reservoir to near 0 mid-window: with refresh, we'd sit at 0 for up to
// 120 s; with increase, capacity dribbles back at the same rate Riot's
// own rolling window is releasing it.
const SLOW_INCREASE_INTERVAL_MS = 1_200;

type AppWindow = { limiter: Bottleneck; windowSec: number };
type MethodEntry = { limiter: Bottleneck; windowSec: number };

@Injectable()
export class RateLimiterService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly appWindows = new Map<Regional, AppWindow[]>();
  private readonly methodLimiters = new Map<string, MethodEntry>();

  // Overridable so tests can use a tiny deadline without fake timers
  // fighting Bottleneck's internal scheduler.
  deadlineMs: number = SCHEDULE_DEADLINE_MS;

  private dumpInterval: ReturnType<typeof setInterval> | undefined;

  constructor() {
    for (const regional of REGIONALS) {
      const fast = new Bottleneck({
        reservoir: APP_FAST_RESERVOIR,
        reservoirRefreshAmount: APP_FAST_RESERVOIR,
        reservoirRefreshInterval: 1_000,
        minTime: 50,
        maxConcurrent: MAX_CONCURRENT_PER_REGIONAL,
      });
      const slow = new Bottleneck({
        reservoir: APP_SLOW_RESERVOIR,
        reservoirIncreaseAmount: 1,
        reservoirIncreaseInterval: SLOW_INCREASE_INTERVAL_MS,
        reservoirIncreaseMaximum: APP_SLOW_RESERVOIR,
      });
      fast.chain(slow);
      this.appWindows.set(regional, [
        { limiter: fast, windowSec: 1 },
        { limiter: slow, windowSec: 120 },
      ]);
    }

    this.dumpInterval = setInterval(() => {
      void this.dumpCounters();
    }, COUNTER_DUMP_INTERVAL_MS);
    // Keep the interval from holding the process open during shutdown / tests.
    this.dumpInterval.unref?.();
  }

  onModuleDestroy(): void {
    if (this.dumpInterval) clearInterval(this.dumpInterval);
  }

  async schedule<T>(
    regional: Regional,
    family: MethodFamily,
    fn: () => Promise<T>
  ): Promise<T> {
    const limiter = this.methodLimiterFor(regional, family).limiter;
    const start = Date.now();
    const deadlineMs = this.deadlineMs;

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
      // The caller has already given up via the outer deadline race — abort
      // before invoking fn(). Without this short-circuit, the Bottleneck slot
      // stays consumed until the wrapped fetch resolves, which on a wedged
      // chain is "never" and which is what caused EXECUTING to grow
      // monotonically across cron ticks.
      if (waited >= deadlineMs) {
        throw new RateLimiterTimeoutError(regional, family, deadlineMs);
      }
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

    // If the deadline wins the race, `queued` may still reject later when the
    // inner callback finally dispatches and short-circuits. Attach a no-op
    // handler so that late rejection doesn't surface as an unhandledRejection.
    queued.catch(() => {});

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

  private async dumpCounters(): Promise<void> {
    const lines: string[] = [];

    for (const [regional, windows] of this.appWindows) {
      for (const window of windows) {
        const role = window.windowSec === 1 ? "fast" : "slow";
        const counts = window.limiter.counts();
        const reservoir = await window.limiter.currentReservoir();
        if (!isBusy(counts) && !isThrottled(role, reservoir)) continue;
        lines.push(
          `  ${regional}:${role.padEnd(4)} reservoir=${formatReservoir(reservoir)} ${formatCounts(counts)}`
        );
      }
    }

    for (const [key, entry] of this.methodLimiters) {
      const counts = entry.limiter.counts();
      const reservoir = await entry.limiter.currentReservoir();
      if (!isBusy(counts)) continue;
      lines.push(
        `  ${key} reservoir=${formatReservoir(reservoir)} ${formatCounts(counts)}`
      );
    }

    if (lines.length === 0) return;
    this.logger.debug(`limiter counters:\n${lines.join("\n")}`);
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
    // incrementReservoir with a negative delta drains the bucket without
    // touching the rest of the limiter's settings. updateSettings({ reservoir })
    // can interfere with the reservoirIncrease ticker on the slow window —
    // since `syncFromHeaders` runs on every successful response, that path
    // can repeatedly nudge the ticker out of phase and starve the chain.
    await limiter.incrementReservoir(target - current);
  }
}

type Counts = ReturnType<Bottleneck["counts"]>;

function isBusy(c: Counts): boolean {
  return c.RECEIVED > 0 || c.QUEUED > 0 || c.RUNNING > 0 || c.EXECUTING > 0;
}

function isThrottled(role: "fast" | "slow", reservoir: number | null): boolean {
  if (reservoir === null) return false;
  const full = role === "fast" ? APP_FAST_RESERVOIR : APP_SLOW_RESERVOIR;
  return reservoir < full;
}

function formatReservoir(reservoir: number | null): string {
  return reservoir === null ? "-" : String(reservoir);
}

function formatCounts(c: Counts): string {
  return `R=${c.RECEIVED} Q=${c.QUEUED} run=${c.RUNNING} exec=${c.EXECUTING}`;
}
