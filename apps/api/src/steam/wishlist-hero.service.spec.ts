import { NotFoundException } from "@nestjs/common";
import type { SteamGameRating } from "@vyoh/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "../img/upstream";
import type { PrismaService } from "../prisma/prisma.service";
import type { EnrichmentUpsert } from "./enrichment.service";
import type { SteamClientService } from "./steam-client.service";
import type { SteamUpcomingService, UpcomingSource } from "./upcoming.service";
import { SteamWishlistHeroService } from "./wishlist-hero.service";

const fetchUpstreamChain = vi.hoisted(() => vi.fn());
vi.mock("../img/upstream", async () => {
  const actual =
    await vi.importActual<typeof import("../img/upstream")>("../img/upstream");
  return { ...actual, fetchUpstreamChain };
});

const projectEnrichment = vi.hoisted(() => vi.fn());
vi.mock("./enrichment.service", () => ({ projectEnrichment }));

const extractDominantHex = vi.hoisted(() => vi.fn());
const composeHeroUrls = vi.hoisted(() => vi.fn(() => ["https://hero"]));
vi.mock("./subject-anchor.service", () => ({ extractDominantHex, composeHeroUrls }));

const RATING: SteamGameRating = {
  type: "ESRB",
  rating: "M",
  descriptors: ["Violence"],
  requiredAge: 17,
  useAgeGate: false,
  imageUrl: null,
};

// Only the fields the service reads off the projection; cast through unknown so
// we don't have to fill the full EnrichmentUpsert shape.
function projection(overrides: Partial<EnrichmentUpsert> = {}): EnrichmentUpsert {
  return {
    libraryHeroPath: "abc/library_hero.jpg",
    assetTimestamp: 1_776_125_684n,
    shortDescription: "A bleak action RPG.",
    steamDeckCompat: 3,
    platformWindows: true,
    platformMac: false,
    platformLinux: false,
    gameRating: RATING,
    ...overrides,
  } as unknown as EnrichmentUpsert;
}

// The stored row, as the service selects it — bigint timestamp, Json rating.
function storedRow(overrides: Record<string, unknown> = {}) {
  return {
    dominantHex: "#2f4858",
    shortDescription: "A bleak action RPG.",
    steamDeckCompat: 3,
    platformWindows: true,
    platformMac: false,
    platformLinux: false,
    gameRating: RATING,
    assetTimestamp: 1_776_125_684n,
    ...overrides,
  };
}

function makeService({
  source = "wishlist",
  row = null,
}: { source?: UpcomingSource | null; row?: object | null } = {}) {
  const getStoreItemsFull = vi.fn().mockResolvedValue([{ appid: 1, success: 1 }]);
  const client = { getStoreItemsFull } as unknown as SteamClientService;
  const membershipOf = vi.fn().mockResolvedValue(source);
  const upcoming = { membershipOf } as unknown as SteamUpcomingService;
  const findUnique = vi.fn().mockResolvedValue(row);
  const prisma = {
    steamGameEnrichment: { findUnique },
  } as unknown as PrismaService;
  return {
    service: new SteamWishlistHeroService(client, upcoming, prisma),
    getStoreItemsFull,
    membershipOf,
    findUnique,
  };
}

beforeEach(() => {
  fetchUpstreamChain.mockReset();
  fetchUpstreamChain.mockResolvedValue(Buffer.from("hero-bytes"));
  projectEnrichment.mockReset();
  projectEnrichment.mockReturnValue(projection());
  extractDominantHex.mockReset();
  extractDominantHex.mockResolvedValue("#8b1e1e");
  composeHeroUrls.mockClear();
});

