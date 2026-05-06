import { Module } from "@nestjs/common";
import { LolController } from "./lol.controller";

@Module({
  controllers: [LolController],
})
export class LolModule {}
