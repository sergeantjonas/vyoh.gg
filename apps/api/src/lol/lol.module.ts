import { Module } from "@nestjs/common";
import { RiotModule } from "../riot/riot.module";
import { LolController } from "./lol.controller";
import { LolService } from "./lol.service";

@Module({
  imports: [RiotModule],
  controllers: [LolController],
  providers: [LolService],
})
export class LolModule {}
