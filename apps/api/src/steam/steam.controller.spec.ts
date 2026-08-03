import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type {
  SteamLibrarySummary,
  SteamPlatformMix,
  SteamPlayerState,
  SteamPortrait,
  SteamSummary,
  SteamTagCatalog,
  SteamWishlist,
} from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import { SteamAchievementsService } from "./achievements.service";
import { SteamGameRecapService } from "./game-recap.service";
import { SteamOwnedGamesService } from "./owned-games.service";
import { SteamPlayerStateService } from "./player-state.service";
import { SteamPortraitService } from "./portrait.service";
import { SteamChronotypeService } from "./steam-chronotype.service";
import { SteamController } from "./steam.controller";
import { SteamService } from "./steam.service";
import { SteamTagService } from "./tag.service";
import { SteamWishlistHeroService } from "./wishlist-hero.service";

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
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
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
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getWishlist()).resolves.toBe(wishlist);
    expect(stub).toHaveBeenCalledOnce();
  });

  it("delegates to SteamWishlistHeroService.getHeroMeta with the parsed appid", async () => {
    const meta = {
      appid: 1904610,
      dominantHex: "#8b1e1e",
      shortDescription: "A bleak action RPG.",
      steamDeckCompat: 3,
      platformWindows: true,
      platformMac: false,
      platformLinux: false,
      gameRating: null,
      assetTimestamp: 1_776_125_684,
    };
    const stub = vi.fn().mockResolvedValue(meta);

    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        { provide: SteamOwnedGamesService, useValue: {} },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: {} },
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: { getHeroMeta: stub } },
        { provide: SteamPortraitService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getWishlistHeroMeta(1904610)).resolves.toBe(meta);
    expect(stub).toHaveBeenCalledWith(1904610);
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
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getLibrarySummary()).resolves.toBe(summary);
    expect(stub).toHaveBeenCalledOnce();
  });

  it("delegates to SteamPortraitService.getPortrait", async () => {
    const portrait: SteamPortrait = {
      lifetime: {
        genres: [
          {
            tag: "Souls-like",
            minutes: 42_000,
            share: 0.3,
            gameCount: 15,
            examples: [{ appid: 1245620, name: "ELDEN RING", minutes: 26_040 }],
          },
        ],
        distributedMinutes: 141_000,
        gamesCounted: 54,
        gamesWithoutGenre: 1,
      },
      recent: null,
      posture: {
        ownedCount: 186,
        meaningfulCount: 55,
        tastedCount: 11,
        ghostCount: 120,
        totalMinutes: 143_100,
        meaningfulMinutes: 142_800,
      },
      anti: {
        tasted: {
          count: 11,
          totalMinutes: 265,
          medianMinutes: 22,
          quickest: [{ appid: 1113560, name: "NieR Replicant", minutes: 1 }],
          fingerprint: {
            genres: [],
            distributedMinutes: 0,
            gamesCounted: 0,
            gamesWithoutGenre: 0,
          },
        },
        singleAchievement: { games: [], withAnyUnlock: 54, withSchema: 157 },
        coldest: null,
      },
      completion: {
        cohortCount: 24,
        finishedCount: 3,
        perfectCount: 2,
        medianCompletion: 0.42,
        finished: [],
      },
      lastSyncedAt: "2026-08-02T00:00:00.000Z",
    };
    const stub = vi.fn().mockResolvedValue(portrait);

    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        { provide: SteamOwnedGamesService, useValue: {} },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: {} },
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: { getPortrait: stub } },
      ],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getPortrait()).resolves.toBe(portrait);
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
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
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
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
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
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
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
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
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
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: { getPlayerState: stub } },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getPlayerState()).resolves.toBe(state);
    expect(stub).toHaveBeenCalledOnce();
  });

  it("delegates to SteamOwnedGamesService.getOwnedGames", async () => {
    const payload = { totalCount: 0, games: [], lastSyncedAt: null } as unknown;
    const stub = vi.fn().mockResolvedValue(payload);
    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        { provide: SteamOwnedGamesService, useValue: { getOwnedGames: stub } },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: {} },
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
      ],
    }).compile();
    const controller = moduleRef.get(SteamController);
    await expect(controller.getOwnedGames()).resolves.toBe(payload);
    expect(stub).toHaveBeenCalledOnce();
  });

  it("delegates to SteamAchievementsService.getCrossGameRarest with caller-supplied limit", async () => {
    const payload = { unlocks: [] };
    const stub = vi.fn().mockResolvedValue(payload);
    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        { provide: SteamOwnedGamesService, useValue: {} },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: { getCrossGameRarest: stub } },
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
      ],
    }).compile();
    const controller = moduleRef.get(SteamController);
    await expect(controller.getCrossGameRarest(12)).resolves.toBe(payload);
    expect(stub).toHaveBeenCalledWith(12);
  });

  it("delegates to SteamAchievementsService.getLibraryCompletion", async () => {
    const payload = { games: [] } as unknown;
    const stub = vi.fn().mockResolvedValue(payload);
    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        { provide: SteamOwnedGamesService, useValue: {} },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: { getLibraryCompletion: stub } },
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
      ],
    }).compile();
    const controller = moduleRef.get(SteamController);
    await expect(controller.getLibraryCompletion()).resolves.toBe(payload);
    expect(stub).toHaveBeenCalledOnce();
  });

  it("delegates to SteamAchievementsService.getUnlockTimeline for a given appid", async () => {
    const payload = { appid: 730, unlocks: [] } as unknown;
    const stub = vi.fn().mockResolvedValue(payload);
    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        { provide: SteamOwnedGamesService, useValue: {} },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: { getUnlockTimeline: stub } },
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
      ],
    }).compile();
    const controller = moduleRef.get(SteamController);
    await expect(controller.getUnlockTimeline(730)).resolves.toBe(payload);
    expect(stub).toHaveBeenCalledWith(730);
  });

  it("delegates to SteamChronotypeService.getChronotype with the parsed count param", async () => {
    const payload = { buckets: [] } as unknown;
    const stub = vi.fn().mockResolvedValue(payload);
    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        { provide: SteamOwnedGamesService, useValue: {} },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: {} },
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: { getChronotype: stub } },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
      ],
    }).compile();
    const controller = moduleRef.get(SteamController);
    await expect(controller.getChronotype(250)).resolves.toBe(payload);
    expect(stub).toHaveBeenCalledWith(250);
  });

  it("delegates to SteamGameRecapService.getGameRecap for a given appid", async () => {
    const payload = { appid: 367520, name: "Hollow Knight" } as unknown;
    const stub = vi.fn().mockResolvedValue(payload);

    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        { provide: SteamOwnedGamesService, useValue: {} },
        { provide: SteamTagService, useValue: {} },
        { provide: SteamAchievementsService, useValue: {} },
        { provide: SteamGameRecapService, useValue: { getGameRecap: stub } },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getGameRecap(367520)).resolves.toBe(payload);
    expect(stub).toHaveBeenCalledWith(367520);
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
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: { getPlayerState: stub } },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getPlayerState()).rejects.toBeInstanceOf(NotFoundException);
  });
});
