import { Test } from "@nestjs/testing";
import type { SteamSummary, SteamWishlist } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import { SteamController } from "./steam.controller";
import { SteamService } from "./steam.service";

describe("SteamController", () => {
  it("delegates to SteamService.getOwnerSummary", async () => {
    const summary: SteamSummary = {
      steamId: "76561198020053778",
      personaName: "Vyoh",
      profileUrl: "https://steamcommunity.com/id/vyoh/",
      avatarUrl: "https://example.com/avatar_full.jpg",
      personaState: "online",
      currentGame: null,
      privacyPrereqs: { profilePublic: true, gameDetailsPublic: "unknown" },
    };
    const stub = vi.fn().mockResolvedValue(summary);

    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [{ provide: SteamService, useValue: { getOwnerSummary: stub } }],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getSummary()).resolves.toBe(summary);
    expect(stub).toHaveBeenCalledOnce();
  });

  it("delegates to SteamService.getOwnerWishlist", async () => {
    const wishlist: SteamWishlist = {
      steamId: "76561198020053778",
      items: [
        {
          appid: 214490,
          name: "Alien: Isolation",
          dateAdded: 1466884835,
          priority: 2,
          storeUrl: "https://store.steampowered.com/app/214490/Alien_Isolation/",
        },
      ],
      fetchedAt: 1715688000000,
    };
    const stub = vi.fn().mockResolvedValue(wishlist);

    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [{ provide: SteamService, useValue: { getOwnerWishlist: stub } }],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getWishlist()).resolves.toBe(wishlist);
    expect(stub).toHaveBeenCalledOnce();
  });
});
