import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SteamAchievementSchemaPoller } from "./achievement-schema.poller";
import { SteamAchievementSchemaService } from "./achievement-schema.service";
import { SteamAchievementsService } from "./achievements.service";
import { SteamEnrichmentPoller } from "./enrichment.poller";
import { SteamEnrichmentService } from "./enrichment.service";
import { FaceDetectionService } from "./face-detection.service";
import { SteamGameCurationService } from "./game-curation.service";
import { SteamGameRecapService } from "./game-recap.service";
import { SteamGlobalRarityPoller } from "./global-rarity.poller";
import { SteamGlobalRarityService } from "./global-rarity.service";
import { SteamGridDbService } from "./griddb.service";
import { SteamOwnedGamesPoller } from "./owned-games.poller";
import { SteamOwnedGamesService } from "./owned-games.service";
import { SteamPicsService } from "./pics.service";
import { SteamPlaySessionsService } from "./play-sessions.service";
import { SteamPlayerStatePoller } from "./player-state.poller";
import { SteamPlayerStateService } from "./player-state.service";
import { SteamPlayerUnlocksPoller } from "./player-unlocks.poller";
import { SteamPlayerUnlocksService } from "./player-unlocks.service";
import { SteamPortraitService } from "./portrait.service";
import { SteamRateLimiterService } from "./rate-limiter.service";
import { SteamRecentlyPlayedUnlocksPoller } from "./recently-played-unlocks.poller";
import { SteamChronotypeService } from "./steam-chronotype.service";
import { SteamClientService } from "./steam-client.service";
import { SteamController } from "./steam.controller";
import { SteamService } from "./steam.service";
import { SteamSubjectAnchorService } from "./subject-anchor.service";
import { SteamTagPoller } from "./tag.poller";
import { SteamTagService } from "./tag.service";
import { SteamUpcomingService } from "./upcoming.service";
import { SteamWishlistHeroService } from "./wishlist-hero.service";

@Module({
  // SteamController's reads are viewer-aware via @WithViewer(), and ViewerGuard
  // injects AuthService. Nest resolves a guard's dependencies from the module
  // that declares the controller, not from wherever the guard was defined, so
  // omitting this import fails at bootstrap rather than at the route.
  imports: [AuthModule],
  controllers: [SteamController],
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
