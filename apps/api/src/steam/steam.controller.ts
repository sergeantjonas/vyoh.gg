import { Controller, Get } from "@nestjs/common";
import type { SteamSummary, SteamWishlist } from "@vyoh/shared";
import { SteamService } from "./steam.service";

@Controller("steam")
export class SteamController {
  constructor(private readonly steam: SteamService) {}

  @Get("summary")
  async getSummary(): Promise<SteamSummary> {
    return this.steam.getOwnerSummary();
  }

  @Get("wishlist")
  async getWishlist(): Promise<SteamWishlist> {
    return this.steam.getOwnerWishlist();
  }
}
