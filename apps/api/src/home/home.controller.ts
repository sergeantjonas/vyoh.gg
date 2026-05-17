import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from "@nestjs/common";
import type { HomeChronotype, HomeWeeklyTotals } from "@vyoh/shared";
import { HomeChronotypeService } from "./home-chronotype.service";
import { HomeWeeklyTotalsService } from "./home-weekly-totals.service";

@Controller("home")
export class HomeController {
  constructor(
    private readonly chronotype: HomeChronotypeService,
    private readonly weeklyTotals: HomeWeeklyTotalsService
  ) {}

  @Get("chronotype")
  async getChronotype(
    @Query("count", new DefaultValuePipe(500), ParseIntPipe) count: number
  ): Promise<HomeChronotype> {
    return this.chronotype.getChronotype(count);
  }

  @Get("weekly-totals")
  async getWeeklyTotals(): Promise<HomeWeeklyTotals> {
    return this.weeklyTotals.getWeeklyTotals();
  }
}
