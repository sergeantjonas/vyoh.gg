import type Bottleneck from "bottleneck";
import { describe, expect, it, vi } from "vitest";
import { RateLimiterService } from "./rate-limiter.service";

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
});
