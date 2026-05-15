import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import type {
  SteamGameAchievements,
  SteamLibrarySummary,
  SteamOwnedGames,
  SteamPlatformMix,
  SteamRecentUnlocks,
  SteamSummary,
  SteamTagCatalog,
  SteamWishlist,
} from "@vyoh/shared";
import {
  RECENT_UNLOCKS_DEFAULT_LIMIT,
  SteamAchievementsService,
} from "./achievements.service";
import { SteamOwnedGamesService } from "./owned-games.service";
import { SteamService } from "./steam.service";
import { SteamTagService } from "./tag.service";

@Controller("steam")
export class SteamController {
  constructor(
    private readonly steam: SteamService,
    private readonly ownedGames: SteamOwnedGamesService,
    private readonly tags: SteamTagService,
    private readonly achievements: SteamAchievementsService
  ) {}

  @Get("summary")
  async getSummary(): Promise<SteamSummary> {
    return this.steam.getOwnerSummary();
  }

  @Get("wishlist")
  async getWishlist(): Promise<SteamWishlist> {
    return this.steam.getOwnerWishlist();
  }

  @Get("library-summary")
  async getLibrarySummary(): Promise<SteamLibrarySummary> {
    return this.ownedGames.getLibrarySummary();
  }

  @Get("platform-mix")
  async getPlatformMix(): Promise<SteamPlatformMix> {
    return this.ownedGames.getPlatformMix();
  }

  @Get("owned-games")
  async getOwnedGames(): Promise<SteamOwnedGames> {
    return this.ownedGames.getOwnedGames();
  }

  @Get("tags")
  async getTags(): Promise<SteamTagCatalog> {
    return this.tags.getCatalog();
  }

  @Get("game/:appid/achievements")
  async getGameAchievements(
    @Param("appid", ParseIntPipe) appid: number
  ): Promise<SteamGameAchievements> {
    return this.achievements.getGameAchievements(appid);
  }

  @Get("achievements/recent")
  async getRecentUnlocks(
    @Query("limit", new DefaultValuePipe(RECENT_UNLOCKS_DEFAULT_LIMIT), ParseIntPipe)
    limit: number
  ): Promise<SteamRecentUnlocks> {
    return this.achievements.getRecentUnlocks(limit);
  }
}