describe("SteamWishlistHeroService", () => {
  it("projects store data plus an on-read accent into the hero-meta shape", async () => {
    const { service } = makeService();
    const meta = await service.getHeroMeta(1);

    expect(meta).toEqual({
      appid: 1,
      dominantHex: "#8b1e1e",
      shortDescription: "A bleak action RPG.",
      steamDeckCompat: 3,
      platformWindows: true,
      platformMac: false,
      platformLinux: false,
      gameRating: RATING,
      // bigint assetTimestamp is narrowed to number for the JSON payload.
      assetTimestamp: 1_776_125_684,
    });
  });

  it("caches by appid — a second call within the TTL skips the store fetch", async () => {
    const { service, getStoreItemsFull } = makeService();
    await service.getHeroMeta(1);
    await service.getHeroMeta(1);
    expect(getStoreItemsFull).toHaveBeenCalledTimes(1);
  });

  it("throws NotFound when the store page is unresolvable (success !== 1)", async () => {
    projectEnrichment.mockReturnValue(null);
    const { service } = makeService();
    await expect(service.getHeroMeta(1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("refuses an appid outside the upcoming set before doing any work", async () => {
    const { service, getStoreItemsFull } = makeService({ source: null });
    await expect(service.getHeroMeta(999_999)).rejects.toBeInstanceOf(NotFoundException);
    // The refusal is worth nothing if it lands after the spend it exists to
    // prevent — the store call and the art fetch are the cost, not the map write.
    expect(getStoreItemsFull).not.toHaveBeenCalled();
    expect(fetchUpstreamChain).not.toHaveBeenCalled();
  });

  it("re-checks membership on a cache hit", async () => {
    const { service, membershipOf } = makeService();
    await service.getHeroMeta(1);
    membershipOf.mockResolvedValue(null);
    await expect(service.getHeroMeta(1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("falls back to a null accent when the hero art is unreachable", async () => {
    fetchUpstreamChain.mockRejectedValue(
      new UpstreamError("https://hero", "404 across chain")
    );
    const { service } = makeService();
    const meta = await service.getHeroMeta(1);
    expect(meta.dominantHex).toBeNull();
    // The rest of the metadata still resolves — the accent is best-effort.
    expect(meta.shortDescription).toBe("A bleak action RPG.");
    expect(meta.gameRating).toEqual(RATING);
  });

  it("narrows a missing assetTimestamp to null", async () => {
    projectEnrichment.mockReturnValue(projection({ assetTimestamp: null }));
    const { service } = makeService();
    const meta = await service.getHeroMeta(1);
    expect(meta.assetTimestamp).toBeNull();
  });
});

// A pre-ordered title is owned, so the poller that keeps its release date honest
// has already stored everything this endpoint returns.
describe("SteamWishlistHeroService, for an owned title", () => {
  it("serves the enrichment row instead of calling the store", async () => {
    const { service, getStoreItemsFull } = makeService({
      source: "owned",
      row: storedRow(),
    });
    const meta = await service.getHeroMeta(2_584_270);

    expect(meta).toEqual({
      appid: 2_584_270,
      dominantHex: "#2f4858",
      shortDescription: "A bleak action RPG.",
      steamDeckCompat: 3,
      platformWindows: true,
      platformMac: false,
      platformLinux: false,
      gameRating: RATING,
      assetTimestamp: 1_776_125_684,
    });
    expect(getStoreItemsFull).not.toHaveBeenCalled();
    expect(fetchUpstreamChain).not.toHaveBeenCalled();
  });

  // The accent is the expensive field, and the anchor pass has already run
  // Vibrant over the same art. A null there means that pass hasn't reached the
  // row — not a reason to re-fetch the hero on a page view.
  it("keeps a null stored accent rather than recomputing it", async () => {
    const { service } = makeService({
      source: "owned",
      row: storedRow({ dominantHex: null }),
    });
    const meta = await service.getHeroMeta(2_584_270);
    expect(meta.dominantHex).toBeNull();
    expect(extractDominantHex).not.toHaveBeenCalled();
  });

  // No in-memory copy: the row read costs nothing to repeat, and a cached copy
  // would outlive the daily refresh that keeps an announced date current.
  it("re-reads the row on every request", async () => {
    const { service, findUnique } = makeService({
      source: "owned",
      row: storedRow(),
    });
    await service.getHeroMeta(2_584_270);
    await service.getHeroMeta(2_584_270);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it("falls back to the per-request projection when the row has gone", async () => {
    const { service, getStoreItemsFull } = makeService({ source: "owned", row: null });
    await expect(service.getHeroMeta(1)).resolves.toMatchObject({
      shortDescription: "A bleak action RPG.",
    });
    expect(getStoreItemsFull).toHaveBeenCalled();
  });
});
