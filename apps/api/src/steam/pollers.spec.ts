import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
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
        service as unknown as SteamPlayerUnlocksService
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
  function setup(opts: { candidates?: { appid: number }[] } = {}) {
    const prisma = {
      steamOwnedGame: {
        findMany: vi.fn().mockResolvedValue(opts.candidates ?? []),
      },
    };
    const service = { refreshRarity: vi.fn().mockResolvedValue(undefined) };
    return {
      poller: new SteamGlobalRarityPoller(
        prisma as unknown as PrismaService,
        service as unknown as SteamGlobalRarityService
      ),
      service,
    };
  }

  it("onModuleInit no-ops when nothing is unchecked", async () => {
    const { poller, service } = setup();
    await poller.onModuleInit();
    expect(service.refreshRarity).not.toHaveBeenCalled();
  });

  it("onModuleInit kicks off a backfill when candidates exist", async () => {
    const { poller, service } = setup({ candidates: [{ appid: 42 }] });
    await poller.onModuleInit();
    expect(service.refreshRarity).toHaveBeenCalledWith([42]);
  });

  it("tick refreshes rarity for every eligible appid", async () => {
    const { poller, service } = setup({ candidates: [{ appid: 42 }, { appid: 99 }] });
    await poller.tick();
    expect(service.refreshRarity).toHaveBeenCalledWith([42, 99]);
  });

  it("tick swallows errors raised by refreshRarity", async () => {
    const prisma = { steamOwnedGame: { findMany: vi.fn().mockResolvedValue([]) } };
    const service = {
      refreshRarity: vi.fn().mockRejectedValue(new Error("steam down")),
    };
    const poller = new SteamGlobalRarityPoller(
      prisma as unknown as PrismaService,
      service as unknown as SteamGlobalRarityService
    );
    await expect(poller.tick()).resolves.toBeUndefined();
  });
});

describe("SteamAchievementSchemaPoller", () => {
  function setup(opts: { candidates?: { appid: number }[] } = {}) {
    const prisma = {
      steamOwnedGame: {
        findMany: vi.fn().mockResolvedValue(opts.candidates ?? []),
      },
    };
    const service = { refreshSchemas: vi.fn().mockResolvedValue(undefined) };
    return {
      poller: new SteamAchievementSchemaPoller(
        prisma as unknown as PrismaService,
        service as unknown as SteamAchievementSchemaService
      ),
      service,
    };
  }

  it("onModuleInit no-ops when no apps are unchecked", async () => {
    const { poller, service } = setup();
    await poller.onModuleInit();
    expect(service.refreshSchemas).not.toHaveBeenCalled();
  });

  it("onModuleInit calls refreshSchemas with unchecked appids", async () => {
    const { poller, service } = setup({ candidates: [{ appid: 42 }] });
    await poller.onModuleInit();
    expect(service.refreshSchemas).toHaveBeenCalledWith([42]);
  });

  it("onModuleInit swallows errors from refreshSchemas", async () => {
    const prisma = {
      steamOwnedGame: { findMany: vi.fn().mockResolvedValue([{ appid: 42 }]) },
    };
    const service = {
      refreshSchemas: vi.fn().mockRejectedValue(new Error("steam down")),
    };
    const poller = new SteamAchievementSchemaPoller(
      prisma as unknown as PrismaService,
      service as unknown as SteamAchievementSchemaService
    );
    await expect(poller.onModuleInit()).resolves.toBeUndefined();
  });

  it("tick refreshes the schema for every owned appid", async () => {
    const { poller, service } = setup({ candidates: [{ appid: 1 }, { appid: 2 }] });
    await poller.tick();
    expect(service.refreshSchemas).toHaveBeenCalledWith([1, 2]);
  });

  it("tick swallows errors from refreshSchemas", async () => {
    const prisma = { steamOwnedGame: { findMany: vi.fn().mockResolvedValue([]) } };
    const service = {
      refreshSchemas: vi.fn().mockRejectedValue(new Error("steam down")),
    };
    const poller = new SteamAchievementSchemaPoller(
      prisma as unknown as PrismaService,
      service as unknown as SteamAchievementSchemaService
    );
    await expect(poller.tick()).resolves.toBeUndefined();
  });
});

describe("SteamTagPoller", () => {
  function setup(opts: { count?: number } = {}) {
    const prisma = { steamTag: { count: vi.fn().mockResolvedValue(opts.count ?? 0) } };
    const service = { syncTags: vi.fn().mockResolvedValue(undefined) };
    return {
      poller: new SteamTagPoller(
        prisma as unknown as PrismaService,
        service as unknown as SteamTagService
      ),
      service,
    };
  }

  it("onModuleInit pulls the catalog when the table is empty", async () => {
    const { poller, service } = setup({ count: 0 });
    await poller.onModuleInit();
    expect(service.syncTags).toHaveBeenCalled();
  });

  it("onModuleInit no-ops when the table is already populated", async () => {
    const { poller, service } = setup({ count: 1200 });
    await poller.onModuleInit();
    expect(service.syncTags).not.toHaveBeenCalled();
  });

  it("onModuleInit swallows errors from syncTags", async () => {
    const prisma = { steamTag: { count: vi.fn().mockResolvedValue(0) } };
    const service = { syncTags: vi.fn().mockRejectedValue(new Error("steam down")) };
    const poller = new SteamTagPoller(
      prisma as unknown as PrismaService,
      service as unknown as SteamTagService
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
      poller: new SteamPlayerStatePoller(service as unknown as SteamPlayerStateService),
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
