import { Controller, Get } from "@nestjs/common";
import type {
  SteamLibrarySummary,
  SteamOwnedGames,
  SteamPlatformMix,
  SteamSummary,
  SteamTagCatalog,
  SteamWishlist,
} from "@vyoh/shared";
import { SteamOwnedGamesService } from "./owned-games.service";
import { SteamService } from "./steam.service";
import { SteamTagService } from "./tag.service";

@Controller("steam")
export class SteamController {
  constructor(
    private readonly steam: SteamService,
    private readonly ownedGames: SteamOwnedGamesService,
    private readonly tags: SteamTagService
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
}
