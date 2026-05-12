import { Module } from "@nestjs/common";
import { RateLimiterService } from "./rate-limiter.service";
import { RiotService } from "./riot.service";

@Module({
  providers: [RiotService, RateLimiterService],
  exports: [RiotService, RateLimiterService],
})
export class RiotModule {}
