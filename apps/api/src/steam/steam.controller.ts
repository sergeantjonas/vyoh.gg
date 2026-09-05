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
  GameUnlockTimeline,
  SteamChronotype,
  SteamCompletionCandidates,
  SteamGameAchievements,
  SteamGameDescription,
  SteamGameRecap,
  SteamGameScreenshots,
  SteamLibraryCompletion,
  SteamLibrarySummary,
  SteamOwnedGames,
  SteamPlatformMix,
  SteamPlayerState,
  SteamPortrait,
  SteamRecentUnlocks,
  SteamSummary,
  SteamTagCatalog,
  SteamUpcoming,
  SteamWishlist,
  SteamWishlistHeroMeta,
} from "@vyoh/shared";
import { isHiddenGame } from "@vyoh/shared";
import { ViewerIsOwner, WithViewer } from "../auth/viewer";
import { COUNT_PIPE, LIMIT_PIPE } from "../bounded-int.pipe";
import {
  RAREST_UNLOCKS_DEFAULT_LIMIT,
  RECENT_UNLOCKS_DEFAULT_LIMIT,
  SteamAchievementsService,
} from "./achievements.service";
import { SteamGameCurationService } from "./game-curation.service";
import { SteamGameRecapService } from "./game-recap.service";
import { SteamOwnedGamesService } from "./owned-games.service";
import { SteamPlayerStateService } from "./player-state.service";
import { SteamPortraitService } from "./portrait.service";
import { SteamChronotypeService } from "./steam-chronotype.service";
import { SteamService } from "./steam.service";
import { SteamTagService } from "./tag.service";
import { SteamUpcomingService } from "./upcoming.service";
import { SteamWishlistHeroService } from "./wishlist-hero.service";

@Controller("steam")
export class SteamController {
  constructor(
    private readonly steam: SteamService,
    private readonly ownedGames: SteamOwnedGamesService,
    private readonly tags: SteamTagService,
    private readonly achievements: SteamAchievementsService,
    private readonly gameRecap: SteamGameRecapService,
    private readonly playerState: SteamPlayerStateService,
    private readonly chronotype: SteamChronotypeService,
    private readonly wishlistHero: SteamWishlistHeroService,
    private readonly upcoming: SteamUpcomingService,
    private readonly portrait: SteamPortraitService,
    private readonly curation: SteamGameCurationService
  ) {}

  @Get("summary")
  @WithViewer()
  async getSummary(@ViewerIsOwner() isOwner: boolean): Promise<SteamSummary> {
    return this.steam.getOwnerSummary(await this.curation.getCurationFor(isOwner));
  }

  // Cached presence snapshot, refreshed every 2 min by the player-state
  // poller. Distinct from `/summary` (which makes a live call + fetches
  // equipped cosmetics): this is the path frontend surfaces poll on a
  // 30–60s stale-time to drive "Now playing" without amplifying Steam load.
  @Get("player-state")
  @WithViewer()
  async getPlayerState(@ViewerIsOwner() isOwner: boolean): Promise<SteamPlayerState> {
    const state = await this.playerState.getPlayerState(
      await this.curation.getCurationFor(isOwner)
    );
    if (!state) {
      // Boot backfill should close this gap immediately — a 404 here means
      // the table is genuinely empty (fresh DB, poller hasn't finished its
      // first call). Frontend renders nothing while it waits.
      throw new NotFoundException("Steam player state not yet populated.");
    }
    return state;
  }

  /**
   * Every route below that names a game is viewer-aware: `@WithViewer()`
   * resolves who is asking and marks the response uncacheable by anything
   * shared, `@ViewerIsOwner()` reads the answer, and the curation sets are
   * resolved once here and handed down. The services take the sets as a required
   * argument rather than reaching for them, so a new read path cannot
   * accidentally skip the filter — it won't compile without answering the
   * question. Routes that emit only numbers are deliberately untouched: hidden
   * games still count toward totals, anonymously.
   */
  @Get("wishlist")
  @WithViewer()
  async getWishlist(@ViewerIsOwner() isOwner: boolean): Promise<SteamWishlist> {
    return this.steam.getOwnerWishlist(await this.curation.getCurationFor(isOwner));
  }

