import { describe, expect, it, vi } from "vitest";
import { SteamClientService } from "./steam-client.service";
import { SteamService } from "./steam.service";
import type { SteamPlayerRaw, SteamStoreItemRaw, SteamWishlistItemRaw } from "./types";

function makeService(player: SteamPlayerRaw | null): SteamService {
  const client = {
    getPlayerSummary: vi.fn().mockResolvedValue(player),
  } as unknown as SteamClientService;
  return new SteamService(client);
}

interface WishlistClientStubs {
  getWishlist: ReturnType<typeof vi.fn>;
  getStoreItems: ReturnType<typeof vi.fn>;
}

function makeWishlistService(
  wishlist: SteamWishlistItemRaw[],
  storeItems: SteamStoreItemRaw[]
): { service: SteamService; stubs: WishlistClientStubs } {
  const stubs: WishlistClientStubs = {
    getWishlist: vi.fn().mockResolvedValue(wishlist),
    getStoreItems: vi.fn().mockResolvedValue(storeItems),
  };
  const client = stubs as unknown as SteamClientService;
  return { service: new SteamService(client), stubs };
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
    const summary = await makeService(basePlayer).getOwnerSummary();
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
    }).getOwnerSummary();
    expect(summary.privacyPrereqs.profilePublic).toBe(false);
    expect(summary.privacyPrereqs.gameDetailsPublic).toBe("unknown");
  });

  it("populates currentGame when the player is in-game", async () => {
    const summary = await makeService({
      ...basePlayer,
      gameid: "440",
      gameextrainfo: "Team Fortress 2",
    }).getOwnerSummary();
    expect(summary.currentGame).toEqual({ appid: 440, name: "Team Fortress 2" });
  });

  it("throws when GetPlayerSummaries returns no players for the owner id", async () => {
    await expect(makeService(null).getOwnerSummary()).rejects.toThrow(
      /Steam profile not found/
    );
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
      },
      {
        appid: 383870,
        success: 1,
        name: "Firewatch",
        store_url_path: "app/383870/Firewatch",
      },
    ]);

    const wishlist = await service.getOwnerWishlist();

    expect(wishlist.steamId).toBe("76561198020053778");
    expect(wishlist.items).toEqual([
      {
        appid: 214490,
        name: "Alien: Isolation",
        dateAdded: 1466884835,
        priority: 2,
        storeUrl: "https://store.steampowered.com/app/214490/Alien_Isolation/",
      },
      {
        appid: 383870,
        name: "Firewatch",
        dateAdded: 1455053806,
        priority: 0,
        storeUrl: "https://store.steampowered.com/app/383870/Firewatch/",
      },
    ]);
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

    const wishlist = await service.getOwnerWishlist();
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

    const wishlist = await service.getOwnerWishlist();
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

    await service.getOwnerWishlist();
    await service.getOwnerWishlist();

    expect(stubs.getWishlist).toHaveBeenCalledOnce();
    expect(stubs.getStoreItems).toHaveBeenCalledOnce();
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

    await service.getOwnerWishlist();
    await service.getOwnerWishlist();

    expect(stubs.getWishlist).toHaveBeenCalledTimes(2);
    // Names stay cached even when the wishlist refetches — name cache has its own TTL.
    expect(stubs.getStoreItems).toHaveBeenCalledOnce();
  });
});
