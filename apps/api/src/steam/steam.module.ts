import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SyncJobsModule } from "../sync-jobs/sync-jobs.module";
import { SteamAchievementSchemaPoller } from "./achievements/achievement-schema.poller";
import { SteamAchievementSchemaService } from "./achievements/achievement-schema.service";
import { SteamAchievementsService } from "./achievements/achievements.service";
import { SteamGlobalRarityPoller } from "./achievements/global-rarity.poller";
import { SteamGlobalRarityService } from "./achievements/global-rarity.service";
import { SteamPlayerUnlocksPoller } from "./achievements/player-unlocks.poller";
import { SteamPlayerUnlocksService } from "./achievements/player-unlocks.service";
import { SteamRecentlyPlayedUnlocksPoller } from "./achievements/recently-played-unlocks.poller";
import { SteamRateLimiterService } from "./client/rate-limiter.service";
import { SteamClientService } from "./client/steam-client.service";
import { SteamEnrichmentPoller } from "./enrichment/enrichment.poller";
import { SteamEnrichmentService } from "./enrichment/enrichment.service";
import { FaceDetectionService } from "./enrichment/face-detection.service";
import { SteamGridDbService } from "./enrichment/griddb.service";
import { SteamPicsService } from "./enrichment/pics.service";
import { SteamSubjectAnchorService } from "./enrichment/subject-anchor.service";
import { SteamTagPoller } from "./enrichment/tag.poller";
import { SteamTagService } from "./enrichment/tag.service";
import { SteamGameCurationService } from "./library/game-curation.service";
import { SteamGameRecapService } from "./library/game-recap.service";
import { SteamGameRefreshController } from "./library/game-refresh.controller";
import { SteamGameRefreshService } from "./library/game-refresh.service";
import { SteamOwnedGamesPoller } from "./library/owned-games.poller";
import { SteamOwnedGamesService } from "./library/owned-games.service";
import { SteamPortraitService } from "./portrait/portrait.service";
import { SteamPlaySessionsService } from "./presence/play-sessions.service";
import { SteamPlayerStatePoller } from "./presence/player-state.poller";
import { SteamPlayerStateService } from "./presence/player-state.service";
import { SteamChronotypeService } from "./presence/steam-chronotype.service";
import { SteamController } from "./steam.controller";
import { SteamService } from "./steam.service";
import { SteamUpcomingService } from "./store/upcoming.service";
import { SteamWishlistHeroService } from "./store/wishlist-hero.service";

@Module({
  // SteamController's reads are viewer-aware via @WithViewer(), and ViewerGuard
  // injects AuthService. Nest resolves a guard's dependencies from the module
  // that declares the controller, not from wherever the guard was defined, so
  // omitting this import fails at bootstrap rather than at the route.
  imports: [AuthModule, SyncJobsModule],
  controllers: [SteamController, SteamGameRefreshController],
  providers: [
    SteamRateLimiterService,
    SteamClientService,
    SteamChronotypeService,
    SteamGameCurationService,
    SteamService,
    SteamUpcomingService,
    SteamOwnedGamesService,
    SteamOwnedGamesPoller,
    SteamEnrichmentService,
    SteamEnrichmentPoller,
    SteamPicsService,
    SteamAchievementSchemaService,
    SteamAchievementSchemaPoller,
    SteamPlaySessionsService,
    SteamPlayerStateService,
    SteamPlayerStatePoller,
    SteamPlayerUnlocksService,
    SteamPlayerUnlocksPoller,
    SteamPortraitService,
    SteamRecentlyPlayedUnlocksPoller,
    SteamGlobalRarityService,
    SteamGlobalRarityPoller,
    SteamAchievementsService,
    SteamGameRecapService,
    SteamGameRefreshService,
    SteamGridDbService,
    SteamTagService,
    SteamTagPoller,
    SteamSubjectAnchorService,
    FaceDetectionService,
    SteamWishlistHeroService,
  ],
  exports: [
    SteamService,
    SteamGameCurationService,
    SteamClientService,
    SteamRateLimiterService,
    SteamOwnedGamesService,
    SteamEnrichmentService,
    SteamPicsService,
    SteamAchievementSchemaService,
    SteamPlayerStateService,
    SteamPlayerUnlocksService,
    SteamGlobalRarityService,
    SteamAchievementsService,
    SteamGridDbService,
    SteamTagService,
    SteamGameRecapService,
  ],
})
export class SteamModule {}
