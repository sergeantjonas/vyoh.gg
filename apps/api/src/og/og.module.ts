import { Module } from "@nestjs/common";
import { LolModule } from "../lol/lol.module";
import { OgController } from "./og.controller";
import { OgService } from "./og.service";

@Module({
  imports: [LolModule],
  controllers: [OgController],
  providers: [OgService],
})
export class OgModule {}
