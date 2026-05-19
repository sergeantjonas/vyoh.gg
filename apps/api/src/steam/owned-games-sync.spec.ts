import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { SteamAchievementSchemaService } from "./achievement-schema.service";
import type { SteamEnrichmentService } from "./enrichment.service";
import type { SteamGlobalRarityService } from "./global-rarity.service";
import { SteamOwnedGamesService } from "./owned-games.service";
import type { SteamPlayerUnlocksService } from "./player-unlocks.service";
import type { SteamClientService } from "./steam-client.service";

function makeService(opts: {
  ownedGames?: Array<{
    appid: number;
    name: string;
    playtime_forever: number;
    rtime_last_played?: number;
  }>;
  previous?: Array<{ appid: number; removedAt: Date | null }>;
  withSchema?: Array<{ appid: number }>;
}) {
  const tx = {
    steamOwnedGame: {
      upsert: vi.fn().mockResolvedValue(undefined),
      updateMany: vi.fn().mockResolvedValue(undefined),
    },
    steamPlaytimeSnapshot: { upsert: vi.fn().mockResolvedValue(undefined) },
  };
  const prisma = {
    steamOwnedGame: {
      findMany: vi.fn().mockResolvedValue(opts.previous ?? []),
    },
    steamGameAchievementMeta: {
      findMany: vi.fn().mockResolvedValue(opts.withSchema ?? []),
    },
    $transaction: vi
      .fn()
      .mockImplementation(async (cb: (t: unknown) => Promise<void>) => {
        await cb(tx);
      }),
  };
  const client = {
    getOwnedGames: vi.fn().mockResolvedValue(opts.ownedGames ?? []),
  };
  const enrichment = { enrichApps: vi.fn().mockResolvedValue(undefined) };
  const schema = { refreshSchemas: vi.fn().mockResolvedValue(undefined) };
  const unlocks = { syncUnlocks: vi.fn().mockResolvedValue(undefined) };
  const rarity = { refreshRarity: vi.fn().mockResolvedValue(undefined) };

  return {
    service: new SteamOwnedGamesService(
      prisma as unknown as PrismaService,
      client as unknown as SteamClientService,
      enrichment as unknown as SteamEnrichmentService,
      schema as unknown as SteamAchievementSchemaService,
      unlocks as unknown as SteamPlayerUnlocksService,
      rarity as unknown as SteamGlobalRarityService
    ),
    tx,
    prisma,
    client,
    enrichment,
    schema,
    unlocks,
    rarity,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SteamOwnedGamesService.syncOwnedGames", () => {
  it("upserts each owned game inside the transaction", async () => {
    const { service, tx } = makeService({
      ownedGames: [
        { appid: 42, name: "Half-Life", playtime_forever: 100, rtime_last_played: 0 },
      ],
    });
    await service.syncOwnedGames();
    expect(tx.steamOwnedGame.upsert).toHaveBeenCalled();
    expect(tx.steamPlaytimeSnapshot.upsert).toHaveBeenCalled();
  });

  it("marks removed appids with removedAt=now via updateMany", async () => {
    const { service, tx } = makeService({
      ownedGames: [],
      previous: [{ appid: 42, removedAt: null }],
    });
    await service.syncOwnedGames();
    expect(tx.steamOwnedGame.updateMany).toHaveBeenCalled();
  });

  it("bootstraps enrichment + schema + unlocks + rarity for newly-added apps", async () => {
    const { service, enrichment, schema, unlocks, rarity } = makeService({
      ownedGames: [{ appid: 42, name: "Half-Life", playtime_forever: 100 }],
      previous: [],
      withSchema: [{ appid: 42 }],
    });
    await service.syncOwnedGames();
    expect(enrichment.enrichApps).toHaveBeenCalledWith([42]);
    expect(schema.refreshSchemas).toHaveBeenCalledWith([42]);
    expect(unlocks.syncUnlocks).toHaveBeenCalledWith([42]);
    expect(rarity.refreshRarity).toHaveBeenCalledWith([42]);
  });

  it("does NOT call syncUnlocks/refreshRarity when no newly-added apps have a schema", async () => {
    const { service, unlocks, rarity } = makeService({
      ownedGames: [{ appid: 42, name: "Game", playtime_forever: 100 }],
      previous: [],
      withSchema: [],
    });
    await service.syncOwnedGames();
    expect(unlocks.syncUnlocks).not.toHaveBeenCalled();
    expect(rarity.refreshRarity).not.toHaveBeenCalled();
  });

  it("swallows enrichment failures so the sync still reports the diff", async () => {
    const { service, enrichment } = makeService({
      ownedGames: [{ appid: 42, name: "Game", playtime_forever: 100 }],
      previous: [],
    });
    enrichment.enrichApps.mockRejectedValue(new Error("steam down"));
    const diff = await service.syncOwnedGames();
    expect(diff.added).toContain(42);
  });

  it("swallows schema bootstrap failures", async () => {
    const { service, schema } = makeService({
      ownedGames: [{ appid: 42, name: "Game", playtime_forever: 100 }],
      previous: [],
    });
    schema.refreshSchemas.mockRejectedValue(new Error("steam down"));
    await expect(service.syncOwnedGames()).resolves.toMatchObject({ added: [42] });
  });

  it("swallows unlock + rarity bootstrap failures", async () => {
    const { service, unlocks, rarity } = makeService({
      ownedGames: [{ appid: 42, name: "Game", playtime_forever: 100 }],
      previous: [],
      withSchema: [{ appid: 42 }],
    });
    unlocks.syncUnlocks.mockRejectedValue(new Error("steam down"));
    rarity.refreshRarity.mockRejectedValue(new Error("steam down"));
    await expect(service.syncOwnedGames()).resolves.toMatchObject({ added: [42] });
  });

  it("stores rtimeLastPlayed as null when the epoch is 0 (never launched)", async () => {
    const { service, tx } = makeService({
      ownedGames: [
        { appid: 42, name: "Never Played", playtime_forever: 0, rtime_last_played: 0 },
      ],
    });
    await service.syncOwnedGames();
    const upsertCall = tx.steamOwnedGame.upsert.mock.calls[0]?.[0] as
      | { create: { rtimeLastPlayed: Date | null } }
      | undefined;
    expect(upsertCall?.create.rtimeLastPlayed).toBeNull();
  });

  it("stores rtimeLastPlayed as a Date when the epoch is positive", async () => {
    const { service, tx } = makeService({
      ownedGames: [
        {
          appid: 42,
          name: "Played",
          playtime_forever: 60,
          rtime_last_played: 1_700_000_000,
        },
      ],
    });
    await service.syncOwnedGames();
    const upsertCall = tx.steamOwnedGame.upsert.mock.calls[0]?.[0] as
      | { create: { rtimeLastPlayed: Date | null } }
      | undefined;
    expect(upsertCall?.create.rtimeLastPlayed).toBeInstanceOf(Date);
  });
});
