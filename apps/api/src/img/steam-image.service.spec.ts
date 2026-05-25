import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { SteamImageService } from "./steam-image.service";

interface PrismaStubs {
  steamGameEnrichment: { findUnique: ReturnType<typeof vi.fn> };
  steamGameAchievement: { findUnique: ReturnType<typeof vi.fn> };
}

function makePrisma(): PrismaStubs {
  return {
    steamGameEnrichment: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    steamGameAchievement: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  };
}

function makeService(prisma: PrismaStubs): SteamImageService {
  return new SteamImageService(prisma as unknown as PrismaService);
}

describe("SteamImageService.capsule", () => {
  it("returns only the legacy URL when no hashed path is enriched", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      headerPath: null,
      assetTimestamp: null,
    });
    const service = makeService(prisma);

    const resolved = await service.capsule(440);
    expect(resolved.urls).toEqual([
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/header.jpg",
    ]);
    expect(resolved.params).toEqual({
      width: 231,
      height: 87,
      fit: "cover",
      quality: 85,
    });
  });

  it("returns hashed-then-legacy chain with a ?t= cache-buster when a hashed path exists", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      headerPath: "header_abc123.jpg",
      assetTimestamp: 1_715_000_000n,
    });
    const service = makeService(prisma);

    const resolved = await service.capsule(440);
    expect(resolved.urls).toEqual([
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/header_abc123.jpg?t=1715000000",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/header.jpg",
    ]);
  });

  it("returns only the legacy URL even with a timestamp when no hashed path", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      headerPath: null,
      assetTimestamp: 1_715_000_000n,
    });
    const service = makeService(prisma);

    const resolved = await service.capsule(440);
    expect(resolved.urls).toEqual([
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/header.jpg",
    ]);
  });
});

describe("SteamImageService.libraryCapsule / hero / logo", () => {
  it("libraryCapsule resolves the 600x900 portrait at width 300", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      libraryCapsulePath: null,
      assetTimestamp: null,
    });
    const service = makeService(prisma);

    const resolved = await service.libraryCapsule(440);
    expect(resolved.urls).toEqual([
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/library_600x900.jpg",
    ]);
    expect(resolved.params).toMatchObject({ width: 300, quality: 85 });
  });

  it("hero resolves the library_hero.jpg URL at width 1280", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      libraryHeroPath: null,
      assetTimestamp: null,
    });
    const service = makeService(prisma);

    const resolved = await service.hero(440);
    expect(resolved.urls[0]).toContain("library_hero.jpg");
    expect(resolved.params).toMatchObject({ width: 1280, quality: 85 });
  });

  it("heroPalette resolves the same upstream chain as hero (controller does the palette work)", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      libraryHeroPath: "abc/library_hero.jpg",
      assetTimestamp: 1_715_000_000n,
    });
    const service = makeService(prisma);

    const resolved = await service.heroPalette(440);
    expect(resolved.urls).toEqual([
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/abc/library_hero.jpg?t=1715000000",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/library_hero.jpg",
    ]);
  });

  it("logo never emits a ?t= cache-buster even if enrichment has a timestamp", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      logoPath: "logo_abc.png",
    });
    const service = makeService(prisma);

    const resolved = await service.logo(440);
    expect(resolved.urls).toEqual([
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/logo_abc.png",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/logo.png",
    ]);
    expect(resolved.urls[0]).not.toContain("?t=");
  });
});

describe("SteamImageService.backdrop", () => {
  it("returns the full fallback chain (library_hero → page_bg → v6b → mirror) with no enrichment", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      libraryHeroPath: null,
      assetTimestamp: null,
    });
    const service = makeService(prisma);

    const resolved = await service.backdrop(440);
    // With no enriched hero path, only the legacy library_hero.jpg URL
    // sits at the front of the chain. page_bg variants follow for the
    // pre-2019 titles that lack library_hero.
    expect(resolved.urls).toEqual([
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/library_hero.jpg",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/page_bg_generated.jpg",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/page_bg_generated_v6b.jpg",
      "https://store.akamai.steamstatic.com/images/storepagebackground/app/440",
    ]);
    expect(resolved.params).toEqual({ quality: 95 });
  });

  it("inserts the hashed library_hero URL ahead of the legacy when enrichment knows the content hash", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      libraryHeroPath: "abc123/library_hero.jpg",
      assetTimestamp: 1_715_000_000n,
    });
    const service = makeService(prisma);

    const resolved = await service.backdrop(440);
    // Hashed library_hero first (immutable, CDN-cacheable), legacy second,
    // then the page_bg fallbacks for the heroless-title case.
    expect(resolved.urls).toEqual([
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/abc123/library_hero.jpg?t=1715000000",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/library_hero.jpg",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/page_bg_generated.jpg?t=1715000000",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/page_bg_generated_v6b.jpg?t=1715000000",
      "https://store.akamai.steamstatic.com/images/storepagebackground/app/440?t=1715000000",
    ]);
  });
});

describe("SteamImageService.achievement / achievementGray", () => {
  it("returns the iconUrl from the enriched row", async () => {
    const prisma = makePrisma();
    prisma.steamGameAchievement.findUnique.mockResolvedValue({
      iconUrl: "https://example.com/ach.png",
    });
    const service = makeService(prisma);

    const resolved = await service.achievement(440, "ACH_FIRST_WIN");
    expect(resolved.urls).toEqual(["https://example.com/ach.png"]);
    expect(resolved.params).toEqual({ width: 64, quality: 85 });
  });

  it("throws NotFoundException when no achievement row exists for (appid, apiName)", async () => {
    const prisma = makePrisma();
    prisma.steamGameAchievement.findUnique.mockResolvedValue(null);
    const service = makeService(prisma);

    await expect(service.achievement(440, "MISSING")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("achievementGray returns iconGrayUrl from the same row", async () => {
    const prisma = makePrisma();
    prisma.steamGameAchievement.findUnique.mockResolvedValue({
      iconGrayUrl: "https://example.com/ach_gray.png",
    });
    const service = makeService(prisma);

    const resolved = await service.achievementGray(440, "ACH_FIRST_WIN");
    expect(resolved.urls).toEqual(["https://example.com/ach_gray.png"]);
  });

  it("achievementGray also throws NotFoundException when the row is missing", async () => {
    const prisma = makePrisma();
    prisma.steamGameAchievement.findUnique.mockResolvedValue(null);
    const service = makeService(prisma);

    await expect(service.achievementGray(440, "MISSING")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
