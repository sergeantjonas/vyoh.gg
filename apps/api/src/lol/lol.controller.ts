import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import type { CachedMatchesResult, MatchSummary } from "@vyoh/shared";
import { LolService } from "./lol.service";

@Controller("lol/summoners/:region/:gameName/:tagLine")
export class LolController {
  constructor(private readonly lol: LolService) {}

  @Get("matches")
  async getMatches(
    @Param("region") region: string,
    @Param("gameName") gameName: string,
    @Param("tagLine") tagLine: string,
    @Query("start", new DefaultValuePipe(0), ParseIntPipe) start: number,
    @Query("count", new DefaultValuePipe(20), ParseIntPipe) count: number,
    @Query("queue", new ParseIntPipe({ optional: true })) queue?: number
  ): Promise<MatchSummary[]> {
    return this.lol.getMatchesForSummoner(region, gameName, tagLine, start, count, queue);
  }

  @Get("matches/cached")
  async getCachedMatches(
    @Param("region") region: string,
    @Param("gameName") gameName: string,
    @Param("tagLine") tagLine: string,
    @Query("start", new DefaultValuePipe(0), ParseIntPipe) start: number,
    @Query("count", new DefaultValuePipe(20), ParseIntPipe) count: number,
    @Query("queue", new ParseIntPipe({ optional: true })) queue?: number
  ): Promise<CachedMatchesResult> {
    return this.lol.getCachedMatches(region, gameName, tagLine, start, count, queue);
  }
}
