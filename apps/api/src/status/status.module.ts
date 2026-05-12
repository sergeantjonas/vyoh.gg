import { Module } from "@nestjs/common";
import { LolModule } from "../lol/lol.module";
import { RiotModule } from "../riot/riot.module";
import { StatusController } from "./status.controller";

@Module({
  imports: [RiotModule, LolModule],
  controllers: [StatusController],
})
export class StatusModule {}
