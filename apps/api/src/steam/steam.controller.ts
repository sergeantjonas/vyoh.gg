import {
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import type {
  SteamGameAchievements,
  SteamGameMedia,
  SteamLibrarySummary,
  SteamOwnedGames,
  SteamPlatformMix,
  SteamPlayerState,
  SteamRecentUnlocks,
  SteamSummary,
  SteamTagCatalog,
  SteamWishlist,
} from "@vyoh/shared";
import {
  RAREST_UNLOCKS_DEFAULT_LIMIT,
  RECENT_UNLOCKS_DEFAULT_LIMIT,
  SteamAchievementsService,
} from "./achievements.service";
import { SteamOwnedGamesService } from "./owned-games.service";
import { SteamPlayerStateService } from "./player-state.service";
import { SteamScreenshotService } from "./screenshot.service";
import { SteamService } from "./steam.service";
import { SteamTagService } from "./tag.service";

@Controller("steam")
export class SteamController {
  constructor(
    private readonly steam: SteamService,
    private readonly ownedGames: SteamOwnedGamesService,
    private readonly tags: SteamTagService,
    private readonly achievements: SteamAchievementsService,
    private readonly playerState: SteamPlayerStateService,
    private readonly screenshots: SteamScreenshotService
  ) {}

  @Get("summary")
  async getSummary(): Promise<SteamSummary> {
    return this.steam.getOwnerSummary();
  }

  // Cached presence snapshot, refreshed every 2 min by the player-state
  // poller. Distinct from `/summary` (which makes a live call + fetches
  // equipped cosmetics): this is the path frontend surfaces poll on a
  // 30–60s stale-time to drive "Now playing" without amplifying Steam load.
  @Get("player-state")
  async getPlayerState(): Promise<SteamPlayerState> {
    const state = await this.playerState.getPlayerState();
    if (!state) {
      // Boot backfill should close this gap immediately — a 404 here means
      // the table is genuinely empty (fresh DB, poller hasn't finished its
      // first call). Frontend renders nothing while it waits.
      throw new NotFoundException("Steam player state not yet populated.");
    }
    return state;
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

  // Lazy-fetched media payload (screenshots) triggered by tile hover. Blocks on
  // a fresh appdetails fetch on first hover; subsequent hovers within 30 days
  // serve from cache. Past the TTL, returns cached + revalidates in background.
  @Get("game/:appid/media")
  async getGameMedia(
    @Param("appid", ParseIntPipe) appid: number
  ): Promise<SteamGameMedia> {
    return this.screenshots.getGameMedia(appid);
  }

  @Get("achievements/recent")
  async getRecentUnlocks(
    @Query("limit", new DefaultValuePipe(RECENT_UNLOCKS_DEFAULT_LIMIT), ParseIntPipe)
    limit: number
  ): Promise<SteamRecentUnlocks> {
    return this.achievements.getRecentUnlocks(limit);
  }

  // Cross-game rarest unlocks — top-N by ascending global rarity, library-
  // wide. Shares the SteamRecentUnlocks shape with /achievements/recent;
  // distinct route since the sort is different and the caps differ.
  @Get("achievements/rarest")
  async getCrossGameRarest(
    @Query("limit", new DefaultValuePipe(RAREST_UNLOCKS_DEFAULT_LIMIT), ParseIntPipe)
    limit: number
  ): Promise<SteamRecentUnlocks> {
    return this.achievements.getCrossGameRarest(limit);
  }
}
