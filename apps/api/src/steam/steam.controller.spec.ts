import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type {
  SteamLibrarySummary,
  SteamPlatformMix,
  SteamPlayerState,
  SteamSummary,
  SteamTagCatalog,
  SteamWishlist,
} from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import { SteamAchievementsService } from "./achievements.service";
import { SteamOwnedGamesService } from "./owned-games.service";
import { SteamPlayerStateService } from "./player-state.service";
import { SteamScreenshotService } from "./screenshot.service";
import { SteamController } from "./steam.controller";
import { SteamService } from "./steam.service";
import { SteamTagService } from "./tag.service";

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
      providers: [
        { provide: SteamService, useValue: { getOwnerSummary: stub } },
        { provide: SteamOwnedGamesService, useValue: {} },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamScreenshotService, useValue: {} },
      ],
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
          releaseDate: 1412899200,
          comingSoon: false,
        },
      ],
      fetchedAt: 1715688000000,
    };
    const stub = vi.fn().mockResolvedValue(wishlist);

    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: { getOwnerWishlist: stub } },
        { provide: SteamOwnedGamesService, useValue: {} },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamScreenshotService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getWishlist()).resolves.toBe(wishlist);
    expect(stub).toHaveBeenCalledOnce();
  });

  it("delegates to SteamOwnedGamesService.getLibrarySummary", async () => {
    const summary: SteamLibrarySummary = {
      ownedCount: 142,
      everLaunchedCount: 88,
      untouchedCount: 54,
      lastSyncedAt: "2026-05-14T00:00:00.000Z",
    };
    const stub = vi.fn().mockResolvedValue(summary);

    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        { provide: SteamOwnedGamesService, useValue: { getLibrarySummary: stub } },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamScreenshotService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getLibrarySummary()).resolves.toBe(summary);
    expect(stub).toHaveBeenCalledOnce();
  });

  it("delegates to SteamOwnedGamesService.getPlatformMix", async () => {
    const mix: SteamPlatformMix = {
      totalMinutes: 12_000,
      windowsMinutes: 9_500,
      macMinutes: 0,
      linuxMinutes: 500,
      deckMinutes: 2_000,
      dominantPlatform: "windows",
      lastSyncedAt: "2026-05-14T00:00:00.000Z",
    };
    const stub = vi.fn().mockResolvedValue(mix);

    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        { provide: SteamOwnedGamesService, useValue: { getPlatformMix: stub } },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamScreenshotService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getPlatformMix()).resolves.toBe(mix);
    expect(stub).toHaveBeenCalledOnce();
  });

  it("delegates to SteamTagService.getCatalog", async () => {
    const catalog: SteamTagCatalog = {
      tags: [
        { id: 1625, name: "Platformer" },
        { id: 1628, name: "Metroidvania" },
      ],
      lastSyncedAt: "2026-05-15T00:00:00.000Z",
    };
    const stub = vi.fn().mockResolvedValue(catalog);

    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        { provide: SteamOwnedGamesService, useValue: {} },
        { provide: SteamTagService, useValue: { getCatalog: stub } },
        { provide: SteamAchievementsService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamScreenshotService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getTags()).resolves.toBe(catalog);
    expect(stub).toHaveBeenCalledOnce();
  });

  it("delegates to SteamAchievementsService.getGameAchievements", async () => {
    const payload = {
      appid: 367520,
      achievements: [],
      lastSchemaCheckedAt: null,
      lastUnlocksCheckedAt: null,
      lastRarityCheckedAt: null,
    };
    const stub = vi.fn().mockResolvedValue(payload);

    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        { provide: SteamOwnedGamesService, useValue: {} },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: { getGameAchievements: stub } },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamScreenshotService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getGameAchievements(367520)).resolves.toBe(payload);
    expect(stub).toHaveBeenCalledWith(367520);
  });

  it("delegates to SteamAchievementsService.getRecentUnlocks", async () => {
    const payload = { unlocks: [] };
    const stub = vi.fn().mockResolvedValue(payload);

    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        { provide: SteamOwnedGamesService, useValue: {} },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: { getRecentUnlocks: stub } },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamScreenshotService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getRecentUnlocks(8)).resolves.toBe(payload);
    expect(stub).toHaveBeenCalledWith(8);
  });

  it("delegates to SteamPlayerStateService.getPlayerState", async () => {
    const state: SteamPlayerState = {
      steamId: "76561198020053778",
      personaName: "Vyoh",
      avatarUrl: "https://example.com/avatar_full.jpg",
      personaState: "online",
      profileVisibility: 3,
      currentGame: { appid: 730, name: "Counter-Strike 2" },
      currentGamePlaytimeForeverMinutes: 4_320,
      lastPolledAt: "2026-05-16T00:00:00.000Z",
    };
    const stub = vi.fn().mockResolvedValue(state);

    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        { provide: SteamOwnedGamesService, useValue: {} },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: { getPlayerState: stub } },
        { provide: SteamScreenshotService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getPlayerState()).resolves.toBe(state);
    expect(stub).toHaveBeenCalledOnce();
  });

  it("translates a null player-state into a NotFoundException", async () => {
    const stub = vi.fn().mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        { provide: SteamOwnedGamesService, useValue: {} },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: { getPlayerState: stub } },
        { provide: SteamScreenshotService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getPlayerState()).rejects.toBeInstanceOf(NotFoundException);
  });
});
