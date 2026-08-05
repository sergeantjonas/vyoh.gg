import { NotFoundException } from "@nestjs/common";
import type { SteamGameRating } from "@vyoh/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "../img/upstream";
import type { EnrichmentUpsert } from "./enrichment.service";
import type { SteamClientService } from "./steam-client.service";
import type { SteamService } from "./steam.service";
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

function makeService() {
  const getStoreItemsFull = vi.fn().mockResolvedValue([{ appid: 1, success: 1 }]);
  const client = { getStoreItemsFull } as unknown as SteamClientService;
  const isWishlisted = vi.fn().mockResolvedValue(true);
  const steam = { isWishlisted } as unknown as SteamService;
  return {
    service: new SteamWishlistHeroService(client, steam),
    getStoreItemsFull,
    isWishlisted,
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

  it("refuses an appid that is not on the wishlist before doing any work", async () => {
    const { service, getStoreItemsFull, isWishlisted } = makeService();
    isWishlisted.mockResolvedValue(false);
    await expect(service.getHeroMeta(999_999)).rejects.toBeInstanceOf(NotFoundException);
    // The refusal is worth nothing if it lands after the spend it exists to
    // prevent — the store call and the art fetch are the cost, not the map write.
    expect(getStoreItemsFull).not.toHaveBeenCalled();
    expect(fetchUpstreamChain).not.toHaveBeenCalled();
  });

  it("re-checks membership on a cache hit", async () => {
    const { service, isWishlisted } = makeService();
    await service.getHeroMeta(1);
    isWishlisted.mockResolvedValue(false);
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
