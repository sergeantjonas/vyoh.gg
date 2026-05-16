import { Module } from "@nestjs/common";
import { SteamAchievementSchemaPoller } from "./achievement-schema.poller";
import { SteamAchievementSchemaService } from "./achievement-schema.service";
import { SteamAchievementsService } from "./achievements.service";
import { SteamEnrichmentPoller } from "./enrichment.poller";
import { SteamEnrichmentService } from "./enrichment.service";
import { SteamGlobalRarityPoller } from "./global-rarity.poller";
import { SteamGlobalRarityService } from "./global-rarity.service";
import { SteamOwnedGamesPoller } from "./owned-games.poller";
import { SteamOwnedGamesService } from "./owned-games.service";
import { SteamPicsService } from "./pics.service";
import { SteamPlaySessionsService } from "./play-sessions.service";
import { SteamPlayerStatePoller } from "./player-state.poller";
import { SteamPlayerStateService } from "./player-state.service";
import { SteamPlayerUnlocksPoller } from "./player-unlocks.poller";
import { SteamPlayerUnlocksService } from "./player-unlocks.service";
import { SteamRateLimiterService } from "./rate-limiter.service";
import { SteamRecentlyPlayedUnlocksPoller } from "./recently-played-unlocks.poller";
import { SteamScreenshotService } from "./screenshot.service";
import { SteamClientService } from "./steam-client.service";
import { SteamController } from "./steam.controller";
import { SteamService } from "./steam.service";
import { SteamTagPoller } from "./tag.poller";
import { SteamTagService } from "./tag.service";

@Module({
  controllers: [SteamController],
  providers: [
    SteamRateLimiterService,
    SteamClientService,
    SteamService,
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
    SteamRecentlyPlayedUnlocksPoller,
    SteamGlobalRarityService,
    SteamGlobalRarityPoller,
    SteamAchievementsService,
    SteamTagService,
    SteamTagPoller,
    SteamScreenshotService,
  ],
  exports: [
    SteamService,
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
    SteamTagService,
  ],
})
export class SteamModule {}
