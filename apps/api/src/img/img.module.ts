import { Module } from "@nestjs/common";
import { SteamModule } from "../steam/steam.module";
import { ImgPrewarmService } from "./img-prewarm.service";
import { ImgController } from "./img.controller";
import { LolImageService } from "./lol-image.service";
import { SteamImageService } from "./steam-image.service";

@Module({
  imports: [SteamModule],
  controllers: [ImgController],
  providers: [LolImageService, SteamImageService, ImgPrewarmService],
})
export class ImgModule {}
