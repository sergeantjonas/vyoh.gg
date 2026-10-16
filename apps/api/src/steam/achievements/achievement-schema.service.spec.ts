import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service";
import type { SteamClientService } from "../client/steam-client.service";
import type { SteamGameAchievementSchema } from "../client/types";
import { SteamAchievementSchemaService } from "./achievement-schema.service";

interface PrismaStubs {
  steamGameAchievement: {
    upsert: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  steamGameAchievementMeta: { upsert: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
}

function makePrisma(): PrismaStubs {
  const stubs: PrismaStubs = {
    steamGameAchievement: {
      upsert: vi.fn().mockResolvedValue(undefined),
      findMany: vi.fn().mockResolvedValue([]),
    },
    steamGameAchievementMeta: { upsert: vi.fn().mockResolvedValue(undefined) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(stubs)),
  };
  return stubs;
}

function makeService(
  prisma: PrismaStubs,
  getGameAchievementSchema: ReturnType<typeof vi.fn>
): SteamAchievementSchemaService {
  const client = { getGameAchievementSchema } as unknown as SteamClientService;
  return new SteamAchievementSchemaService(prisma as unknown as PrismaService, client);
}

function ach(apiName: string): SteamGameAchievementSchema {
  return {
    apiName,
    displayName: apiName,
    description: `${apiName} description`,
    iconUrl: `${apiName}.png`,
    iconGrayUrl: `${apiName}_gray.png`,
    hidden: false,
  };
}

describe("SteamAchievementSchemaService.refreshSchemas", () => {
  it("returns a zeroed result and makes no Steam calls when appids is empty", async () => {
    const prisma = makePrisma();
    const fetch = vi.fn();
    const result = await makeService(prisma, fetch).refreshSchemas([]);

    expect(result).toEqual({ fetched: 0, withAchievements: 0, failed: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("upserts each achievement and stamps a meta row with the count", async () => {
    const prisma = makePrisma();
    const fetch = vi.fn().mockResolvedValue([ach("A1"), ach("A2"), ach("A3")]);

    const result = await makeService(prisma, fetch).refreshSchemas([367520]);

    expect(result).toEqual({ fetched: 1, withAchievements: 1, failed: 0 });
    expect(prisma.steamGameAchievement.upsert).toHaveBeenCalledTimes(3);
    expect(prisma.steamGameAchievementMeta.upsert).toHaveBeenCalledOnce();
    expect(prisma.steamGameAchievementMeta.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { appid: 367520 },
        create: expect.objectContaining({ appid: 367520, achievementCount: 3 }),
        update: expect.objectContaining({ achievementCount: 3 }),
      })
    );
  });

  it("still writes a meta row with achievementCount=0 for schema-less games", async () => {
    const prisma = makePrisma();
    const fetch = vi.fn().mockResolvedValue([]);

    const result = await makeService(prisma, fetch).refreshSchemas([730]);

    // withAchievements counts only games with ≥1 achievement, so a 0-row
    // schema (CS2) shouldn't bump it.
    expect(result).toEqual({ fetched: 1, withAchievements: 0, failed: 0 });
    expect(prisma.steamGameAchievement.upsert).not.toHaveBeenCalled();
    expect(prisma.steamGameAchievementMeta.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ achievementCount: 0 }),
      })
    );
  });

  it("counts a single failure and continues to the next appid", async () => {
    const prisma = makePrisma();
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce([ach("A1")]);

    const result = await makeService(prisma, fetch).refreshSchemas([404, 367520]);

    expect(result).toEqual({ fetched: 1, withAchievements: 1, failed: 1 });
    expect(prisma.steamGameAchievement.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.steamGameAchievementMeta.upsert).toHaveBeenCalledOnce();
  });

  // A write failure used to throw out of the loop, so every appid queued
  // behind it kept its existing count — a stale zero among them gates that
  // game's unlock ingestion indefinitely.
  it("counts a failed write and still processes the remaining appids", async () => {
    const prisma = makePrisma();
    prisma.$transaction
      .mockRejectedValueOnce(new Error("deadlock"))
      .mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
    const fetch = vi.fn().mockResolvedValue([ach("A1")]);

    const result = await makeService(prisma, fetch).refreshSchemas([404, 367520]);

    expect(result).toEqual({ fetched: 1, withAchievements: 1, failed: 1 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(prisma.steamGameAchievementMeta.upsert).toHaveBeenCalledOnce();
  });
});

describe("SteamAchievementSchemaService.knownApiNames", () => {
  it("answers from the stored schema without asking Steam when every name is known", async () => {
    const prisma = makePrisma();
    prisma.steamGameAchievement.findMany.mockResolvedValue([
      { apiName: "A1" },
      { apiName: "A2" },
    ]);
    const fetch = vi.fn();

    const known = await makeService(prisma, fetch).knownApiNames(367520, ["A1"]);

    expect(known).toEqual(new Set(["A1", "A2"]));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refetches the game's schema when Steam names an achievement it lacks", async () => {
    const prisma = makePrisma();
    prisma.steamGameAchievement.findMany
      .mockResolvedValueOnce([{ apiName: "A1" }])
      .mockResolvedValueOnce([{ apiName: "A1" }, { apiName: "A2" }]);
    const fetch = vi.fn().mockResolvedValue([ach("A1"), ach("A2")]);

    const known = await makeService(prisma, fetch).knownApiNames(3564740, ["A1", "A2"]);

    expect(fetch).toHaveBeenCalledExactlyOnceWith(3564740);
    expect(prisma.steamGameAchievement.upsert).toHaveBeenCalledTimes(2);
    expect(known).toEqual(new Set(["A1", "A2"]));
  });

  it("returns without the name when the refetched schema still lacks it, and refetches once", async () => {
    const prisma = makePrisma();
    prisma.steamGameAchievement.findMany.mockResolvedValue([{ apiName: "A1" }]);
    const fetch = vi.fn().mockResolvedValue([ach("A1")]);

    const known = await makeService(prisma, fetch).knownApiNames(3564740, ["A1", "A2"]);

    expect(known).toEqual(new Set(["A1"]));
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("asks nothing when there are no names to check", async () => {
    const prisma = makePrisma();
    const fetch = vi.fn();

    expect(await makeService(prisma, fetch).knownApiNames(367520, [])).toEqual(new Set());
    expect(prisma.steamGameAchievement.findMany).not.toHaveBeenCalled();
  });
});
