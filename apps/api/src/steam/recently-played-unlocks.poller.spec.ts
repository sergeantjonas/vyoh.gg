import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { SteamAchievementSchemaService } from "./achievement-schema.service";
import type { SteamOwnedGamesService } from "./owned-games.service";
import type { SteamPlayerUnlocksService } from "./player-unlocks.service";
import { SteamRecentlyPlayedUnlocksPoller } from "./recently-played-unlocks.poller";
import type { SteamClientService } from "./steam-client.service";

function makePrisma() {
  return {
    steamOwnedGame: { findMany: vi.fn().mockResolvedValue([]) },
    steamGameAchievementMeta: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function makeClient() {
  return { getRecentlyPlayedGames: vi.fn().mockResolvedValue([]) };
}

function makeOwned() {
  return { syncOwnedGames: vi.fn().mockResolvedValue(undefined) };
}

function makeUnlocks() {
  return { refreshUnlocksForGame: vi.fn().mockResolvedValue(undefined) };
}

function makeSchema() {
  return { refreshSchemas: vi.fn().mockResolvedValue(undefined) };
}

function makePoller(
  prisma = makePrisma(),
  client = makeClient(),
  owned = makeOwned(),
  unlocks = makeUnlocks(),
  schema = makeSchema()
) {
  return {
    poller: new SteamRecentlyPlayedUnlocksPoller(
      prisma as unknown as PrismaService,
      client as unknown as SteamClientService,
      owned as unknown as SteamOwnedGamesService,
      unlocks as unknown as SteamPlayerUnlocksService,
      schema as unknown as SteamAchievementSchemaService
    ),
    prisma,
    client,
    owned,
    unlocks,
    schema,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SteamRecentlyPlayedUnlocksPoller.tick", () => {
  it("no-ops when no candidates have a positive playtime_2weeks", async () => {
    const client = makeClient();
    client.getRecentlyPlayedGames.mockResolvedValue([{ appid: 42, playtime_2weeks: 0 }]);
    const { poller, unlocks, owned } = makePoller(undefined, client);
    await poller.tick();
    expect(unlocks.refreshUnlocksForGame).not.toHaveBeenCalled();
    expect(owned.syncOwnedGames).not.toHaveBeenCalled();
  });

  it("triggers a full owned-games sync when an unknown appid appears", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    const client = makeClient();
    client.getRecentlyPlayedGames.mockResolvedValue([
      { appid: 42, playtime_2weeks: 10 },
      { appid: 99, playtime_2weeks: 5 },
    ]);
    const { poller, owned, unlocks } = makePoller(prisma, client);
    await poller.tick();
    expect(owned.syncOwnedGames).toHaveBeenCalled();
    expect(unlocks.refreshUnlocksForGame).toHaveBeenCalledTimes(2);
  });

  it("does NOT call syncOwnedGames when every recent appid is already known", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    const client = makeClient();
    client.getRecentlyPlayedGames.mockResolvedValue([{ appid: 42, playtime_2weeks: 10 }]);
    const { poller, owned, unlocks } = makePoller(prisma, client);
    await poller.tick();
    expect(owned.syncOwnedGames).not.toHaveBeenCalled();
    expect(unlocks.refreshUnlocksForGame).toHaveBeenCalledWith(42);
  });

  it("swallows errors from the proactive owned-games resync", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([]);
    const client = makeClient();
    client.getRecentlyPlayedGames.mockResolvedValue([{ appid: 99, playtime_2weeks: 5 }]);
    const owned = makeOwned();
    owned.syncOwnedGames.mockRejectedValue(new Error("api down"));
    const { poller } = makePoller(prisma, client, owned);
    await expect(poller.tick()).resolves.toBeUndefined();
  });

  it("swallows per-appid unlock refresh errors", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    const client = makeClient();
    client.getRecentlyPlayedGames.mockResolvedValue([{ appid: 42, playtime_2weeks: 10 }]);
    const unlocks = makeUnlocks();
    unlocks.refreshUnlocksForGame.mockRejectedValue(new Error("steam down"));
    const { poller } = makePoller(prisma, client, undefined, unlocks);
    await expect(poller.tick()).resolves.toBeUndefined();
  });

  it("skips an overlapping tick when a previous one is still mid-flight", async () => {
    const client = makeClient();
    const release: { fn: (() => void) | null } = { fn: null };
    client.getRecentlyPlayedGames.mockImplementation(
      () =>
        new Promise((resolve) => {
          release.fn = () => resolve([]);
        })
    );
    const { poller } = makePoller(undefined, client);
    const first = poller.tick();
    await new Promise((r) => setImmediate(r));
    await poller.tick();
    expect(client.getRecentlyPlayedGames).toHaveBeenCalledTimes(1);
    release.fn?.();
    await first;
  });

  it("re-checks the schema of a played game whose recorded achievement count is zero", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    prisma.steamGameAchievementMeta.findMany.mockResolvedValue([{ appid: 42 }]);
    const client = makeClient();
    client.getRecentlyPlayedGames.mockResolvedValue([{ appid: 42, playtime_2weeks: 10 }]);
    const { poller, schema, unlocks } = makePoller(prisma, client);
    await poller.tick();
    expect(schema.refreshSchemas).toHaveBeenCalledWith([42]);
    // The unlock refresh must run after the re-check, so a count that just
    // flipped 0 → N is picked up in the same tick rather than an hour later.
    expect(schema.refreshSchemas.mock.invocationCallOrder[0]).toBeLessThan(
      unlocks.refreshUnlocksForGame.mock.invocationCallOrder[0] as number
    );
  });

  it("leaves games with a known schema alone", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    prisma.steamGameAchievementMeta.findMany.mockResolvedValue([]);
    const client = makeClient();
    client.getRecentlyPlayedGames.mockResolvedValue([{ appid: 42, playtime_2weeks: 10 }]);
    const { poller, schema, unlocks } = makePoller(prisma, client);
    await poller.tick();
    expect(schema.refreshSchemas).not.toHaveBeenCalled();
    expect(unlocks.refreshUnlocksForGame).toHaveBeenCalledWith(42);
  });

  it("only re-checks zero-count rows last checked over a day ago", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    const client = makeClient();
    client.getRecentlyPlayedGames.mockResolvedValue([{ appid: 42, playtime_2weeks: 10 }]);
    const { poller } = makePoller(prisma, client);
    await poller.tick();
    const where = prisma.steamGameAchievementMeta.findMany.mock.calls[0]?.[0]?.where;
    expect(where.appid).toEqual({ in: [42] });
    expect(where.AND[0].OR).toEqual([
      { achievementCount: 0 },
      { achievementCount: null },
    ]);
    const cutoff = where.AND[1].OR[1].lastSchemaCheckedAt.lt as Date;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
  });

  it("still refreshes unlocks when the schema re-check fails", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    prisma.steamGameAchievementMeta.findMany.mockResolvedValue([{ appid: 42 }]);
    const client = makeClient();
    client.getRecentlyPlayedGames.mockResolvedValue([{ appid: 42, playtime_2weeks: 10 }]);
    const schema = makeSchema();
    schema.refreshSchemas.mockRejectedValue(new Error("steam down"));
    const { poller, unlocks } = makePoller(prisma, client, undefined, undefined, schema);
    await expect(poller.tick()).resolves.toBeUndefined();
    expect(unlocks.refreshUnlocksForGame).toHaveBeenCalledWith(42);
  });

  it("swallows top-level errors and clears the running flag for the next tick", async () => {
    const client = makeClient();
    client.getRecentlyPlayedGames.mockRejectedValueOnce(new Error("steam down"));
    const { poller } = makePoller(undefined, client);
    await expect(poller.tick()).resolves.toBeUndefined();
    // Next tick should run cleanly.
    await poller.tick();
    expect(client.getRecentlyPlayedGames).toHaveBeenCalledTimes(2);
  });
});
