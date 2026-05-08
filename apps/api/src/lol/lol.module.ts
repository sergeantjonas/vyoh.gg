import { Module } from "@nestjs/common";
import { RiotModule } from "../riot/riot.module";
import { LolController } from "./lol.controller";
import { LolService } from "./lol.service";
import { MatchEventsService } from "./match-events.service";
import { MatchSyncService } from "./match-sync.service";
import { MatchController } from "./match.controller";

@Module({
  imports: [RiotModule],
  controllers: [LolController, MatchController],
  providers: [LolService, MatchSyncService, MatchEventsService],
  exports: [LolService],
})
export class LolModule {}
