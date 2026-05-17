import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { HealthController } from "./health/health.controller";
import { HomeModule } from "./home/home.module";
import { IdentityModule } from "./identity/identity.module";
import { ImgModule } from "./img/img.module";
import { LolModule } from "./lol/lol.module";
import { OgModule } from "./og/og.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RiotModule } from "./riot/riot.module";
import { StatusModule } from "./status/status.module";
import { SteamModule } from "./steam/steam.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    IdentityModule,
    RiotModule,
    LolModule,
    ImgModule,
    OgModule,
    StatusModule,
    SteamModule,
    HomeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
