import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { SteamEnrichmentService } from "./enrichment.service";
import type { SteamPicsService } from "./pics.service";
import type { SteamClientService } from "./steam-client.service";

function makeService(opts: {
  storeItems?: unknown[];
  logoAssets?: { appid: number; logoPath: string | null }[];
  logoAssetsThrows?: Error;
}) {
  const prisma = {
    steamGameEnrichment: { upsert: vi.fn().mockResolvedValue(undefined) },
  };
  const client = {
    getStoreItemsFull: vi.fn().mockResolvedValue(opts.storeItems ?? []),
  };
  const pics = {
    getLogoAssets: opts.logoAssetsThrows
      ? vi.fn().mockRejectedValue(opts.logoAssetsThrows)
      : vi.fn().mockResolvedValue(opts.logoAssets ?? []),
  };
  return {
    service: new SteamEnrichmentService(
      prisma as unknown as PrismaService,
      client as unknown as SteamClientService,
      pics as unknown as SteamPicsService
    ),
    prisma,
    client,
    pics,
  };
}

function rawItem(appid: number, overrides: Record<string, unknown> = {}) {
  return {
    appid,
    success: 1,
    name: `App ${appid}`,
    type: 0,
    assets: {
      asset_url_format: "store_item_assets/${IMAGE}.jpg",
      header: "header",
      hero_capsule: "hero",
      library_capsule: "library",
      library_hero: "library_hero",
      community_icon: "icon",
      capsule: "capsule",
      page_background: "bg",
    },
    release: { steam_release_date: 1_700_000_000, is_coming_soon: false },
    is_free: false,
    tagids: [1, 2, 3],
    categories: { feature_categoryids: [10, 20] },
    ...overrides,
  };
}

describe("SteamEnrichmentService.enrichApps", () => {
  it("returns 0 without calling the client when appids is empty", async () => {
    const { service, client } = makeService({});
    const written = await service.enrichApps([]);
    expect(written).toBe(0);
    expect(client.getStoreItemsFull).not.toHaveBeenCalled();
  });

  it("upserts a row per resolved store item", async () => {
    const { service, prisma } = makeService({
      storeItems: [rawItem(42), rawItem(99)],
    });
    const written = await service.enrichApps([42, 99]);
    expect(written).toBe(2);
    expect(prisma.steamGameEnrichment.upsert).toHaveBeenCalledTimes(2);
  });

  it("merges the PICS logo hash into the projected row when present", async () => {
    const { service, prisma } = makeService({
      storeItems: [rawItem(42)],
      logoAssets: [{ appid: 42, logoPath: "logohash" }],
    });
    await service.enrichApps([42]);
    const upsertCall = prisma.steamGameEnrichment.upsert.mock.calls[0]?.[0] as
      | { create: { logoPath: string | null } }
      | undefined;
    expect(upsertCall?.create.logoPath).toBe("logohash");
  });

  it("falls back to logoPath=null when PICS fails", async () => {
    const { service, prisma } = makeService({
      storeItems: [rawItem(42)],
      logoAssetsThrows: new Error("pics down"),
    });
    await service.enrichApps([42]);
    const upsertCall = prisma.steamGameEnrichment.upsert.mock.calls[0]?.[0] as
      | { create: { logoPath: string | null } }
      | undefined;
    expect(upsertCall?.create.logoPath).toBeNull();
  });

  it("skips items the projector returns null for (delisted / unresolved upstream)", async () => {
    const { service, prisma } = makeService({
      // No `assets` block → projectEnrichment returns null
      storeItems: [{ appid: 42 }],
    });
    const written = await service.enrichApps([42]);
    expect(written).toBe(0);
    expect(prisma.steamGameEnrichment.upsert).not.toHaveBeenCalled();
  });
});
