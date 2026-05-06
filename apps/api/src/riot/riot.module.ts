import { Module } from "@nestjs/common";
import { RiotService } from "./riot.service";

@Module({
  providers: [RiotService],
  exports: [RiotService],
})
export class RiotModule {}
