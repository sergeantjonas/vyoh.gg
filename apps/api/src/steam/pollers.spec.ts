import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { SyncJobRegistry } from "../sync-jobs/sync-job-registry.service";
import { SteamAchievementSchemaPoller } from "./achievement-schema.poller";
import type { SteamAchievementSchemaService } from "./achievement-schema.service";
import { SteamGlobalRarityPoller } from "./global-rarity.poller";
import type { SteamGlobalRarityService } from "./global-rarity.service";
import { SteamPlayerStatePoller } from "./player-state.poller";
import type { SteamPlayerStateService } from "./player-state.service";
import { SteamPlayerUnlocksPoller } from "./player-unlocks.poller";
import type { SteamPlayerUnlocksService } from "./player-unlocks.service";
import { SteamTagPoller } from "./tag.poller";
import type { SteamTagService } from "./tag.service";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SteamPlayerUnlocksPoller", () => {
  function setup(
    opts: {
      candidates?: { appid: number }[];
      syncRejects?: Error | undefined;
    } = {}
  ) {
    const prisma = {
      steamOwnedGame: {
        findMany: vi.fn().mockResolvedValue(opts.candidates ?? []),
      },
    };
    const service = {
      syncUnlocks: opts.syncRejects
        ? vi.fn().mockRejectedValue(opts.syncRejects)
        : vi.fn().mockResolvedValue(undefined),
    };
    return {
      poller: new SteamPlayerUnlocksPoller(
        prisma as unknown as PrismaService,
        service as unknown as SteamPlayerUnlocksService,
        new SyncJobRegistry()
      ),
      prisma,
      service,
    };
  }

  it("onModuleInit no-ops when no apps need backfill", async () => {
    const { poller, service } = setup();
    await poller.onModuleInit();
    expect(service.syncUnlocks).not.toHaveBeenCalled();
  });

  it("onModuleInit calls syncUnlocks for boot candidates", async () => {
    const { poller, service } = setup({ candidates: [{ appid: 42 }] });
    await poller.onModuleInit();
    expect(service.syncUnlocks).toHaveBeenCalledWith([42]);
  });

  it("onModuleInit swallows syncUnlocks errors so boot is non-blocking", async () => {
    const { poller } = setup({
      candidates: [{ appid: 42 }],
      syncRejects: new Error("steam down"),
    });
    await expect(poller.onModuleInit()).resolves.toBeUndefined();
  });

  it("tick calls syncUnlocks with the full eligible appid set", async () => {
    const { poller, service } = setup({ candidates: [{ appid: 42 }, { appid: 99 }] });
    await poller.tick();
    expect(service.syncUnlocks).toHaveBeenCalledWith([42, 99]);
  });

  it("tick swallows syncUnlocks errors", async () => {
    const { poller } = setup({
      candidates: [{ appid: 42 }],
      syncRejects: new Error("steam down"),
    });
    await expect(poller.tick()).resolves.toBeUndefined();
  });
});

