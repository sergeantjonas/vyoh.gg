import { Controller, Get } from "@nestjs/common";
import type {
  SteamForeverGames,
  SteamLibrarySummary,
  SteamPlatformMix,
  SteamSummary,
  SteamWishlist,
} from "@vyoh/shared";
import { SteamOwnedGamesService } from "./owned-games.service";
import { SteamService } from "./steam.service";

@Controller("steam")
export class SteamController {
  constructor(
    private readonly steam: SteamService,
    private readonly ownedGames: SteamOwnedGamesService
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

  @Get("forever-games")
  async getForeverGames(): Promise<SteamForeverGames> {
    return this.ownedGames.getForeverGames();
  }
}
