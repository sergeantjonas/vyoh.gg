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
import { SteamPlayerStatePoller } from "./player-state.poller";
import { SteamPlayerStateService } from "./player-state.service";
import { SteamPlayerUnlocksPoller } from "./player-unlocks.poller";
import { SteamPlayerUnlocksService } from "./player-unlocks.service";
import { SteamRateLimiterService } from "./rate-limiter.service";
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
    SteamAchievementSchemaService,
    SteamAchievementSchemaPoller,
    SteamPlayerStateService,
    SteamPlayerStatePoller,
    SteamPlayerUnlocksService,
    SteamPlayerUnlocksPoller,
    SteamGlobalRarityService,
    SteamGlobalRarityPoller,
    SteamAchievementsService,
    SteamTagService,
    SteamTagPoller,
  ],
  exports: [
    SteamService,
    SteamClientService,
    SteamRateLimiterService,
    SteamOwnedGamesService,
    SteamEnrichmentService,
    SteamAchievementSchemaService,
    SteamPlayerStateService,
    SteamPlayerUnlocksService,
    SteamGlobalRarityService,
    SteamAchievementsService,
    SteamTagService,
  ],
})
export class SteamModule {}
