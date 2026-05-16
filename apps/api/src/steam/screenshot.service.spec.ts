import { NotFoundException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { SteamRateLimiterService } from "./rate-limiter.service";
import { SteamScreenshotService, projectScreenshots } from "./screenshot.service";

interface PrismaStubs {
  steamOwnedGame: { findUnique: ReturnType<typeof vi.fn> };
  steamGameEnrichment: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
}

function makePrisma(): PrismaStubs {
  return {
    steamOwnedGame: { findUnique: vi.fn() },
    steamGameEnrichment: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue(undefined),
    },
  };
}

// Run the rate-limited callback inline so the service-under-test code path is
// unchanged but no real reservoir bookkeeping is involved.
function makeLimiter(): SteamRateLimiterService {
  return {
    schedule: vi.fn(async (_family: string, fn: () => Promise<unknown>) => fn()),
  } as unknown as SteamRateLimiterService;
}

function makeService(prisma: PrismaStubs): SteamScreenshotService {
  return new SteamScreenshotService(prisma as unknown as PrismaService, makeLimiter());
}

describe("projectScreenshots", () => {
  it("maps raw appdetails screenshots to thumb/full URLs", () => {
    expect(
      projectScreenshots([
        {
          id: 0,
          path_thumbnail: "https://cdn.example.com/0/thumb.jpg",
          path_full: "https://cdn.example.com/0/full.jpg",
        },
      ])
    ).toEqual([
      {
        thumbUrl: "https://cdn.example.com/0/thumb.jpg",
        fullUrl: "https://cdn.example.com/0/full.jpg",
      },
    ]);
  });

  it("caps the projected list at MAX_SCREENSHOTS (6)", () => {
    const raw = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      path_thumbnail: `t${i}`,
      path_full: `f${i}`,
    }));
    expect(projectScreenshots(raw)).toHaveLength(6);
  });
});

describe("SteamScreenshotService.getGameMedia", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  function stubAppdetails(appid: number, screenshots: Array<{ id: number }>) {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        [String(appid)]: {
          success: true,
          data: {
            screenshots: screenshots.map((s) => ({
              id: s.id,
              path_thumbnail: `thumb-${s.id}`,
              path_full: `full-${s.id}`,
            })),
          },
        },
      }),
    } as Response);
  }

  it("throws NotFoundException when the appid is not owned", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findUnique.mockResolvedValue(null);

    await expect(makeService(prisma).getGameMedia(404)).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prisma.steamGameEnrichment.findUnique).not.toHaveBeenCalled();
  });

  it("fetches from Steam and persists when no enrichment row exists yet", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findUnique.mockResolvedValue({ appid: 367520 });
    prisma.steamGameEnrichment.findUnique.mockResolvedValue(null);
    stubAppdetails(367520, [{ id: 1 }, { id: 2 }]);

    const media = await makeService(prisma).getGameMedia(367520);

    expect(global.fetch).toHaveBeenCalledOnce();
    expect(media.screenshots).toHaveLength(2);
    expect(media.screenshots[0]).toEqual({ thumbUrl: "thumb-1", fullUrl: "full-1" });
    expect(prisma.steamGameEnrichment.upsert).toHaveBeenCalledOnce();
  });

  it("fetches from Steam when the enrichment row has never had screenshots", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findUnique.mockResolvedValue({ appid: 367520 });
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      screenshots: null,
      screenshotsFetchedAt: null,
    });
    stubAppdetails(367520, [{ id: 1 }]);

    await makeService(prisma).getGameMedia(367520);

    expect(global.fetch).toHaveBeenCalledOnce();
    expect(prisma.steamGameEnrichment.upsert).toHaveBeenCalledOnce();
  });

  it("serves cached screenshots and skips the network when within the TTL", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findUnique.mockResolvedValue({ appid: 367520 });
    const fetchedAt = new Date(Date.now() - 1_000 * 60 * 60); // 1h ago
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      screenshots: [{ thumbUrl: "cached-thumb", fullUrl: "cached-full" }],
      screenshotsFetchedAt: fetchedAt,
    });

    const media = await makeService(prisma).getGameMedia(367520);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(media).toEqual({
      appid: 367520,
      screenshots: [{ thumbUrl: "cached-thumb", fullUrl: "cached-full" }],
      fetchedAt: fetchedAt.toISOString(),
    });
  });

  it("serves cached + triggers a background refresh once past the 30-day TTL", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findUnique.mockResolvedValue({ appid: 367520 });
    const staleFetchedAt = new Date(Date.now() - 1_000 * 60 * 60 * 24 * 45); // 45d ago
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      screenshots: [{ thumbUrl: "stale-thumb", fullUrl: "stale-full" }],
      screenshotsFetchedAt: staleFetchedAt,
    });
    stubAppdetails(367520, [{ id: 9 }]);

    const media = await makeService(prisma).getGameMedia(367520);

    // Caller still sees the stale rows immediately — refresh is fire-and-forget.
    expect(media.screenshots).toEqual([
      { thumbUrl: "stale-thumb", fullUrl: "stale-full" },
    ]);

    // Allow the background refresh microtask to settle.
    await vi.waitFor(() => {
      expect(global.fetch).toHaveBeenCalledOnce();
      expect(prisma.steamGameEnrichment.upsert).toHaveBeenCalledOnce();
    });
  });
});
