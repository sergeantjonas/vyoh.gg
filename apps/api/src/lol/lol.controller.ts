import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  type MessageEvent,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Sse,
} from "@nestjs/common";
import type {
  CachedMatchesResult,
  ChampionExtras,
  MatchSummary,
  RankHistoryResponse,
  SummonerProfile,
} from "@vyoh/shared";
import type { Observable } from "rxjs";
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

  @Post("matches/sync")
  @HttpCode(200)
  async syncMatches(
    @Param("region") region: string,
    @Param("gameName") gameName: string,
    @Param("tagLine") tagLine: string
  ): Promise<{ idCount: number; backfilled: number }> {
    return this.lol.syncForSummoner(region, gameName, tagLine);
  }

  @Get("rank")
  async getRank(
    @Param("region") region: string,
    @Param("gameName") gameName: string,
    @Param("tagLine") tagLine: string
  ): Promise<SummonerProfile> {
    return this.lol.getSummonerProfile(region, gameName, tagLine);
  }

  @Get("rank/history")
  async getRankHistory(
    @Param("region") region: string,
    @Param("gameName") gameName: string,
    @Param("tagLine") tagLine: string,
    @Query("days", new ParseIntPipe({ optional: true })) days?: number
  ): Promise<RankHistoryResponse> {
    return this.lol.getRankHistory(region, gameName, tagLine, days);
  }

  @Get("champions/:championKey/stats")
  async getChampionExtras(
    @Param("region") region: string,
    @Param("gameName") gameName: string,
    @Param("tagLine") tagLine: string,
    @Param("championKey") championKey: string,
    @Query("queue", new DefaultValuePipe(undefined), new ParseIntPipe({ optional: true }))
    queue: number | undefined
  ): Promise<ChampionExtras> {
    return this.lol.getChampionExtras(region, gameName, tagLine, championKey, queue);
  }

  @Sse("matches/events")
  async matchEvents(
    @Param("region") region: string,
    @Param("gameName") gameName: string,
    @Param("tagLine") tagLine: string
  ): Promise<Observable<MessageEvent>> {
    return this.lol.subscribeToMatchEvents(region, gameName, tagLine);
  }
}
