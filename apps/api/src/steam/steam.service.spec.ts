import { NO_CURATION } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { SteamClientService } from "./steam-client.service";
import { SteamService } from "./steam.service";
import type {
  SteamGetProfileItemsEquippedResponse,
  SteamPlayerRaw,
  SteamStoreItemFullRaw,
  SteamWishlistItemRaw,
} from "./types";

function makePrismaStub(): {
  prisma: PrismaService;
  upsert: ReturnType<typeof vi.fn>;
} {
  const upsert = vi.fn().mockResolvedValue(undefined);
  const prisma = {
    steamWishlistAsset: { upsert },
  } as unknown as PrismaService;
  return { prisma, upsert };
}

function makeService(
  player: SteamPlayerRaw | null,
  items: SteamGetProfileItemsEquippedResponse["response"] = {},
  level: number | null = null,
  levelPercentile: number | null = null
): SteamService {
  const client = {
    getPlayerSummary: vi.fn().mockResolvedValue(player),
    getProfileItemsEquipped: vi.fn().mockResolvedValue(items),
    getSteamLevel: vi.fn().mockResolvedValue(level),
    getSteamLevelDistribution: vi.fn().mockResolvedValue(levelPercentile),
  } as unknown as SteamClientService;
  return new SteamService(client, makePrismaStub().prisma);
}

interface WishlistClientStubs {
  getWishlist: ReturnType<typeof vi.fn>;
  getStoreItemsFull: ReturnType<typeof vi.fn>;
}

function makeWishlistService(
  wishlist: SteamWishlistItemRaw[],
  storeItems: SteamStoreItemFullRaw[]
): {
  service: SteamService;
  stubs: WishlistClientStubs;
  upsert: ReturnType<typeof vi.fn>;
} {
  const stubs: WishlistClientStubs = {
    getWishlist: vi.fn().mockResolvedValue(wishlist),
    getStoreItemsFull: vi.fn().mockResolvedValue(storeItems),
  };
  const client = stubs as unknown as SteamClientService;
  const { prisma, upsert } = makePrismaStub();
  return { service: new SteamService(client, prisma), stubs, upsert };
}

const basePlayer: SteamPlayerRaw = {
  steamid: "76561198020053778",
  communityvisibilitystate: 3,
  profilestate: 1,
  personaname: "Vyoh",
  profileurl: "https://steamcommunity.com/id/vyoh/",
  avatarfull: "https://example.com/avatar_full.jpg",
  personastate: 1,
};