  // Unreleased titles from both provenances: wishlisted, and owned-but-unlaunched
  // (pre-orders, which Steam deletes from the wishlist at purchase). Separate
  // from /wishlist rather than a flag on it, because the two answer different
  // questions — this one is "what is coming", that one is "what am I watching",
  // and only the first has to survive a purchase.
  @Get("upcoming")
  @WithViewer()
  async getUpcoming(@ViewerIsOwner() isOwner: boolean): Promise<SteamUpcoming> {
    return this.upcoming.getUpcoming(await this.curation.getCurationFor(isOwner));
  }

  // On-read enrichment for the Upcoming view's imminent hero — accent,
  // platforms, ESRB, and blurb for the nearest day-precise wishlist title.
  // Carved out per-app (not folded into /wishlist) because the candidate is
  // almost always unowned: it has no enrichment row, so its metadata is
  // projected per request from a fresh GetItems(full) call + a Vibrant accent
  // pass, then TTL-cached. NotFound (from the service) when the store page is
  // unresolvable, which the web hook treats as "skip the hero".
  // A hidden appid is outside the upcoming set as far as the membership guard is
  // concerned, so this 404s for a visitor exactly as it would for an appid the
  // owner never wishlisted — the two are indistinguishable from outside.
  @Get("wishlist/:appid/hero-meta")
  @WithViewer()
  async getWishlistHeroMeta(
    @Param("appid", ParseIntPipe) appid: number,
    @ViewerIsOwner() isOwner: boolean
  ): Promise<SteamWishlistHeroMeta> {
    return this.wishlistHero.getHeroMeta(
      appid,
      await this.curation.getCurationFor(isOwner)
    );
  }

  @Get("library-summary")
  async getLibrarySummary(): Promise<SteamLibrarySummary> {
    return this.ownedGames.getLibrarySummary();
  }

  @Get("platform-mix")
  async getPlatformMix(): Promise<SteamPlatformMix> {
    return this.ownedGames.getPlatformMix();
  }

  @Get("portrait")
  @WithViewer()
  async getPortrait(@ViewerIsOwner() isOwner: boolean): Promise<SteamPortrait> {
    return this.portrait.getPortrait(await this.curation.getCurationFor(isOwner));
  }

  @Get("owned-games")
  @WithViewer()
  async getOwnedGames(@ViewerIsOwner() isOwner: boolean): Promise<SteamOwnedGames> {
    return this.ownedGames.getOwnedGames(await this.curation.getCurationFor(isOwner));
  }

  @Get("tags")
  async getTags(): Promise<SteamTagCatalog> {
    return this.tags.getCatalog();
  }

  /**
   * 404s a per-app route whose appid the caller isn't allowed to see.
   *
   * The four `game/:appid/*` routes below shape their response from one appid
   * rather than filtering a list, so the gate is a refusal rather than a filter.
   * A refusal is also the better answer: an empty achievements payload for a
   * hidden game says "this game has none", which is both a lie and a tell.
   * NotFound is what the same routes already return for an appid outside the
   * library, so a hidden game is indistinguishable from one the owner never
   * bought.
   */
  private async assertVisible(appid: number, isOwner: boolean): Promise<void> {
    const curation = await this.curation.getCurationFor(isOwner);
    if (isHiddenGame(appid, curation)) {
      throw new NotFoundException(`Steam app ${appid} is not in the tracked library.`);
    }
  }

  @Get("game/:appid/achievements")
  @WithViewer()
  async getGameAchievements(
    @Param("appid", ParseIntPipe) appid: number,
    @ViewerIsOwner() isOwner: boolean
  ): Promise<SteamGameAchievements> {
    await this.assertVisible(appid, isOwner);
    return this.achievements.getGameAchievements(appid);
  }

  // Per-app BBCode body for the game-detail "About this game" block. Carved
  // out from the bulk owned-games payload because each game's description is
  // 2-8KB; bulk-shipping 200+ games would inflate the list response.
  @Get("game/:appid/description")
  @WithViewer()
  async getGameDescription(
    @Param("appid", ParseIntPipe) appid: number,
    @ViewerIsOwner() isOwner: boolean
  ): Promise<SteamGameDescription> {
    await this.assertVisible(appid, isOwner);
    return this.ownedGames.getGameDescription(appid);
  }

