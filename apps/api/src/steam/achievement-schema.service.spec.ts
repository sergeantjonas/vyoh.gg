import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { SteamAchievementSchemaService } from "./achievement-schema.service";
import type { SteamClientService } from "./steam-client.service";
import type { SteamGameAchievementSchema } from "./types";

interface PrismaStubs {
  steamGameAchievement: { upsert: ReturnType<typeof vi.fn> };
  steamGameAchievementMeta: { upsert: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
}

function makePrisma(): PrismaStubs {
  const stubs: PrismaStubs = {
    steamGameAchievement: { upsert: vi.fn().mockResolvedValue(undefined) },
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
});
