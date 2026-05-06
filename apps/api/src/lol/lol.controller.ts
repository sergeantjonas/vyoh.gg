import { Controller, Get, Param } from "@nestjs/common";
import type { MatchSummary } from "@vyoh/shared";
import { LolService } from "./lol.service";

@Controller("lol/summoners/:region/:gameName/:tagLine")
export class LolController {
  constructor(private readonly lol: LolService) {}

  @Get("matches")
  async getMatches(
    @Param("region") region: string,
    @Param("gameName") gameName: string,
    @Param("tagLine") tagLine: string
  ): Promise<MatchSummary[]> {
    return this.lol.getMatchesForSummoner(region, gameName, tagLine);
  }
}
