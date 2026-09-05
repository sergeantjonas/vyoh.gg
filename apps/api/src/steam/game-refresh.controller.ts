import { Controller, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import type { SteamGameRefreshResult } from "@vyoh/shared";
import { OwnerGuard } from "../auth/owner.guard";
import { SteamGameRefreshService } from "./game-refresh.service";
import { SteamAppidParamDto } from "./steam-appid-param.dto";

// Shares the `steam` prefix with SteamController but not the class: the read
// controller's spec builds its module by hand in every test, so one write
// route with its own dependency lives here instead of widening all of them.
@Controller("steam")
export class SteamGameRefreshController {
  constructor(private readonly refresh: SteamGameRefreshService) {}

  // Owner-only like the status-page triggers. 200 rather than Nest's default
  // 201 for POST: nothing is created, the response is the result of the run.
  @Post("game/:appid/refresh")
  @UseGuards(OwnerGuard)
  @HttpCode(200)
  refreshGame(@Param() { appid }: SteamAppidParamDto): Promise<SteamGameRefreshResult> {
    return this.refresh.refresh(appid);
  }
}
