import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { SteamClientService } from "./steam-client.service";
import { SteamTagService } from "./tag.service";

interface PrismaStubs {
  steamTag: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

function makeService(
  prisma: PrismaStubs,
  tags: Array<{ tagid: number; name: string }>
): { service: SteamTagService; getTagList: ReturnType<typeof vi.fn> } {
  const getTagList = vi.fn().mockResolvedValue(tags);
  const client = { getTagList } as unknown as SteamClientService;
  return {
    service: new SteamTagService(prisma as unknown as PrismaService, client),
    getTagList,
  };
}

function makePrisma(): PrismaStubs {
  const stubs: PrismaStubs = {
    steamTag: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(stubs)),
  };
  return stubs;
}

describe("SteamTagService.syncTags", () => {
  it("skips the transaction when getTagList returns an empty array", async () => {
    const prisma = makePrisma();
    const { service } = makeService(prisma, []);

    await expect(service.syncTags()).resolves.toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.steamTag.upsert).not.toHaveBeenCalled();
  });

  it("upserts every tag inside a single transaction and returns the row count", async () => {
    const prisma = makePrisma();
    const { service } = makeService(prisma, [
      { tagid: 1625, name: "Platformer" },
      { tagid: 1628, name: "Metroidvania" },
    ]);

    await expect(service.syncTags()).resolves.toBe(2);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.steamTag.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.steamTag.upsert).toHaveBeenNthCalledWith(1, {
      where: { id: 1625 },
      create: { id: 1625, name: "Platformer" },
      update: { name: "Platformer" },
    });
  });
});

describe("SteamTagService.getCatalog", () => {
  it("returns an empty catalog with null lastSyncedAt when the table is empty", async () => {
    const prisma = makePrisma();
    const { service } = makeService(prisma, []);

    await expect(service.getCatalog()).resolves.toEqual({
      tags: [],
      lastSyncedAt: null,
    });
  });

  it("projects rows and derives lastSyncedAt from the most-recently-updated tag", async () => {
    const prisma = makePrisma();
    prisma.steamTag.findMany.mockResolvedValue([
      { id: 1625, name: "Platformer" },
      { id: 1628, name: "Metroidvania" },
    ]);
    const updatedAt = new Date("2026-05-15T12:00:00.000Z");
    prisma.steamTag.findFirst.mockResolvedValue({ updatedAt });
    const { service } = makeService(prisma, []);

    await expect(service.getCatalog()).resolves.toEqual({
      tags: [
        { id: 1625, name: "Platformer" },
        { id: 1628, name: "Metroidvania" },
      ],
      lastSyncedAt: updatedAt.toISOString(),
    });
    expect(prisma.steamTag.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  });
});
