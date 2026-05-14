import { Module } from "@nestjs/common";
import { SteamRateLimiterService } from "./rate-limiter.service";
import { SteamClientService } from "./steam-client.service";
import { SteamController } from "./steam.controller";
import { SteamService } from "./steam.service";

@Module({
  controllers: [SteamController],
  providers: [SteamRateLimiterService, SteamClientService, SteamService],
  exports: [SteamService, SteamClientService, SteamRateLimiterService],
})
export class SteamModule {}
