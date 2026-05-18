import { Controller, Get, Param } from "@nestjs/common";
import type { MatchDetail, MatchTimelineProjection } from "@vyoh/shared";
import { LolService } from "./lol.service";
import { MatchIdParamDto } from "./match-id-param.dto";

@Controller("lol/matches")
export class MatchController {
  constructor(private readonly lol: LolService) {}

  @Get(":matchId")
  async getMatch(@Param() { matchId }: MatchIdParamDto): Promise<MatchDetail> {
    return this.lol.getMatchDetail(matchId);
  }

  @Get(":matchId/timeline")
  async getTimeline(
    @Param() { matchId }: MatchIdParamDto
  ): Promise<MatchTimelineProjection> {
    return this.lol.getMatchTimeline(matchId);
  }
}
