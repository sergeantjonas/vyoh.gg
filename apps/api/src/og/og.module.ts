import { Module } from "@nestjs/common";
import { ImgModule } from "../img/img.module";
import { LolModule } from "../lol/lol.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SteamModule } from "../steam/steam.module";
import { OgController } from "./og.controller";
import { OgService } from "./og.service";

@Module({
  imports: [LolModule, ImgModule, PrismaModule, SteamModule],
  controllers: [OgController],
  providers: [OgService],
})
export class OgModule {}
