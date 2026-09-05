import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { SyncJobRegistry } from "../sync-jobs/sync-job-registry.service";
import type { SteamAchievementSchemaService } from "./achievement-schema.service";
import type { SteamEnrichmentService } from "./enrichment.service";
import { SteamGameRefreshService } from "./game-refresh.service";
import type { SteamGlobalRarityService } from "./global-rarity.service";
import type { SteamOwnedGamesService } from "./owned-games.service";
import type { SteamPlayerUnlocksService } from "./player-unlocks.service";

const APPID = 1034140;

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function build(overrides: {
  owned?: { removedAt: Date | null } | null;
  playtimes?: (number | null)[];
  legs?: {
    refreshSchemas?: ReturnType<typeof vi.fn>;
    refreshUnlocksForGame?: ReturnType<typeof vi.fn>;
    refreshRarity?: ReturnType<typeof vi.fn>;
    enrichApps?: ReturnType<typeof vi.fn>;
    syncOwnedGames?: ReturnType<typeof vi.fn>;
  };
  achievementCount?: number | null;
}) {
  const playtimes = [...(overrides.playtimes ?? [120, 135])];
  const prisma = {
    steamOwnedGame: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          overrides.owned === undefined ? { removedAt: null } : overrides.owned
        ),
    },
    steamGameAchievementMeta: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          overrides.achievementCount === null
            ? null
            : { achievementCount: overrides.achievementCount ?? 52 }
        ),
    },
    steamPlaytimeSnapshot: {
      findFirst: vi.fn().mockImplementation(async () => {
        const minutes = playtimes.shift();
        return minutes === null || minutes === undefined
          ? null
          : { playtimeForeverMinutes: minutes };
      }),
    },
  };
  const legs = {
    refreshSchemas: vi
      .fn()
      .mockResolvedValue({ fetched: 1, withAchievements: 1, failed: 0 }),
    refreshUnlocksForGame: vi
      .fn()
      .mockResolvedValue({ checked: 1, newUnlocks: 2, privateOnSteam: 0, failed: 0 }),
    refreshRarity: vi.fn().mockResolvedValue({
      checked: 1,
      rowsWritten: 52,
      historyRowsAppended: 3,
      failed: 0,
    }),
    enrichApps: vi.fn().mockResolvedValue(1),
    syncOwnedGames: vi
      .fn()
      .mockResolvedValue({ added: [], persisted: [APPID], reappeared: [], removed: [] }),
    ...overrides.legs,
  };
  const jobs = new SyncJobRegistry();
  const service = new SteamGameRefreshService(
    prisma as unknown as PrismaService,
    jobs,
    { refreshSchemas: legs.refreshSchemas } as unknown as SteamAchievementSchemaService,
    {
      refreshUnlocksForGame: legs.refreshUnlocksForGame,
    } as unknown as SteamPlayerUnlocksService,
    { refreshRarity: legs.refreshRarity } as unknown as SteamGlobalRarityService,
    { enrichApps: legs.enrichApps } as unknown as SteamEnrichmentService,
    { syncOwnedGames: legs.syncOwnedGames } as unknown as SteamOwnedGamesService
  );
  return { service, legs, jobs };
}