describe("SteamGlobalRarityPoller", () => {
  function setup(
    opts: {
      due?: { appid: number }[];
      launchDue?: { appid: number }[];
      launchWindow?: { appid: number }[];
    } = {}
  ) {
    const launchWindow = opts.launchWindow ?? [];
    // The launch query only runs when the library holds a launch-window title,
    // so the settled selection is the first meta call whenever it doesn't.
    const meta = vi.fn();
    if (launchWindow.length > 0) meta.mockResolvedValueOnce(opts.launchDue ?? []);
    meta.mockResolvedValue(opts.due ?? []);

    const prisma = {
      steamGameAchievementMeta: { findMany: meta },
      steamGameEnrichment: {
        findMany: vi.fn().mockResolvedValue(launchWindow),
      },
    };
    const service = { refreshRarity: vi.fn().mockResolvedValue(undefined) };
    return {
      poller: new SteamGlobalRarityPoller(
        prisma as unknown as PrismaService,
        service as unknown as SteamGlobalRarityService,
        new SyncJobRegistry()
      ),
      prisma,
      service,
    };
  }

  it("onModuleInit no-ops when nothing is due", async () => {
    const { poller, service } = setup();
    await poller.onModuleInit();
    expect(service.refreshRarity).not.toHaveBeenCalled();
  });

  it("onModuleInit refreshes due appids", async () => {
    const { poller, service } = setup({ due: [{ appid: 42 }] });
    await poller.onModuleInit();
    expect(service.refreshRarity).toHaveBeenCalledWith([42]);
  });

  it("tick refreshes rarity for every due appid", async () => {
    const { poller, service } = setup({ due: [{ appid: 42 }, { appid: 99 }] });
    await poller.tick();
    expect(service.refreshRarity).toHaveBeenCalledWith([42, 99]);
  });

  // Boot used to see only rows with no rarity check at all, so a row that had
  // been checked once and then gone stale was unreachable on a machine that
  // misses the Sunday fire.
  it("selects stale rows oldest-first, nulls ahead, bounded and schema-gated", async () => {
    const { poller, prisma } = setup({ due: [{ appid: 42 }] });
    await poller.onModuleInit();
    const args = prisma.steamGameAchievementMeta.findMany.mock.calls[0]?.[0];
    expect(args.where.achievementCount).toEqual({ gt: 0 });
    expect(args.where.game).toEqual({ removedAt: null });
    expect(args.orderBy).toEqual({
      lastRarityCheckedAt: { sort: "asc", nulls: "first" },
    });
    expect(args.take).toBe(40);
    const cutoff = args.where.OR[1].lastRarityCheckedAt.lt as Date;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });

  // A settled title moves ~0.1pp a week; a launch-window one moved 30pp in the
  // same span. Sampling both weekly records two points across the interesting
  // curve, and nothing can reconstruct it afterwards.
  it("polls launch-window titles against a one-day age, settled ones against a week", async () => {
    const { poller, prisma } = setup({
      launchWindow: [{ appid: 2001760 }],
      launchDue: [{ appid: 2001760 }],
      due: [{ appid: 42 }],
    });
    await poller.onModuleInit();

    const [launchArgs, settledArgs] =
      prisma.steamGameAchievementMeta.findMany.mock.calls.map((c) => c[0]);

    const launchCutoff = launchArgs.where.OR[1].lastRarityCheckedAt.lt as Date;
    expect(Date.now() - launchCutoff.getTime()).toBeGreaterThanOrEqual(
      24 * 60 * 60 * 1000
    );
    expect(Date.now() - launchCutoff.getTime()).toBeLessThan(2 * 24 * 60 * 60 * 1000);

    const settledCutoff = settledArgs.where.OR[1].lastRarityCheckedAt.lt as Date;
    expect(Date.now() - settledCutoff.getTime()).toBeGreaterThanOrEqual(
      7 * 24 * 60 * 60 * 1000
    );
  });

  it("splits the two cohorts so neither can select the other's games", async () => {
    const { poller, prisma } = setup({
      launchWindow: [{ appid: 2001760 }],
      launchDue: [{ appid: 2001760 }],
      due: [{ appid: 42 }],
    });
    await poller.onModuleInit();

    const [launchArgs, settledArgs] =
      prisma.steamGameAchievementMeta.findMany.mock.calls.map((c) => c[0]);
    expect(launchArgs.where.appid).toEqual({ in: [2001760] });
    expect(settledArgs.where.appid).toEqual({ notIn: [2001760] });
  });

  // Draining a merged set oldest-first would sort a daily-polled launch title
  // behind every weekly one, since its timestamp is the newer of the two.
  it("drains launch-window titles ahead of the settled backlog", async () => {
    const { poller, service } = setup({
      launchWindow: [{ appid: 2001760 }],
      launchDue: [{ appid: 2001760 }],
      due: [{ appid: 42 }, { appid: 99 }],
    });
    await poller.onModuleInit();
    expect(service.refreshRarity).toHaveBeenCalledWith([2001760, 42, 99]);
  });

  it("leaves the settled pass only the slots the launch cohort did not take", async () => {
    const launchDue = Array.from({ length: 6 }, (_, i) => ({ appid: 900 + i }));
    const { poller, prisma } = setup({
      launchWindow: launchDue,
      launchDue,
      due: [{ appid: 42 }],
    });
    await poller.onModuleInit();

    const [launchArgs, settledArgs] =
      prisma.steamGameAchievementMeta.findMany.mock.calls.map((c) => c[0]);
    expect(launchArgs.take).toBe(40);
    expect(settledArgs.take).toBe(34);
  });

  // The empty-cohort case is the dangerous one: an unfiltered query at the
  // 24-hour cutoff would put every game in the library on a daily poll.
  it("skips the launch query entirely when no title is inside the window", async () => {
    const { poller, prisma } = setup({ launchWindow: [], due: [{ appid: 42 }] });
    await poller.onModuleInit();

    expect(prisma.steamGameAchievementMeta.findMany).toHaveBeenCalledTimes(1);
    const args = prisma.steamGameAchievementMeta.findMany.mock.calls[0]?.[0];
    expect(args.where.appid).toBeUndefined();
    const cutoff = args.where.OR[1].lastRarityCheckedAt.lt as Date;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });

  it("asks for launch-window games by release date, not by name or age of check", async () => {
    const { poller, prisma } = setup({ launchWindow: [{ appid: 2001760 }] });
    await poller.onModuleInit();
    const args = prisma.steamGameEnrichment.findMany.mock.calls[0]?.[0];
    const cutoff = args.where.releaseDate.gte as Date;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(
      60 * 24 * 60 * 60 * 1000
    );
  });

  it("onModuleInit swallows errors raised by refreshRarity", async () => {
    const { poller, service } = setup({ due: [{ appid: 42 }] });
    service.refreshRarity.mockRejectedValue(new Error("steam down"));
    await expect(poller.onModuleInit()).resolves.toBeUndefined();
  });

  it("tick swallows errors raised by refreshRarity", async () => {
    const { poller, service } = setup({ due: [{ appid: 42 }] });
    service.refreshRarity.mockRejectedValue(new Error("steam down"));
    await expect(poller.tick()).resolves.toBeUndefined();
  });

  it("skips an overlapping tick when a previous one is still mid-flight", async () => {
    const { poller, service } = setup({ due: [{ appid: 42 }] });
    const release: { fn: (() => void) | null } = { fn: null };
    service.refreshRarity.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release.fn = () => resolve();
        })
    );
    const first = poller.tick();
    await new Promise((r) => setImmediate(r));
    await poller.tick();
    expect(service.refreshRarity).toHaveBeenCalledTimes(1);
    release.fn?.();
    await first;
  });
});

