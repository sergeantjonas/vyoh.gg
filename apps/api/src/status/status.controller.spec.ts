import { Test } from "@nestjs/testing";
import { EMPTY, type Observable, firstValueFrom } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "../auth/auth.service";
import { MatchEventsService } from "../lol/match-events.service";
import { MatchSyncService } from "../lol/match-sync.service";
import { PatchService } from "../lol/patch.service";
import { RateLimiterService } from "../riot/rate-limiter.service";
import { SyncJobRegistry } from "../sync-jobs/sync-job-registry.service";
import { StatusController } from "./status.controller";

async function buildController(stubs: {
  matchSync?: Partial<MatchSyncService>;
  rateLimiter?: Partial<RateLimiterService>;
  events?: Partial<MatchEventsService>;
  syncJobs?: Partial<SyncJobRegistry>;
  patches?: Partial<PatchService>;
}): Promise<StatusController> {
  const moduleRef = await Test.createTestingModule({
    controllers: [StatusController],
    providers: [
      { provide: MatchSyncService, useValue: stubs.matchSync ?? {} },
      { provide: RateLimiterService, useValue: stubs.rateLimiter ?? {} },
      { provide: MatchEventsService, useValue: stubs.events ?? {} },
      {
        provide: SyncJobRegistry,
        useValue: stubs.syncJobs ?? { getStatus: () => [] },
      },
      { provide: PatchService, useValue: stubs.patches ?? {} },
      // `OwnerGuard` on the writes injects this. The tests below call the
      // handlers directly, so the guard never runs — it only has to resolve for
      // the module to compile. Guard behaviour is owned by owner.guard.spec.ts
      // and its presence on these routes by conventions.spec.ts.
      { provide: AuthService, useValue: {} },
    ],
  }).compile();
  return moduleRef.get(StatusController);
}

describe("StatusController", () => {
  it("snapshot() merges match-sync status, cron jobs and the rate-limiter snapshot", async () => {
    const syncStatus = { enabled: true, lastTickAt: null };
    const rateLimiterSnapshot = { app: {}, methods: {} };
    const jobs = [
      {
        name: "steam-owned-games",
        stream: "steam",
        label: "Owned games",
        cron: "*/15 * * * *",
        running: false,
        lastRun: null,
      },
    ];
    const controller = await buildController({
      matchSync: { getStatus: vi.fn().mockReturnValue(syncStatus) },
      rateLimiter: { getSnapshot: vi.fn().mockResolvedValue(rateLimiterSnapshot) },
      syncJobs: { getStatus: vi.fn().mockReturnValue(jobs) },
    });

    expect(await controller.snapshot()).toEqual({
      sync: syncStatus,
      jobs,
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

  it("triggerPatchSync() delegates to PatchService.triggerSync", async () => {
    const job = {
      name: "lol-patch-notes",
      stream: "lol",
      label: "Patch notes",
      cron: "0 */6 * * *",
      running: true,
      lastRun: null,
    };
    const triggerSync = vi.fn().mockReturnValue({ triggered: true, job });
    const controller = await buildController({ patches: { triggerSync } });

    expect(controller.triggerPatchSync()).toEqual({ triggered: true, job });
    expect(triggerSync).toHaveBeenCalledOnce();
  });

  // The trigger reports rather than throws when the job is mid-run: the board
  // needs to say "already running", not surface a 500.
  it("triggerPatchSync() passes through a refused trigger", async () => {
    const job = {
      name: "lol-patch-notes",
      stream: "lol",
      label: "Patch notes",
      cron: "0 */6 * * *",
      running: true,
      lastRun: null,
    };
    const controller = await buildController({
      patches: {
        triggerSync: vi
          .fn()
          .mockReturnValue({ triggered: false, reason: "already running", job }),
      },
    });

    expect(controller.triggerPatchSync()).toMatchObject({
      triggered: false,
      reason: "already running",
    });
  });

  it("stream() emits an initial snapshot event without waiting for the interval", async () => {
    const syncStatus = { enabled: true, running: false, lastTick: null, history: [] };
    const rateLimiterSnapshot = { app: [], method: [], capturedAt: "now" };
    const controller = await buildController({
      matchSync: { getStatus: vi.fn().mockReturnValue(syncStatus) },
      rateLimiter: { getSnapshot: vi.fn().mockResolvedValue(rateLimiterSnapshot) },
      events: { forSyncTick: vi.fn().mockReturnValue(EMPTY) as () => Observable<never> },
    });

    const first = await firstValueFrom(controller.stream());
    expect(first.type).toBe("snapshot");
    expect(first.data).toEqual({
      sync: syncStatus,
      jobs: [],
      rateLimiter: rateLimiterSnapshot,
    });
  });
});

// The route is unauthenticated, takes no parameters, and nginx lets a
// connection sit open for an hour — so the per-subscriber cost is the whole
// exposure. Cold observables made every connection build its own 2-second
// timer and its own snapshot, each of which awaits every rate-limiter
// reservoir.
describe("StatusController.stream sharing", () => {
  function stubs(getSnapshot: ReturnType<typeof vi.fn>) {
    return {
      matchSync: {
        getStatus: vi.fn().mockReturnValue({
          enabled: true,
          running: false,
          lastTick: null,
          history: [],
        }),
      },
      rateLimiter: { getSnapshot } as unknown as Partial<RateLimiterService>,
      events: { forSyncTick: vi.fn().mockReturnValue(EMPTY) as () => Observable<never> },
    };
  }

  it("polls once for many concurrent subscribers, not once each", async () => {
    vi.useFakeTimers();
    try {
      const getSnapshot = vi.fn().mockResolvedValue({ app: [], method: [] });
      const controller = await buildController(stubs(getSnapshot));

      const subs = Array.from({ length: 5 }, () => controller.stream().subscribe());
      // Let the startWith(0) emission and its awaited snapshot settle.
      await vi.advanceTimersByTimeAsync(0);

      // Five subscribers, one poll — the assertion the old shape would fail
      // with five.
      expect(getSnapshot).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2_000);
      expect(getSnapshot).toHaveBeenCalledTimes(2);

      for (const s of subs) s.unsubscribe();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops polling once the last subscriber disconnects", async () => {
    vi.useFakeTimers();
    try {
      const getSnapshot = vi.fn().mockResolvedValue({ app: [], method: [] });
      const controller = await buildController(stubs(getSnapshot));

      const sub = controller.stream().subscribe();
      await vi.advanceTimersByTimeAsync(0);
      const whileConnected = getSnapshot.mock.calls.length;

      sub.unsubscribe();
      await vi.advanceTimersByTimeAsync(10_000);

      // An idle box should do no polling at all.
      expect(getSnapshot).toHaveBeenCalledTimes(whileConnected);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives a late subscriber a fresh snapshot rather than a replayed stale one", async () => {
    vi.useFakeTimers();
    try {
      let n = 0;
      const getSnapshot = vi.fn().mockImplementation(async () => ({ n: ++n }));
      const controller = await buildController(stubs(getSnapshot));

      const first = controller.stream().subscribe();
      await vi.advanceTimersByTimeAsync(0);
      first.unsubscribe();

      // refCount resets the buffer on the way down, so this must not receive
      // the snapshot captured for the previous connection.
      const seen: { rateLimiter?: unknown }[] = [];
      const second = controller
        .stream()
        .subscribe((e) => seen.push(e.data as { rateLimiter?: unknown }));
      await vi.advanceTimersByTimeAsync(0);

      expect(seen[0]?.rateLimiter).toEqual({ n: 2 });
      second.unsubscribe();
    } finally {
      vi.useRealTimers();
    }
  });
});
