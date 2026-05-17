import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from "@nestjs/common";
import type { HomeChronotype } from "@vyoh/shared";
import { HomeChronotypeService } from "./home-chronotype.service";

@Controller("home")
export class HomeController {
  constructor(private readonly chronotype: HomeChronotypeService) {}

  @Get("chronotype")
  async getChronotype(
    @Query("count", new DefaultValuePipe(500), ParseIntPipe) count: number
  ): Promise<HomeChronotype> {
    return this.chronotype.getChronotype(count);
  }
}
