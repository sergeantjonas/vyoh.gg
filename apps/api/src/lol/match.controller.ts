import { Controller, Get, Param } from "@nestjs/common";
import type { MatchDetail } from "@vyoh/shared";
import { LolService } from "./lol.service";

@Controller("lol/matches")
export class MatchController {
  constructor(private readonly lol: LolService) {}

  @Get(":matchId")
  async getMatch(@Param("matchId") matchId: string): Promise<MatchDetail> {
    return this.lol.getMatchDetail(matchId);
  }
}
