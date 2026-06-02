import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
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
  imports: [PrismaModule],
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
})
export class HomeModule {}
