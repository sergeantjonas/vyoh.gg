import { Module } from "@nestjs/common";
import { ImgController } from "./img.controller";
import { LolImageService } from "./lol-image.service";
import { SteamImageService } from "./steam-image.service";

@Module({
  controllers: [ImgController],
  providers: [LolImageService, SteamImageService],
})
export class ImgModule {}
