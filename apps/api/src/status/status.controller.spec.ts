import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { MatchEventsService } from "../lol/match-events.service";
import { MatchSyncService } from "../lol/match-sync.service";
import { RateLimiterService } from "../riot/rate-limiter.service";
import { StatusController } from "./status.controller";

async function buildController(stubs: {
  matchSync?: Partial<MatchSyncService>;
  rateLimiter?: Partial<RateLimiterService>;
  events?: Partial<MatchEventsService>;
}): Promise<StatusController> {
  const moduleRef = await Test.createTestingModule({
    controllers: [StatusController],
    providers: [
      { provide: MatchSyncService, useValue: stubs.matchSync ?? {} },
      { provide: RateLimiterService, useValue: stubs.rateLimiter ?? {} },
      { provide: MatchEventsService, useValue: stubs.events ?? {} },
    ],
  }).compile();
  return moduleRef.get(StatusController);
}

describe("StatusController", () => {
  it("snapshot() merges match-sync status with rate-limiter snapshot", async () => {
    const syncStatus = { enabled: true, lastTickAt: null };
    const rateLimiterSnapshot = { app: {}, methods: {} };
    const controller = await buildController({
      matchSync: { getStatus: vi.fn().mockReturnValue(syncStatus) },
      rateLimiter: { getSnapshot: vi.fn().mockResolvedValue(rateLimiterSnapshot) },
    });

    expect(await controller.snapshot()).toEqual({
      sync: syncStatus,
      rateLimiter: rateLimiterSnapshot,
    });
  });

  it("triggerSync() delegates to MatchSyncService.triggerNow", async () => {
    const triggerNow = vi.fn().mockReturnValue({ triggered: true });
    const controller = await buildController({ matchSync: { triggerNow } });

    expect(controller.triggerSync()).toEqual({ triggered: true });
    expect(triggerNow).toHaveBeenCalledOnce();
  });

  it("pauseSync() sets enabled to false on the sync service", async () => {
    const setEnabled = vi.fn().mockReturnValue({ enabled: false });
    const controller = await buildController({ matchSync: { setEnabled } });

    expect(controller.pauseSync()).toEqual({ enabled: false });
    expect(setEnabled).toHaveBeenCalledWith(false);
  });

  it("resumeSync() sets enabled to true on the sync service", async () => {
    const setEnabled = vi.fn().mockReturnValue({ enabled: true });
    const controller = await buildController({ matchSync: { setEnabled } });

    expect(controller.resumeSync()).toEqual({ enabled: true });
    expect(setEnabled).toHaveBeenCalledWith(true);
  });
});