describe("SteamAchievementSchemaPoller", () => {
  function setup(
    opts: { unchecked?: { appid: number }[]; stale?: { appid: number }[] } = {}
  ) {
    const prisma = {
      steamOwnedGame: {
        findMany: vi.fn().mockResolvedValue(opts.unchecked ?? []),
      },
      steamGameAchievementMeta: {
        findMany: vi.fn().mockResolvedValue(opts.stale ?? []),
      },
    };
    const service = { refreshSchemas: vi.fn().mockResolvedValue(undefined) };
    return {
      poller: new SteamAchievementSchemaPoller(
        prisma as unknown as PrismaService,
        service as unknown as SteamAchievementSchemaService,
        new SyncJobRegistry()
      ),
      prisma,
      service,
    };
  }

  it("onModuleInit no-ops when nothing is due", async () => {
    const { poller, service } = setup();
    await poller.onModuleInit();
    expect(service.refreshSchemas).not.toHaveBeenCalled();
  });

  it("onModuleInit refreshes never-checked appids ahead of stale ones", async () => {
    const { poller, service } = setup({
      unchecked: [{ appid: 42 }],
      stale: [{ appid: 7 }, { appid: 9 }],
    });
    await poller.onModuleInit();
    expect(service.refreshSchemas).toHaveBeenCalledWith([42, 7, 9]);
  });

  // The point of the conversion: boot is the pass that actually runs on a
  // machine that is not up at 05:00, so it has to reach stale rows rather
  // than only rows with no meta at all.
  it("onModuleInit picks up stale rows, not only never-checked ones", async () => {
    const { poller, service } = setup({ stale: [{ appid: 7 }] });
    await poller.onModuleInit();
    expect(service.refreshSchemas).toHaveBeenCalledWith([7]);
  });

  it("selects stale rows oldest-first with nulls ahead of them", async () => {
    const { poller, prisma } = setup({ stale: [{ appid: 7 }] });
    await poller.tick();
    const args = prisma.steamGameAchievementMeta.findMany.mock.calls[0]?.[0];
    expect(args.orderBy).toEqual({
      lastSchemaCheckedAt: { sort: "asc", nulls: "first" },
    });
    const cutoff = args.where.OR[1].lastSchemaCheckedAt.lt as Date;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });

  it("spends the remainder of the batch cap on stale rows", async () => {
    const unchecked = Array.from({ length: 12 }, (_, i) => ({ appid: i }));
    const { poller, prisma } = setup({ unchecked });
    await poller.tick();
    expect(prisma.steamOwnedGame.findMany.mock.calls[0]?.[0]?.take).toBe(40);
    expect(prisma.steamGameAchievementMeta.findMany.mock.calls[0]?.[0]?.take).toBe(28);
  });

  it("skips the stale query when never-checked rows already fill the cap", async () => {
    const unchecked = Array.from({ length: 40 }, (_, i) => ({ appid: i }));
    const { poller, prisma, service } = setup({ unchecked });
    await poller.tick();
    expect(prisma.steamGameAchievementMeta.findMany).not.toHaveBeenCalled();
    expect(service.refreshSchemas).toHaveBeenCalledWith(unchecked.map((g) => g.appid));
  });

  it("onModuleInit swallows errors from refreshSchemas", async () => {
    const { poller, service } = setup({ unchecked: [{ appid: 42 }] });
    service.refreshSchemas.mockRejectedValue(new Error("steam down"));
    await expect(poller.onModuleInit()).resolves.toBeUndefined();
  });

  it("tick swallows errors from refreshSchemas", async () => {
    const { poller, service } = setup({ unchecked: [{ appid: 42 }] });
    service.refreshSchemas.mockRejectedValue(new Error("steam down"));
    await expect(poller.tick()).resolves.toBeUndefined();
  });

  it("skips an overlapping tick when a previous one is still mid-flight", async () => {
    const { poller, service } = setup({ unchecked: [{ appid: 42 }] });
    const release: { fn: (() => void) | null } = { fn: null };
    service.refreshSchemas.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release.fn = () => resolve();
        })
    );
    const first = poller.tick();
    await new Promise((r) => setImmediate(r));
    await poller.tick();
    expect(service.refreshSchemas).toHaveBeenCalledTimes(1);
    release.fn?.();
    await first;
  });
});

