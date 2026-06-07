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
  // Exported so the OG service (and any future composing module) can resolve
  // upstream asset URLs through the same wiki-primary + fallback chain the
  // proxy controller uses — single source of truth for asset resolution.
  exports: [LolImageService, SteamImageService],
})
export class ImgModule {}
