import type Bottleneck from "bottleneck";
import { describe, expect, it, vi } from "vitest";
import { RateLimiterService } from "./rate-limiter.service";
import { RateLimiterTimeoutError } from "./riot.error";

type Internals = {
  appWindows: Map<string, { limiter: Bottleneck; windowSec: number }[]>;
  methodLimiters: Map<string, { limiter: Bottleneck; windowSec: number }>;
};

describe("RateLimiterService", () => {
  it("schedules and resolves work via the regional limiter", async () => {
    const service = new RateLimiterService();
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await service.schedule("europe", "match-by-id", fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("preserves errors thrown by the scheduled function", async () => {
    const service = new RateLimiterService();
    const error = new Error("boom");
    await expect(
      service.schedule("americas", "match-by-id", async () => {
        throw error;
      })
    ).rejects.toBe(error);
  });

  it("provides independent limiters per regional cluster", async () => {
    const service = new RateLimiterService();
    const europe = service.schedule("europe", "match-by-id", async () => "europe");
    const americas = service.schedule("americas", "match-by-id", async () => "americas");
    expect(await europe).toBe("europe");
    expect(await americas).toBe("americas");
  });

  it("isolates method families on the same regional cluster", async () => {
    const service = new RateLimiterService();
    const account = service.schedule(
      "europe",
      "account-by-riot-id",
      async () => "account"
    );
    const matches = service.schedule(
      "europe",
      "match-ids-by-puuid",
      async () => "matches"
    );
    expect(await account).toBe("account");
    expect(await matches).toBe("matches");
  });

  describe("syncFromHeaders", () => {
    it("shrinks the slow app reservoir when Riot reports more usage than we tracked", async () => {
      const service = new RateLimiterService();

      await service.syncFromHeaders(
        "europe",
        "match-by-id",
        new Headers({
          "X-App-Rate-Limit": "20:1,100:120",
          "X-App-Rate-Limit-Count": "1:1,90:120",
        })
      );

      const slow = (service as unknown as Internals).appWindows
        .get("europe")
        ?.find((w) => w.windowSec === 120);
      expect(await slow?.limiter.currentReservoir()).toBe(10);
    });

    it("shrinks the method reservoir from X-Method-Rate-Limit-Count", async () => {
      const service = new RateLimiterService();

      await service.syncFromHeaders(
        "europe",
        "match-ids-by-puuid",
        new Headers({
          "X-Method-Rate-Limit": "2000:10",
          "X-Method-Rate-Limit-Count": "1995:10",
        })
      );

      const method = (service as unknown as Internals).methodLimiters.get(
        "europe:match-ids-by-puuid"
      );
      expect(await method?.limiter.currentReservoir()).toBe(5);
    });

    it("never raises the reservoir above its current value", async () => {
      const service = new RateLimiterService();

      await service.syncFromHeaders(
        "europe",
        "match-by-id",
        new Headers({
          "X-App-Rate-Limit": "20:1,100:120",
          "X-App-Rate-Limit-Count": "1:1,90:120",
        })
      );

      // Second sync claims plenty of headroom — must NOT inflate the bucket.
      await service.syncFromHeaders(
        "europe",
        "match-by-id",
        new Headers({
          "X-App-Rate-Limit": "20:1,100:120",
          "X-App-Rate-Limit-Count": "0:1,0:120",
        })
      );

      const slow = (service as unknown as Internals).appWindows
        .get("europe")
        ?.find((w) => w.windowSec === 120);
      expect(await slow?.limiter.currentReservoir()).toBe(10);
    });

    it("ignores responses without rate-limit headers", async () => {
      const service = new RateLimiterService();
      await expect(
        service.syncFromHeaders("europe", "match-by-id", new Headers())
      ).resolves.toBeUndefined();
    });
  });

  describe("schedule deadline", () => {
    it("rejects with RateLimiterTimeoutError when the deadline expires", async () => {
      const service = new RateLimiterService();
      service.deadlineMs = 50;

      // Drain the slow reservoir so the next job has nowhere to go.
      await service.syncFromHeaders(
        "europe",
        "match-by-id",
        new Headers({
          "X-App-Rate-Limit": "20:1,100:120",
          "X-App-Rate-Limit-Count": "0:1,100:120",
        })
      );

      const fn = vi.fn().mockResolvedValue("never");
      const error = await service
        .schedule("europe", "match-by-id", fn)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(RateLimiterTimeoutError);
      expect((error as RateLimiterTimeoutError).waitedMs).toBe(50);
      expect(fn).not.toHaveBeenCalled();
    });

    it("resolves normally when the job completes before the deadline", async () => {
      const service = new RateLimiterService();
      const result = await service.schedule("europe", "match-by-id", async () => "fast");
      expect(result).toBe("fast");
    });
  });

  describe("max concurrency", () => {
    it("caps in-flight jobs per regional cluster", async () => {
      const service = new RateLimiterService();

      let inFlight = 0;
      let peakInFlight = 0;
      let unblock: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        unblock = resolve;
      });

      const jobs = Array.from({ length: 12 }, () =>
        service.schedule("europe", "match-by-id", async () => {
          inFlight += 1;
          peakInFlight = Math.max(peakInFlight, inFlight);
          await gate;
          inFlight -= 1;
        })
      );

      // minTime: 50ms × 8 slots ≈ 400ms to fill the cap; wait 500ms to be safe.
      await new Promise((r) => setTimeout(r, 500));

      // Peak in-flight must never exceed our configured ceiling, even though
      // the reservoir (20) would otherwise allow more.
      expect(peakInFlight).toBe(8);

      unblock();
      await Promise.all(jobs);
    });
  });

  describe("getSnapshot", () => {
    it("returns app windows for every regional cluster with role + capacity", async () => {
      const service = new RateLimiterService();
      const snapshot = await service.getSnapshot();

      const regionals = Array.from(new Set(snapshot.app.map((entry) => entry.regional)));
      expect(regionals.sort()).toEqual(["americas", "asia", "europe", "sea"]);

      const europeFast = snapshot.app.find(
        (entry) => entry.regional === "europe" && entry.role === "fast"
      );
      const europeSlow = snapshot.app.find(
        (entry) => entry.regional === "europe" && entry.role === "slow"
      );
      expect(europeFast?.windowSec).toBe(1);
      expect(europeFast?.capacity).toBe(20);
      expect(europeSlow?.windowSec).toBe(120);
      expect(europeSlow?.capacity).toBe(100);
      expect(snapshot.method).toEqual([]);
      expect(snapshot.capturedAt).toMatch(/T.*Z$/);
    });

    it("includes method-limiter snapshots once a method has been scheduled", async () => {
      const service = new RateLimiterService();
      await service.schedule("europe", "match-by-id", async () => "ok");
      const snapshot = await service.getSnapshot();
      const entry = snapshot.method.find(
        (m) => m.regional === "europe" && m.family === "match-by-id"
      );
      expect(entry).toBeDefined();
      expect(entry?.capacity).toBeGreaterThan(0);
      expect(typeof entry?.reservoir === "number" || entry?.reservoir === null).toBe(
        true
      );
    });
  });

  describe("dumpCounters logging", () => {
    it("logs a counters block when an app window is busy or throttled", async () => {
      const service = new RateLimiterService();
      // Throttle the slow window so isThrottled() returns true.
      await service.syncFromHeaders(
        "europe",
        "match-by-id",
        new Headers({
          "X-App-Rate-Limit": "20:1,100:120",
          "X-App-Rate-Limit-Count": "1:1,90:120",
        })
      );

      const debug = vi
        .spyOn((service as unknown as { logger: { debug: () => void } }).logger, "debug")
        .mockImplementation(() => {});

      await (service as unknown as { dumpCounters: () => Promise<void> }).dumpCounters();

      expect(debug).toHaveBeenCalled();
      const call = debug.mock.calls[0] as unknown as [string];
      const message = call[0];
      expect(message).toContain("limiter counters:");
      expect(message).toContain("europe");
    });

    it("emits nothing when all windows are idle and unthrottled", async () => {
      const service = new RateLimiterService();
      const debug = vi
        .spyOn((service as unknown as { logger: { debug: () => void } }).logger, "debug")
        .mockImplementation(() => {});
      await (service as unknown as { dumpCounters: () => Promise<void> }).dumpCounters();
      expect(debug).not.toHaveBeenCalled();
    });
  });

  describe("onModuleDestroy", () => {
    it("clears the counter-dump interval", () => {
      const service = new RateLimiterService();
      const internal = service as unknown as {
        dumpInterval: ReturnType<typeof setInterval> | undefined;
      };
      expect(internal.dumpInterval).toBeDefined();
      service.onModuleDestroy();
      // After teardown the runtime no longer holds the interval; calling
      // again is a no-op (covers the !dumpInterval branch).
      service.onModuleDestroy();
    });
  });

  describe("parsePairs tolerance", () => {
    it("silently drops malformed rate-limit pairs", async () => {
      const service = new RateLimiterService();
      await expect(
        service.syncFromHeaders(
          "europe",
          "match-by-id",
          new Headers({
            "X-App-Rate-Limit": "garbage,20:0,abc:def,100:120",
            "X-App-Rate-Limit-Count": "1:1,90:120",
          })
        )
      ).resolves.toBeUndefined();

      // Only the well-formed 100:120 entry should have driven a sync.
      const slow = (service as unknown as Internals).appWindows
        .get("europe")
        ?.find((w) => w.windowSec === 120);
      expect(await slow?.limiter.currentReservoir()).toBe(10);
    });
  });
});
