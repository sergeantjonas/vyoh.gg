import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SteamModule } from "../steam/steam.module";
import { HomeActivityIntensityService } from "./home-activity-intensity.service";
import { HomeChronotypeService } from "./home-chronotype.service";
import { HomeDaySplitService } from "./home-day-split.service";
import { HomeFirstPlayedService } from "./home-first-played.service";
import { HomeLifetimeTotalsService } from "./home-lifetime-totals.service";
import { HomeSessionLengthsService } from "./home-session-lengths.service";
import { HomeTodayService } from "./home-today.service";
import { HomeWeeklyTotalsService } from "./home-weekly-totals.service";
import { HomeController } from "./home.controller";

@Module({
  // `SteamModule` for `SteamGameCurationService` — the first-played tile can
  // name a Steam game, so it has to know which ones it may name.
  imports: [PrismaModule, SteamModule],
  controllers: [HomeController],
  providers: [
    HomeChronotypeService,
    HomeWeeklyTotalsService,
    HomeFirstPlayedService,
    HomeDaySplitService,
    HomeSessionLengthsService,
    HomeActivityIntensityService,
    HomeLifetimeTotalsService,
    HomeTodayService,
  ],
  // The OG module renders the conclusion share card from the same lifetime
  // totals the strip on `/` reads.
  exports: [HomeLifetimeTotalsService],
})
export class HomeModule {}
