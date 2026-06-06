import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { SteamImageService } from "./steam-image.service";

interface PrismaStubs {
  steamGameEnrichment: { findUnique: ReturnType<typeof vi.fn> };
  steamGameAchievement: { findUnique: ReturnType<typeof vi.fn> };
  steamWishlistAsset: { findUnique: ReturnType<typeof vi.fn> };
}

function makePrisma(): PrismaStubs {
  return {
    steamGameEnrichment: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    steamGameAchievement: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    steamWishlistAsset: {
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

  it("heroLarge prefers library_hero_2x and falls back to library_hero, at width 2560", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      libraryHero2xPath: "deadbeef/library_hero_2x.jpg",
      libraryHeroPath: "cafebabe/library_hero.jpg",
      headerPath: null,
      assetTimestamp: 1_715_000_000n,
      sgdbHeroUrl: null,
    });
    const service = makeService(prisma);

    const resolved = await service.heroLarge(440);
    // Hashed 2x → legacy 2x → hashed 1x → legacy 1x → legacy header — the
    // proxy walks the chain so publishers without a 2x asset still resolve
    // to the 1x, and the trailing header tier covers wishlist-shape rows.
    expect(resolved.urls).toEqual([
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/deadbeef/library_hero_2x.jpg?t=1715000000",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/library_hero_2x.jpg",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/cafebabe/library_hero.jpg?t=1715000000",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/library_hero.jpg",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/header.jpg",
    ]);
    expect(resolved.params).toMatchObject({ width: 2560, quality: 90 });
  });

  it("heroLarge tolerates a missing 2x path by serving only the 1x chain", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      libraryHero2xPath: null,
      libraryHeroPath: null,
      headerPath: null,
      assetTimestamp: null,
      sgdbHeroUrl: null,
    });
    const service = makeService(prisma);

    const resolved = await service.heroLarge(440);
    expect(resolved.urls).toEqual([
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/library_hero_2x.jpg",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/library_hero.jpg",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/header.jpg",
    ]);
  });

  it("heroLarge prepends the SGDB hero URL when present (publisher 2x missing)", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      libraryHero2xPath: null,
      libraryHeroPath: "1xhash/library_hero.jpg",
      assetTimestamp: 1_715_000_000n,
      sgdbHeroUrl: "https://cdn2.steamgriddb.com/hero/203cb0.jpg",
    });
    const service = makeService(prisma);

    const resolved = await service.heroLarge(440);
    expect(resolved.urls[0]).toBe("https://cdn2.steamgriddb.com/hero/203cb0.jpg");
    // 1x fallback chain stays intact behind it, so a 404 on SGDB still
    // serves the publisher's 1x rather than breaking the route.
    expect(resolved.urls).toContain(
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/1xhash/library_hero.jpg?t=1715000000"
    );
    expect(resolved.urls).toContain(
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/library_hero.jpg"
    );
  });

  it("heroLarge omits SGDB from the chain when sgdbHeroUrl is null", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      libraryHero2xPath: "deadbeef/library_hero_2x.jpg",
      libraryHeroPath: "cafebabe/library_hero.jpg",
      assetTimestamp: 1_715_000_000n,
      sgdbHeroUrl: null,
    });
    const service = makeService(prisma);

    const resolved = await service.heroLarge(440);
    expect(resolved.urls[0]).not.toContain("steamgriddb");
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

