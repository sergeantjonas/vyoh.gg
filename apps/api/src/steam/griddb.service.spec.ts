import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { SteamGridDbService } from "./griddb.service";

const ORIGINAL_KEY = process.env.STEAM_GRIDDB_API_KEY;

function mockJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Pass-through Prisma mock for findHero tests (which don't touch the DB).
// The backfillMissingHeroes tests construct their own per-case Prisma mocks.
const noopPrisma = {
  steamGameEnrichment: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaService;

beforeEach(() => {
  process.env.STEAM_GRIDDB_API_KEY = "sgdb-test-key";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.STEAM_GRIDDB_API_KEY = ORIGINAL_KEY;
});

describe("SteamGridDbService.findHero", () => {
  it("hits the heroes/steam/{appid} endpoint with the Bearer token", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockJson({
        success: true,
        data: [
          {
            id: 1,
            score: 10,
            width: 3840,
            height: 1240,
            nsfw: false,
            humor: false,
            epilepsy: false,
            url: "https://cdn2.steamgriddb.com/hero/abc.jpg",
          },
        ],
      })
    );

    const service = new SteamGridDbService(noopPrisma);
    const hero = await service.findHero(220);

    expect(hero).toEqual({
      url: "https://cdn2.steamgriddb.com/hero/abc.jpg",
      width: 3840,
      height: 1240,
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v2/heroes/steam/220"),
      expect.objectContaining({
        headers: { Authorization: "Bearer sgdb-test-key" },
      })
    );
  });

  it("picks the highest-scored row, tiebreaking by width desc", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockJson({
        success: true,
        data: [
          {
            id: 1,
            score: 5,
            width: 1920,
            height: 620,
            nsfw: false,
            humor: false,
            epilepsy: false,
            url: "https://cdn2.steamgriddb.com/hero/low-score.jpg",
          },
          {
            id: 2,
            score: 10,
            width: 1920,
            height: 620,
            nsfw: false,
            humor: false,
            epilepsy: false,
            url: "https://cdn2.steamgriddb.com/hero/winner-narrow.jpg",
          },
          {
            id: 3,
            score: 10,
            width: 3840,
            height: 1240,
            nsfw: false,
            humor: false,
            epilepsy: false,
            url: "https://cdn2.steamgriddb.com/hero/winner-wide.jpg",
          },
        ],
      })
    );

    const service = new SteamGridDbService(noopPrisma);
    const hero = await service.findHero(220);

    expect(hero?.url).toBe("https://cdn2.steamgriddb.com/hero/winner-wide.jpg");
  });

  it("rejects heroes below the 1920w minimum", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockJson({
        success: true,
        data: [
          {
            id: 1,
            score: 99,
            width: 1280,
            height: 414,
            nsfw: false,
            humor: false,
            epilepsy: false,
            url: "https://cdn2.steamgriddb.com/hero/too-small.jpg",
          },
        ],
      })
    );

    const service = new SteamGridDbService(noopPrisma);
    const hero = await service.findHero(220);
    expect(hero).toBeNull();
  });

  it("filters NSFW/humor/epilepsy rows even if the API didn't", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockJson({
        success: true,
        data: [
          {
            id: 1,
            score: 99,
            width: 3840,
            height: 1240,
            nsfw: true,
            humor: false,
            epilepsy: false,
            url: "https://cdn2.steamgriddb.com/hero/nsfw.jpg",
          },
          {
            id: 2,
            score: 1,
            width: 1920,
            height: 620,
            nsfw: false,
            humor: false,
            epilepsy: false,
            url: "https://cdn2.steamgriddb.com/hero/clean.jpg",
          },
        ],
      })
    );

    const service = new SteamGridDbService(noopPrisma);
    const hero = await service.findHero(220);
    expect(hero?.url).toBe("https://cdn2.steamgriddb.com/hero/clean.jpg");
  });

  it("returns null on 404 (unknown appid)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    const service = new SteamGridDbService(noopPrisma);
    const hero = await service.findHero(99999999);
    expect(hero).toBeNull();
  });

  it("returns null on non-2xx HTTP errors (auth / rate limit / 5xx)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 429 }));
    const service = new SteamGridDbService(noopPrisma);
    const hero = await service.findHero(220);
    expect(hero).toBeNull();
  });

  it("returns null on fetch rejection (network / abort)", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNRESET"));
    const service = new SteamGridDbService(noopPrisma);
    const hero = await service.findHero(220);
    expect(hero).toBeNull();
  });

  it("returns null on a malformed JSON response body", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<html>not json</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );
    const service = new SteamGridDbService(noopPrisma);
    const hero = await service.findHero(220);
    expect(hero).toBeNull();
  });

  it("returns null on success=false bodies", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockJson({ success: false, errors: ["rate limit"] })
    );
    const service = new SteamGridDbService(noopPrisma);
    const hero = await service.findHero(220);
    expect(hero).toBeNull();
  });

  it("returns null when data array is empty", async () => {
    vi.mocked(fetch).mockResolvedValue(mockJson({ success: true, data: [] }));
    const service = new SteamGridDbService(noopPrisma);
    const hero = await service.findHero(220);
    expect(hero).toBeNull();
  });

  it("short-circuits to null and never calls fetch when the API key is missing", async () => {
    process.env.STEAM_GRIDDB_API_KEY = "";
    const service = new SteamGridDbService(noopPrisma);
    const hero = await service.findHero(220);
    expect(hero).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

interface FakeRow {
  appid: number;
}

function makePrismaWithRows(candidateRows: FakeRow[]): {
  prisma: PrismaService;
  findMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(candidateRows);
  const update = vi.fn().mockResolvedValue({});
  const prisma = {
    steamGameEnrichment: { findMany, update },
  } as unknown as PrismaService;
  return { prisma, findMany, update };
}

function heroResponse(appid: number, score = 10, width = 3840, height = 1240): Response {
  return mockJson({
    success: true,
    data: [
      {
        id: appid,
        score,
        width,
        height,
        nsfw: false,
        humor: false,
        epilepsy: false,
        url: `https://cdn2.steamgriddb.com/hero/${appid}.jpg`,
      },
    ],
  });
}

describe("SteamGridDbService.backfillMissingHeroes", () => {
  it("returns 0 immediately when the input list is empty (no DB hit)", async () => {
    const { prisma, findMany } = makePrismaWithRows([]);
    const service = new SteamGridDbService(prisma);
    expect(await service.backfillMissingHeroes([])).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("queries Prisma for libraryHero2xPath=null rows with the cooldown filter", async () => {
    const { prisma, findMany } = makePrismaWithRows([]);
    const service = new SteamGridDbService(prisma);
    await service.backfillMissingHeroes([220, 221]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          appid: { in: [220, 221] },
          libraryHero2xPath: null,
          OR: expect.arrayContaining([
            { sgdbEnrichedAt: null },
            expect.objectContaining({
              sgdbEnrichedAt: expect.objectContaining({ lt: expect.any(Date) }),
            }),
          ]),
        }),
      })
    );
  });

  it("persists a found hero and advances the watermark", async () => {
    const { prisma, update } = makePrismaWithRows([{ appid: 220 }]);
    vi.mocked(fetch).mockResolvedValue(heroResponse(220));

    const service = new SteamGridDbService(prisma);
    const result = await service.backfillMissingHeroes([220]);

    expect(result).toBe(1);
    expect(update).toHaveBeenCalledWith({
      where: { appid: 220 },
      data: {
        sgdbHeroUrl: "https://cdn2.steamgriddb.com/hero/220.jpg",
        sgdbHeroWidth: 3840,
        sgdbHeroHeight: 1240,
        sgdbEnrichedAt: expect.any(Date),
      },
    });
  });

  it("advances the watermark even when SGDB returns no usable hero", async () => {
    // Without this, every retry would re-query SGDB for the same null set —
    // the watermark is the "we already checked" signal, not a result cache.
    const { prisma, update } = makePrismaWithRows([{ appid: 220 }]);
    vi.mocked(fetch).mockResolvedValue(mockJson({ success: true, data: [] }));

    const service = new SteamGridDbService(prisma);
    const result = await service.backfillMissingHeroes([220]);

    expect(result).toBe(0);
    expect(update).toHaveBeenCalledWith({
      where: { appid: 220 },
      data: {
        sgdbHeroUrl: null,
        sgdbHeroWidth: null,
        sgdbHeroHeight: null,
        sgdbEnrichedAt: expect.any(Date),
      },
    });
  });

  it("short-circuits without DB or HTTP calls when the API key is missing", async () => {
    process.env.STEAM_GRIDDB_API_KEY = "";
    const { prisma, findMany } = makePrismaWithRows([{ appid: 220 }]);
    const service = new SteamGridDbService(prisma);
    expect(await service.backfillMissingHeroes([220])).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("processes multiple rows and returns the count with a real hero", async () => {
    const { prisma, update } = makePrismaWithRows([
      { appid: 220 },
      { appid: 221 },
      { appid: 222 },
    ]);
    // 220 finds a hero, 221 finds nothing, 222 errors out — all three should
    // still get a watermark write.
    vi.mocked(fetch)
      .mockResolvedValueOnce(heroResponse(220))
      .mockResolvedValueOnce(mockJson({ success: true, data: [] }))
      .mockRejectedValueOnce(new Error("network"));

    const service = new SteamGridDbService(prisma);
    const result = await service.backfillMissingHeroes([220, 221, 222]);

    expect(result).toBe(1);
    expect(update).toHaveBeenCalledTimes(3);
  });
});