describe("SteamGameRefreshService.refresh", () => {
  it("404s an appid outside the tracked library before touching Steam", async () => {
    const { service, legs } = build({ owned: null });
    await expect(service.refresh(APPID)).rejects.toBeInstanceOf(NotFoundException);
    expect(legs.refreshSchemas).not.toHaveBeenCalled();
  });

  it("404s a game the library has since dropped", async () => {
    const { service } = build({ owned: { removedAt: new Date() } });
    await expect(service.refresh(APPID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("runs the legs schema-first for that one appid and reports each one", async () => {
    const { service, legs, jobs } = build({});
    const order: string[] = [];
    for (const [name, fn] of Object.entries(legs)) {
      fn.mockImplementation(async () => {
        order.push(name);
        return legDefault(name);
      });
    }

    const result = await service.refresh(APPID);

    expect(order).toEqual([
      "refreshSchemas",
      "refreshUnlocksForGame",
      "refreshRarity",
      "enrichApps",
      "syncOwnedGames",
    ]);
    expect(legs.refreshSchemas).toHaveBeenCalledWith([APPID]);
    expect(legs.refreshUnlocksForGame).toHaveBeenCalledWith(APPID);
    expect(legs.refreshRarity).toHaveBeenCalledWith([APPID]);
    expect(legs.enrichApps).toHaveBeenCalledWith([APPID]);
    expect(result).toMatchObject({
      ran: true,
      appid: APPID,
      legs: {
        schema: { achievementCount: 52, failed: false },
        unlocks: { newUnlocks: 2, statsPrivate: false, failed: false },
        rarity: { rowsWritten: 52, failed: false },
        enrichment: { written: true, failed: false },
        playtime: { beforeMinutes: 120, afterMinutes: 135, failed: false },
      },
    });
    expect(
      jobs.getStatus().find((j) => j.name === "steam-game-refresh")?.lastRun
    ).toMatchObject({ outcome: "ok" });
  });

  // A failed schema fetch leaves no meta row behind; the rarity service stamps
  // that row unguarded, so the leg must not run for a schema-less game.
  it("skips the rarity leg when no schema landed and still reports the run", async () => {
    const { service, legs } = build({
      legs: {
        refreshSchemas: vi
          .fn()
          .mockResolvedValue({ fetched: 0, withAchievements: 0, failed: 1 }),
      },
      achievementCount: null,
    });
    const result = await service.refresh(APPID);
    expect(legs.refreshRarity).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ran: true,
      legs: {
        schema: { achievementCount: null, failed: true },
        rarity: { rowsWritten: 0, failed: false },
      },
    });
  });

  it("reports a per-app Steam refusal as private stats, not as a failure", async () => {
    const { service } = build({
      legs: {
        refreshUnlocksForGame: vi
          .fn()
          .mockResolvedValue({ checked: 1, newUnlocks: 0, privateOnSteam: 1, failed: 0 }),
      },
    });
    const result = await service.refresh(APPID);
    expect(result).toMatchObject({
      legs: { unlocks: { newUnlocks: 0, statsPrivate: true, failed: false } },
    });
  });

  it("keeps going when enrichment or the library snapshot throws, and says which leg failed", async () => {
    const { service } = build({
      legs: {
        enrichApps: vi.fn().mockRejectedValue(new Error("store down")),
        syncOwnedGames: vi.fn().mockRejectedValue(new Error("GetOwnedGames 503")),
      },
      playtimes: [120],
    });
    const result = await service.refresh(APPID);
    expect(result).toMatchObject({
      ran: true,
      legs: {
        enrichment: { written: false, failed: true },
        playtime: { beforeMinutes: 120, afterMinutes: 120, failed: true },
      },
    });
  });

  it("refuses a second refresh while one is in flight, whichever game it names", async () => {
    const gate = deferred();
    const { service } = build({
      legs: {
        refreshSchemas: vi
          .fn()
          .mockImplementation(() =>
            gate.promise.then(() => ({ fetched: 1, withAchievements: 1, failed: 0 }))
          ),
      },
    });
    const first = service.refresh(APPID);

    await expect(service.refresh(570)).resolves.toEqual({
      ran: false,
      reason: "already running",
    });

    gate.resolve();
    await expect(first).resolves.toMatchObject({ ran: true });
  });
});

function legDefault(name: string): unknown {
  switch (name) {
    case "refreshSchemas":
      return { fetched: 1, withAchievements: 1, failed: 0 };
    case "refreshUnlocksForGame":
      return { checked: 1, newUnlocks: 2, privateOnSteam: 0, failed: 0 };
    case "refreshRarity":
      return { checked: 1, rowsWritten: 52, historyRowsAppended: 3, failed: 0 };
    case "enrichApps":
      return 1;
    default:
      return { added: [], persisted: [APPID], reappeared: [], removed: [] };
  }
}
