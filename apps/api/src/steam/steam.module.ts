import { Module } from "@nestjs/common";
import { SteamOwnedGamesPoller } from "./owned-games.poller";
import { SteamOwnedGamesService } from "./owned-games.service";
import { SteamRateLimiterService } from "./rate-limiter.service";
import { SteamClientService } from "./steam-client.service";
import { SteamController } from "./steam.controller";
import { SteamService } from "./steam.service";

@Module({
  controllers: [SteamController],
  providers: [
    SteamRateLimiterService,
    SteamClientService,
    SteamService,
    SteamOwnedGamesService,
    SteamOwnedGamesPoller,
  ],
  exports: [
    SteamService,
    SteamClientService,
    SteamRateLimiterService,
    SteamOwnedGamesService,
  ],
})
export class SteamModule {}
