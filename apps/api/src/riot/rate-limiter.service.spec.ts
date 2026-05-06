import { describe, expect, it, vi } from "vitest";
import { RateLimiterService } from "./rate-limiter.service";

describe("RateLimiterService", () => {
  it("schedules and resolves work via the regional limiter", async () => {
    const service = new RateLimiterService();
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await service.schedule("europe", fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("preserves errors thrown by the scheduled function", async () => {
    const service = new RateLimiterService();
    const error = new Error("boom");
    await expect(
      service.schedule("americas", async () => {
        throw error;
      })
    ).rejects.toBe(error);
  });

  it("provides independent limiters per regional cluster", async () => {
    const service = new RateLimiterService();
    const europe = service.schedule("europe", async () => "europe");
    const americas = service.schedule("americas", async () => "americas");
    expect(await europe).toBe("europe");
    expect(await americas).toBe("americas");
  });
});
