import { Module } from "@nestjs/common";
import { RiotModule } from "../riot/riot.module";
import { LiveGamePollerService } from "./live-game-poller.service";
import { LolAnalyticsService } from "./lol-analytics.service";
import { LolController } from "./lol.controller";
import { LolService } from "./lol.service";
import { MatchEventsService } from "./match-events.service";
import { MatchSyncService } from "./match-sync.service";
import { MatchController } from "./match.controller";
import { PatchService } from "./patch.service";

@Module({
  imports: [RiotModule],
  controllers: [LolController, MatchController],
  providers: [
    LolService,
    LolAnalyticsService,
    MatchSyncService,
    MatchEventsService,
    LiveGamePollerService,
    PatchService,
  ],
  exports: [
    LolService,
    LolAnalyticsService,
    MatchSyncService,
    MatchEventsService,
    PatchService,
  ],
})
export class LolModule {}