describe("SteamTagPoller", () => {
  function setup(opts: { ageDays?: number | null } = {}) {
    const age = opts.ageDays === undefined ? null : opts.ageDays;
    const prisma = {
      steamTag: {
        findFirst: vi
          .fn()
          .mockResolvedValue(
            age === null ? null : { updatedAt: new Date(Date.now() - age * 86_400_000) }
          ),
      },
    };
    const service = { syncTags: vi.fn().mockResolvedValue(undefined) };
    return {
      poller: new SteamTagPoller(
        prisma as unknown as PrismaService,
        service as unknown as SteamTagService,
        new SyncJobRegistry()
      ),
      service,
    };
  }

  it("onModuleInit pulls the catalog when the table is empty", async () => {
    const { poller, service } = setup({ ageDays: null });
    await poller.onModuleInit();
    expect(service.syncTags).toHaveBeenCalled();
  });

  it("onModuleInit no-ops when the catalog is populated and fresh", async () => {
    const { poller, service } = setup({ ageDays: 3 });
    await poller.onModuleInit();
    expect(service.syncTags).not.toHaveBeenCalled();
  });

  // The failure this replaced: a populated-but-stale catalog had no path back,
  // because boot returned early on row count and the monthly cron that would
  // have refreshed it is the one that already didn't fire.
  it("onModuleInit refreshes a populated catalog older than the cron interval", async () => {
    const { poller, service } = setup({ ageDays: 45 });
    await poller.onModuleInit();
    expect(service.syncTags).toHaveBeenCalled();
  });

  it("onModuleInit swallows errors from syncTags", async () => {
    const prisma = { steamTag: { findFirst: vi.fn().mockResolvedValue(null) } };
    const service = { syncTags: vi.fn().mockRejectedValue(new Error("steam down")) };
    const poller = new SteamTagPoller(
      prisma as unknown as PrismaService,
      service as unknown as SteamTagService,
      new SyncJobRegistry()
    );
    await expect(poller.onModuleInit()).resolves.toBeUndefined();
  });

  it("tick calls syncTags and swallows errors", async () => {
    const { poller, service } = setup();
    await poller.tick();
    expect(service.syncTags).toHaveBeenCalled();

    service.syncTags.mockRejectedValueOnce(new Error("steam down"));
    await expect(poller.tick()).resolves.toBeUndefined();
  });
});

describe("SteamPlayerStatePoller", () => {
  function setup() {
    const service = { syncPlayerState: vi.fn().mockResolvedValue(undefined) };
    return {
      poller: new SteamPlayerStatePoller(
        service as unknown as SteamPlayerStateService,
        new SyncJobRegistry()
      ),
      service,
    };
  }

  it("onModuleInit calls syncPlayerState", async () => {
    const { poller, service } = setup();
    await poller.onModuleInit();
    expect(service.syncPlayerState).toHaveBeenCalled();
  });

  it("onModuleInit swallows syncPlayerState errors", async () => {
    const { poller, service } = setup();
    service.syncPlayerState.mockRejectedValueOnce(new Error("steam down"));
    await expect(poller.onModuleInit()).resolves.toBeUndefined();
  });

  it("tick calls syncPlayerState and swallows errors", async () => {
    const { poller, service } = setup();
    await poller.tick();
    expect(service.syncPlayerState).toHaveBeenCalled();

    service.syncPlayerState.mockRejectedValueOnce(new Error("steam down"));
    await expect(poller.tick()).resolves.toBeUndefined();
  });
});
