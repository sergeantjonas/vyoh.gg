import { describe, expect, it, vi } from "vitest";
import {
  SteamRateLimiterService,
  SteamRateLimiterTimeoutError,
} from "./rate-limiter.service";

describe("SteamRateLimiterService", () => {
  it("schedules and resolves work through the limiter", async () => {
    const service = new SteamRateLimiterService();
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await service.schedule("player-summaries", fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
    await service.onModuleDestroy();
  });

  it("preserves errors thrown by the scheduled function", async () => {
    const service = new SteamRateLimiterService();
    const error = new Error("boom");
    await expect(
      service.schedule("player-summaries", async () => {
        throw error;
      })
    ).rejects.toBe(error);
    await service.onModuleDestroy();
  });

  it("rejects with SteamRateLimiterTimeoutError when the deadline expires", async () => {
    const service = new SteamRateLimiterService();
    service.deadlineMs = 25;

    // Fill the limiter with a job that never resolves so the next schedule call
    // sits in the queue past the deadline.
    let releaseBlock: () => void = () => {};
    const block = new Promise<void>((resolve) => {
      releaseBlock = resolve;
    });
    // Each blocking job's outer schedule() also hits the 25ms deadline and
    // rejects — swallow those so they don't surface as unhandled rejections.
    const blockingJobs = Array.from({ length: 4 }, () =>
      service
        .schedule("player-summaries", async () => {
          await block;
        })
        .catch(() => {})
    );

    const fn = vi.fn().mockResolvedValue("never");
    const error = await service.schedule("player-summaries", fn).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SteamRateLimiterTimeoutError);
    expect((error as SteamRateLimiterTimeoutError).deadlineMs).toBe(25);
    expect(fn).not.toHaveBeenCalled();

    releaseBlock();
    await Promise.all(blockingJobs);
    await service.onModuleDestroy();
  });
});