  // Per-app screenshot buckets for the /steam/game/$appid strip + (Chunk 9c)
  // the library-tile hovercard rotation. Both buckets returned; renderers
  // pick which to surface (all-ages default; mature gated behind an
  // owner-opt-in toggle when the auth model lands).
  @Get("game/:appid/screenshots")
  @WithViewer()
  async getGameScreenshots(
    @Param("appid", ParseIntPipe) appid: number,
    @ViewerIsOwner() isOwner: boolean
  ): Promise<SteamGameScreenshots> {
    await this.assertVisible(appid, isOwner);
    return this.ownedGames.getGameScreenshots(appid);
  }

  @Get("achievements/recent")
  @WithViewer()
  async getRecentUnlocks(
    @Query("limit", new DefaultValuePipe(RECENT_UNLOCKS_DEFAULT_LIMIT), LIMIT_PIPE)
    limit: number,
    @ViewerIsOwner() isOwner: boolean
  ): Promise<SteamRecentUnlocks> {
    return this.achievements.getRecentUnlocks(
      limit,
      await this.curation.getCurationFor(isOwner)
    );
  }

  // Cross-game rarest unlocks — top-N by ascending global rarity, library-
  // wide. Shares the SteamRecentUnlocks shape with /achievements/recent;
  // distinct route since the sort is different and the caps differ.
  @Get("achievements/rarest")
  @WithViewer()
  async getCrossGameRarest(
    @Query("limit", new DefaultValuePipe(RAREST_UNLOCKS_DEFAULT_LIMIT), LIMIT_PIPE)
    limit: number,
    @ViewerIsOwner() isOwner: boolean
  ): Promise<SteamRecentUnlocks> {
    return this.achievements.getCrossGameRarest(
      limit,
      await this.curation.getCurationFor(isOwner)
    );
  }

  // Per-game completion totals across the whole library. Drives the
  // completionist axis card (median % across played-with-achievements
  // games) and the 100%'d hall (filter total === unlocked > 0). One trip
  // to the DB on the request — backed by two grouped queries joined in
  // service code; no per-game N+1.
  @Get("achievements/library-completion")
  @WithViewer()
  async getLibraryCompletion(
    @ViewerIsOwner() isOwner: boolean
  ): Promise<SteamLibraryCompletion> {
    return this.achievements.getLibraryCompletion(
      await this.curation.getCurationFor(isOwner)
    );
  }

  // "Nearest 100%" planner — started-but-unfinished games ranked by the
  // estimated effort left, scored in `@vyoh/shared`. Whole eligible list,
  // already sorted; the surfaces cap what they show.
  @Get("achievements/completion-candidates")
  @WithViewer()
  async getCompletionCandidates(
    @ViewerIsOwner() isOwner: boolean
  ): Promise<SteamCompletionCandidates> {
    return this.achievements.getCompletionCandidates(
      await this.curation.getCurationFor(isOwner)
    );
  }

  @Get("game/:appid/unlock-timeline")
  @WithViewer()
  async getUnlockTimeline(
    @Param("appid", ParseIntPipe) appid: number,
    @ViewerIsOwner() isOwner: boolean
  ): Promise<GameUnlockTimeline> {
    await this.assertVisible(appid, isOwner);
    return this.achievements.getUnlockTimeline(appid);
  }

  // Per-game landing-page recap — composes owned-game row + achievements +
  // screenshots into the slim shape consumed by the Steam subject chapter.
  // Throws NotFound when the appid isn't in the tracked library (vs returning
  // a zero-state, which would mask a config mistake as honest empty-state).
  @Get("game/:appid/recap")
  @WithViewer()
  async getGameRecap(
    @Param("appid", ParseIntPipe) appid: number,
    @ViewerIsOwner() isOwner: boolean
  ): Promise<SteamGameRecap> {
    return this.gameRecap.getGameRecap(
      appid,
      await this.curation.getCurationFor(isOwner)
    );
  }

  @Get("chronotype")
  async getChronotype(
    @Query("count", new DefaultValuePipe(500), COUNT_PIPE) count: number
  ): Promise<SteamChronotype> {
    return this.chronotype.getChronotype(count);
  }
}
