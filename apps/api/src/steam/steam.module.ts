import { Module } from "@nestjs/common";
import { SteamEnrichmentPoller } from "./enrichment.poller";
import { SteamEnrichmentService } from "./enrichment.service";
import { SteamOwnedGamesPoller } from "./owned-games.poller";
import { SteamOwnedGamesService } from "./owned-games.service";
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
    SteamTagService,
    SteamTagPoller,
  ],
  exports: [
    SteamService,
    SteamClientService,
    SteamRateLimiterService,
    SteamOwnedGamesService,
    SteamEnrichmentService,
    SteamTagService,
  ],
})
export class SteamModule {}