describe("SteamImageService wishlist-asset fallback", () => {
  // Townfall-shape: appid 1636440 has only a hashed header in the wishlist
  // asset row — no library_hero, no 2x variant. Without the wishlist
  // fallback the proxy's enrichment lookup returns null, the chain
  // collapses to legacy URLs that all 404, and the frontend's onError
  // handler shows the dim storepagebackground ambient wash instead of a
  // real banner.

  it("hero falls back to SteamWishlistAsset when enrichment row is absent", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue(null);
    prisma.steamWishlistAsset.findUnique.mockResolvedValue({
      libraryCapsulePath: null,
      libraryHeroPath: null,
      libraryHero2xPath: null,
      headerPath: "0ed1cb4bc30631/header.jpg",
      assetTimestamp: 1_709_000_000n,
    });
    const service = makeService(prisma);

    const resolved = await service.hero(1636440);
    // library_hero entries 404 (publisher never shipped library art) and
    // the chain falls through to the hashed header, which 200s.
    expect(resolved.urls).toEqual([
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1636440/library_hero.jpg",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1636440/0ed1cb4bc30631/header.jpg?t=1709000000",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1636440/header.jpg",
    ]);
    // enlarge:true lets Sharp upscale the 460-wide header source to 1280.
    expect(resolved.params).toMatchObject({
      width: 1280,
      quality: 85,
      enlarge: true,
    });
  });

  it("heroLarge falls back to SteamWishlistAsset when enrichment row is absent", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue(null);
    prisma.steamWishlistAsset.findUnique.mockResolvedValue({
      libraryCapsulePath: null,
      libraryHeroPath: null,
      libraryHero2xPath: null,
      headerPath: "0ed1cb4bc30631/header.jpg",
      assetTimestamp: 1_709_000_000n,
    });
    const service = makeService(prisma);

    const resolved = await service.heroLarge(1636440);
    expect(resolved.urls).toContain(
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1636440/0ed1cb4bc30631/header.jpg?t=1709000000"
    );
    // No SGDB prepended — wishlist titles aren't run through SGDB backfill,
    // so the chain starts at the 2x legacy entry.
    expect(resolved.urls[0]).not.toContain("steamgriddb");
  });

  it("hero prefers SteamGameEnrichment over SteamWishlistAsset when both exist", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue({
      libraryCapsulePath: null,
      libraryHeroPath: "owned/library_hero.jpg",
      libraryHero2xPath: null,
      headerPath: "owned/header.jpg",
      assetTimestamp: 1_715_000_000n,
    });
    prisma.steamWishlistAsset.findUnique.mockResolvedValue({
      libraryCapsulePath: null,
      libraryHeroPath: "wishlist/library_hero.jpg",
      libraryHero2xPath: null,
      headerPath: "wishlist/header.jpg",
      assetTimestamp: 1_709_000_000n,
    });
    const service = makeService(prisma);

    const resolved = await service.hero(440);
    expect(resolved.urls[0]).toContain("owned/library_hero.jpg");
    expect(resolved.urls.join("|")).not.toContain("wishlist/");
    // Short-circuit semantics: when enrichment hits, the wishlist row
    // isn't even queried (no extra DB round-trip on the common path).
    expect(prisma.steamWishlistAsset.findUnique).not.toHaveBeenCalled();
  });

  it("libraryCapsule falls back to SteamWishlistAsset when enrichment row is absent", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue(null);
    prisma.steamWishlistAsset.findUnique.mockResolvedValue({
      libraryCapsulePath: "wishhash/library_600x900.jpg",
      libraryHeroPath: null,
      libraryHero2xPath: null,
      headerPath: null,
      assetTimestamp: 1_709_000_000n,
    });
    const service = makeService(prisma);

    const resolved = await service.libraryCapsule(1636440);
    expect(resolved.urls).toEqual([
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1636440/wishhash/library_600x900.jpg?t=1709000000",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1636440/library_600x900.jpg",
    ]);
  });

  it("capsule falls back to SteamWishlistAsset header when enrichment row is absent", async () => {
    const prisma = makePrisma();
    prisma.steamGameEnrichment.findUnique.mockResolvedValue(null);
    prisma.steamWishlistAsset.findUnique.mockResolvedValue({
      libraryCapsulePath: null,
      libraryHeroPath: null,
      libraryHero2xPath: null,
      headerPath: "0ed1cb4bc30631/header.jpg",
      assetTimestamp: 1_709_000_000n,
    });
    const service = makeService(prisma);

    const resolved = await service.capsule(1636440);
    expect(resolved.urls).toEqual([
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1636440/0ed1cb4bc30631/header.jpg?t=1709000000",
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1636440/header.jpg",
    ]);
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
