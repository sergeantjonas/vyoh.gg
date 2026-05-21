import { Module } from "@nestjs/common";
import { RiotModule } from "../riot/riot.module";
import { LiveGamePollerService } from "./live-game-poller.service";
import { LolAnalyticsService } from "./lol-analytics.service";
import { LolStaticSyncService } from "./lol-static-sync.service";
import { LolStaticController } from "./lol-static.controller";
import { LolController } from "./lol.controller";
import { LolService } from "./lol.service";
import { MatchBaselineService } from "./match-baseline.service";
import { MatchEventsService } from "./match-events.service";
import { MatchSyncService } from "./match-sync.service";
import { MatchController } from "./match.controller";
import { PatchController } from "./patch.controller";
import { PatchService } from "./patch.service";

@Module({
  imports: [RiotModule],
  controllers: [LolController, MatchController, PatchController, LolStaticController],
  providers: [
    LolService,
    LolAnalyticsService,
    MatchBaselineService,
    MatchSyncService,
    MatchEventsService,
    LiveGamePollerService,
    PatchService,
    LolStaticSyncService,
  ],
  exports: [
    LolService,
    LolAnalyticsService,
    MatchBaselineService,
    MatchSyncService,
    MatchEventsService,
    PatchService,
    LolStaticSyncService,
  ],
})
export class LolModule {}
