import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { HomeChronotypeService } from "./home-chronotype.service";
import { HomeDaySplitService } from "./home-day-split.service";
import { HomeFirstPlayedService } from "./home-first-played.service";
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
  ],
})
export class HomeModule {}
