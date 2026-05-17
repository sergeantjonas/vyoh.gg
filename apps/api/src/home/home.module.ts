import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { HomeChronotypeService } from "./home-chronotype.service";
import { HomeWeeklyTotalsService } from "./home-weekly-totals.service";
import { HomeController } from "./home.controller";

@Module({
  imports: [PrismaModule],
  controllers: [HomeController],
  providers: [HomeChronotypeService, HomeWeeklyTotalsService],
})
export class HomeModule {}
