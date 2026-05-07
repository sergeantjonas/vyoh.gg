import { Module } from "@nestjs/common";
import { RiotModule } from "../riot/riot.module";
import { LolController } from "./lol.controller";
import { LolService } from "./lol.service";
import { MatchController } from "./match.controller";

@Module({
  imports: [RiotModule],
  controllers: [LolController, MatchController],
  providers: [LolService],
  exports: [LolService],
})
export class LolModule {}