describe("SteamService.getOwnerSummary", () => {
  it("maps a public profile to a SteamSummary with privacyPrereqs.profilePublic=true", async () => {
    const summary = await makeService(basePlayer).getOwnerSummary(NO_CURATION);
    expect(summary).toMatchObject({
      steamId: "76561198020053778",
      personaName: "Vyoh",
      personaState: "online",
      currentGame: null,
      privacyPrereqs: { profilePublic: true, gameDetailsPublic: "unknown" },
    });
  });

  it("surfaces profilePublic=false when communityvisibilitystate < 3", async () => {
    const summary = await makeService({
      ...basePlayer,
      communityvisibilitystate: 1,
    }).getOwnerSummary(NO_CURATION);
    expect(summary.privacyPrereqs.profilePublic).toBe(false);
    expect(summary.privacyPrereqs.gameDetailsPublic).toBe("unknown");
  });

  it("populates currentGame when the player is in-game", async () => {
    const summary = await makeService({
      ...basePlayer,
      gameid: "440",
      gameextrainfo: "Team Fortress 2",
    }).getOwnerSummary(NO_CURATION);
    expect(summary.currentGame).toEqual({ appid: 440, name: "Team Fortress 2" });
  });

  it("throws when GetPlayerSummaries returns no players for the owner id", async () => {
    await expect(makeService(null).getOwnerSummary(NO_CURATION)).rejects.toThrow(
      /Steam profile not found/
    );
  });

  it("surfaces memberSinceUnix, steamLevel, and percentile when present", async () => {
    const summary = await makeService(
      { ...basePlayer, timecreated: 1263864425 },
      {},
      14,
      94.66
    ).getOwnerSummary(NO_CURATION);
    expect(summary.memberSinceUnix).toBe(1263864425);
    expect(summary.steamLevel).toBe(14);
    expect(summary.steamLevelPercentile).toBe(94.66);
  });

  it("omits memberSinceUnix when timecreated is absent (privacy-locked)", async () => {
    const summary = await makeService(basePlayer, {}, 14, 94.66).getOwnerSummary(
      NO_CURATION
    );
    expect(summary.memberSinceUnix).toBeUndefined();
    expect(summary.steamLevel).toBe(14);
  });

  it("omits level fields and skips the percentile call when level is unavailable", async () => {
    const summary = await makeService(basePlayer, {}, null).getOwnerSummary(NO_CURATION);
    expect(summary.steamLevel).toBeUndefined();
    expect(summary.steamLevelPercentile).toBeUndefined();
  });

  it("maps equipped cosmetics to absolute CDN URLs, including animated background webm", async () => {
    const summary = await makeService(basePlayer, {
      animated_avatar: {
        image_small: "items/2186680/avatar.gif",
        image_large: "items/2186680/avatar_static.jpg",
      },
      profile_background: {
        image_large: "items/2186680/bg.jpg",
        movie_webm: "items/2186680/bg.webm",
        movie_mp4: "items/2186680/bg.mp4",
      },
    }).getOwnerSummary(NO_CURATION);
    expect(summary.animatedAvatarUrl).toBe(
      "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/items/2186680/avatar.gif"
    );
    expect(summary.profileBackgroundUrl).toBe(
      "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/items/2186680/bg.jpg"
    );
    expect(summary.profileBackgroundVideoUrl).toBe(
      "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/items/2186680/bg.webm"
    );
  });

  it("falls back to animated_avatar.image_large when image_small is absent", async () => {
    const summary = await makeService(basePlayer, {
      animated_avatar: { image_large: "items/2186680/avatar_static.jpg" },
    }).getOwnerSummary(NO_CURATION);
    expect(summary.animatedAvatarUrl).toBe(
      "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/items/2186680/avatar_static.jpg"
    );
  });

  it("falls back to mp4 when only mp4 is provided for the background video", async () => {
    const summary = await makeService(basePlayer, {
      profile_background: {
        image_large: "items/2186680/bg.jpg",
        movie_mp4: "items/2186680/bg.mp4",
      },
    }).getOwnerSummary(NO_CURATION);
    expect(summary.profileBackgroundVideoUrl).toBe(
      "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/items/2186680/bg.mp4"
    );
  });

  it("leaves the background video undefined when the background is a static still", async () => {
    const summary = await makeService(basePlayer, {
      profile_background: { image_large: "items/2186680/bg.jpg" },
    }).getOwnerSummary(NO_CURATION);
    expect(summary.profileBackgroundUrl).toBe(
      "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/items/2186680/bg.jpg"
    );
    expect(summary.profileBackgroundVideoUrl).toBeUndefined();
  });

  it("leaves cosmetic fields undefined when no items are equipped", async () => {
    const summary = await makeService(basePlayer, {}).getOwnerSummary(NO_CURATION);
    expect(summary.animatedAvatarUrl).toBeUndefined();
    expect(summary.profileBackgroundUrl).toBeUndefined();
    expect(summary.profileBackgroundVideoUrl).toBeUndefined();
  });
});

describe("SteamService.getOwnerWishlist", () => {
  const baseWishlist: SteamWishlistItemRaw[] = [
    { appid: 214490, priority: 2, date_added: 1466884835 },
    { appid: 383870, priority: 0, date_added: 1455053806 },
  ];

  it("maps wishlist items with resolved names, dates, and store URLs", async () => {
    const { service } = makeWishlistService(baseWishlist, [
      {
        appid: 214490,
        success: 1,
        name: "Alien: Isolation",
        store_url_path: "app/214490/Alien_Isolation",
        release: { steam_release_date: 1412899200, is_coming_soon: false },
      },
      {
        appid: 383870,
        success: 1,
        name: "Firewatch",
        store_url_path: "app/383870/Firewatch",
        release: { steam_release_date: 1455580800, is_coming_soon: false },
      },
    ]);

    const wishlist = await service.getOwnerWishlist(NO_CURATION);

    expect(wishlist.steamId).toBe("76561198020053778");
    expect(wishlist.items).toEqual([
      {
        appid: 214490,
        name: "Alien: Isolation",
        dateAdded: 1466884835,
        priority: 2,
        storeUrl: "https://store.steampowered.com/app/214490/Alien_Isolation/",
        releaseDate: 1412899200,
        comingSoon: false,
      },
      {
        appid: 383870,
        name: "Firewatch",
        dateAdded: 1455053806,
        priority: 0,
        storeUrl: "https://store.steampowered.com/app/383870/Firewatch/",
        releaseDate: 1455580800,
        comingSoon: false,
      },
    ]);
  });

  it("flags coming-soon and surfaces a null releaseDate when Steam omits the date", async () => {
    const { service } = makeWishlistService(
      [{ appid: 999999, priority: 0, date_added: 1700000000 }],
      [
        {
          appid: 999999,
          success: 1,
          name: "Sequel: TBA",
          store_url_path: "app/999999/Sequel_TBA",
          release: { is_coming_soon: true },
        },
      ]
    );

    const wishlist = await service.getOwnerWishlist(NO_CURATION);
    expect(wishlist.items[0]).toMatchObject({
      appid: 999999,
      releaseDate: null,
      comingSoon: true,
    });
  });

  it("surfaces null names when GetItems returns success=0", async () => {
    const { service } = makeWishlistService(baseWishlist, [
      { appid: 214490, success: 0 },
      {
        appid: 383870,
        success: 1,
        name: "Firewatch",
        store_url_path: "app/383870/Firewatch",
      },
    ]);

    const wishlist = await service.getOwnerWishlist(NO_CURATION);
    expect(wishlist.items[0]).toMatchObject({
      appid: 214490,
      name: null,
      storeUrl: "https://store.steampowered.com/app/214490/",
    });
    expect(wishlist.items[1]?.name).toBe("Firewatch");
  });

  it("surfaces null names for appids GetItems omits entirely", async () => {
    const { service } = makeWishlistService(baseWishlist, [
      {
        appid: 214490,
        success: 1,
        name: "Alien: Isolation",
        store_url_path: "app/214490/Alien_Isolation",
      },
    ]);

    const wishlist = await service.getOwnerWishlist(NO_CURATION);
    expect(wishlist.items.map((i) => i.name)).toEqual(["Alien: Isolation", null]);
  });

  it("serves the wishlist from cache within the TTL", async () => {
    const { service, stubs } = makeWishlistService(baseWishlist, [
      {
        appid: 214490,
        success: 1,
        name: "Alien: Isolation",
        store_url_path: "app/214490/Alien_Isolation",
      },
      {
        appid: 383870,
        success: 1,
        name: "Firewatch",
        store_url_path: "app/383870/Firewatch",
      },
    ]);

    await service.getOwnerWishlist(NO_CURATION);
    await service.getOwnerWishlist(NO_CURATION);

    expect(stubs.getWishlist).toHaveBeenCalledOnce();
    expect(stubs.getStoreItemsFull).toHaveBeenCalledOnce();
  });

  it("refetches the wishlist once the TTL elapses", async () => {
    const { service, stubs } = makeWishlistService(baseWishlist, [
      {
        appid: 214490,
        success: 1,
        name: "Alien: Isolation",
        store_url_path: "app/214490/Alien_Isolation",
      },
      {
        appid: 383870,
        success: 1,
        name: "Firewatch",
        store_url_path: "app/383870/Firewatch",
      },
    ]);
    service.wishlistTtlMs = 0;

    await service.getOwnerWishlist(NO_CURATION);
    await service.getOwnerWishlist(NO_CURATION);

    expect(stubs.getWishlist).toHaveBeenCalledTimes(2);
    // Names stay cached even when the wishlist refetches — name cache has its own TTL.
    expect(stubs.getStoreItemsFull).toHaveBeenCalledOnce();
  });

  it("upserts content-hashed asset paths into SteamWishlistAsset", async () => {
    const { service, upsert } = makeWishlistService(
      [{ appid: 214490, priority: 0, date_added: 1466884835 }],
      [
        {
          appid: 214490,
          success: 1,
          name: "Alien: Isolation",
          store_url_path: "app/214490/Alien_Isolation",
          assets: {
            asset_url_format: "steam/apps/214490/${FILENAME}?t=1709876543",
            library_hero: "1eebc7e4e3/library_hero.jpg",
            library_hero_2x: "1eebc7e4e3/library_hero_2x.jpg",
            library_capsule: "1eebc7e4e3/library_600x900.jpg",
            header: "1eebc7e4e3/header.jpg",
          },
        },
      ]
    );
    await service.getOwnerWishlist(NO_CURATION);
    expect(upsert).toHaveBeenCalledOnce();
    const call = upsert.mock.calls[0]?.[0];
    expect(call.where).toEqual({ appid: 214490 });
    expect(call.create).toMatchObject({
      appid: 214490,
      assetUrlFormat: "steam/apps/214490/${FILENAME}?t=1709876543",
      assetTimestamp: 1709876543n,
      libraryHeroPath: "1eebc7e4e3/library_hero.jpg",
      libraryHero2xPath: "1eebc7e4e3/library_hero_2x.jpg",
      libraryCapsulePath: "1eebc7e4e3/library_600x900.jpg",
      headerPath: "1eebc7e4e3/header.jpg",
    });
    expect(call.update).toMatchObject({
      libraryHeroPath: "1eebc7e4e3/library_hero.jpg",
      headerPath: "1eebc7e4e3/header.jpg",
    });
  });

  // Townfall-shape: appid 1636440 carries a `header` asset hash but no
  // `library_*` variants — the publisher only shipped header + capsules.
  // The proxy chain in SteamImageService.hero needs to know the header
  // hash so it can serve the cropped capsule fallback for the wishlist
  // banner; null library fields stay null so the chain skips the legacy
  // `library_hero.jpg` 404 and the SGDB chunk picks up the gap later.
  it("upserts a header-only Townfall-shape with nulls for library_* fields", async () => {
    const { service, upsert } = makeWishlistService(
      [{ appid: 1636440, priority: 0, date_added: 1700000000 }],
      [
        {
          appid: 1636440,
          success: 1,
          name: "Silent Hill: Townfall",
          store_url_path: "app/1636440/Silent_Hill_Townfall",
          release: { is_coming_soon: true },
          assets: {
            asset_url_format: "steam/apps/1636440/${FILENAME}?t=1709000000",
            header: "0ed1cb4bc30631/header.jpg",
          },
        },
      ]
    );
    await service.getOwnerWishlist(NO_CURATION);
    const call = upsert.mock.calls[0]?.[0];
    expect(call.create).toMatchObject({
      appid: 1636440,
      assetTimestamp: 1709000000n,
      headerPath: "0ed1cb4bc30631/header.jpg",
      libraryHeroPath: null,
      libraryHero2xPath: null,
      libraryCapsulePath: null,
    });
  });

  it("skips the upsert when success !== 1 (unresolvable appid)", async () => {
    const { service, upsert } = makeWishlistService(
      [{ appid: 9999999, priority: 0, date_added: 1700000000 }],
      [{ appid: 9999999, success: 0 }]
    );
    await service.getOwnerWishlist(NO_CURATION);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("leaves assetTimestamp null when asset_url_format has no `?t=` segment", async () => {
    const { service, upsert } = makeWishlistService(
      [{ appid: 214490, priority: 0, date_added: 1466884835 }],
      [
        {
          appid: 214490,
          success: 1,
          name: "Alien: Isolation",
          assets: {
            asset_url_format: "steam/apps/214490/${FILENAME}",
            header: "1eebc7e4e3/header.jpg",
          },
        },
      ]
    );
    await service.getOwnerWishlist(NO_CURATION);
    const call = upsert.mock.calls[0]?.[0];
    expect(call.create.assetTimestamp).toBeNull();
  });
});
