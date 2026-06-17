import {
  Body,
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
  CarryProfile,
  ChampionBuildFlowEntry,
  ChampionExtras,
  ChampionLanePhase,
  ChampionPair,
  ChampionRecap,
  ChampionRuneDiversityEntry,
  Chronotype,
  Duo,
  LiveMatch,
  MatchBaseline,
  MatchNarrativeLifetime,
  MatchNarrativeWindow,
  MatchSummary,
  ObjectiveFirsts,
  PregameCalibrationByQueue,
  RankHistoryResponse,
  Squad,
  SummonerProfile,
} from "@vyoh/shared";
import type { Observable } from "rxjs";
import {
  AccountParamsDto,
  BaselineParamsDto,
  ChampionAccountParamsDto,
} from "./account-params.dto";
import { LolAnalyticsService } from "./lol-analytics.service";
import { LolService } from "./lol.service";
import { MatchBaselineService } from "./match-baseline.service";
import { NarrativeWindowDto } from "./match-narrative.dto";
import { MatchNarrativeService } from "./match-narrative.service";

@Controller("lol/summoners/:region/:gameName/:tagLine")
export class LolController {
  constructor(
    private readonly lol: LolService,
    private readonly analytics: LolAnalyticsService,
    private readonly baseline: MatchBaselineService,
    private readonly narrative: MatchNarrativeService
  ) {}

  @Get("matches")
  async getMatches(
    @Param() { region, gameName, tagLine }: AccountParamsDto,
    @Query("start", new DefaultValuePipe(0), ParseIntPipe) start: number,
    @Query("count", new DefaultValuePipe(20), ParseIntPipe) count: number,
    @Query("queue", new ParseIntPipe({ optional: true })) queue?: number
  ): Promise<MatchSummary[]> {
    return this.lol.getMatchesForSummoner(region, gameName, tagLine, start, count, queue);
  }

  @Get("matches/cached")
  async getCachedMatches(
    @Param() { region, gameName, tagLine }: AccountParamsDto,
    @Query("start", new DefaultValuePipe(0), ParseIntPipe) start: number,
    @Query("count", new DefaultValuePipe(20), ParseIntPipe) count: number,
    @Query("queue", new ParseIntPipe({ optional: true })) queue?: number
  ): Promise<CachedMatchesResult> {
    return this.lol.getCachedMatches(region, gameName, tagLine, start, count, queue);
  }

  @Post("matches/sync")
  @HttpCode(200)
  async syncMatches(
    @Param() { region, gameName, tagLine }: AccountParamsDto
  ): Promise<{ idCount: number; backfilled: number }> {
    return this.lol.syncForSummoner(region, gameName, tagLine);
  }

  @Get("rank")
  async getRank(
    @Param() { region, gameName, tagLine }: AccountParamsDto
  ): Promise<SummonerProfile> {
    return this.lol.getSummonerProfile(region, gameName, tagLine);
  }

  @Get("duos")
  async getDuos(
    @Param() { region, gameName, tagLine }: AccountParamsDto,
    @Query("count", new DefaultValuePipe(100), ParseIntPipe) count: number
  ): Promise<Duo[]> {
    return this.analytics.getDuos(region, gameName, tagLine, count);
  }

  @Get("squads")
  async getSquads(
    @Param() { region, gameName, tagLine }: AccountParamsDto,
    @Query("count", new DefaultValuePipe(100), ParseIntPipe) count: number
  ): Promise<Squad[]> {
    return this.analytics.getSquads(region, gameName, tagLine, count);
  }

  @Get("pregame-calibration")
  async getPregameCalibration(
    @Param() { region, gameName, tagLine }: AccountParamsDto,
    @Query("queueIds") queueIdsRaw?: string
  ): Promise<PregameCalibrationByQueue> {
    const queueIds = queueIdsRaw
      ? queueIdsRaw
          .split(",")
          .map((s) => Number.parseInt(s, 10))
          .filter((n) => Number.isFinite(n))
      : undefined;
    return this.analytics.getPregameCalibration(region, gameName, tagLine, queueIds);
  }

  @Get("chronotype")
  async getChronotype(
    @Param() { region, gameName, tagLine }: AccountParamsDto,
    @Query("count", new DefaultValuePipe(500), ParseIntPipe) count: number
  ): Promise<Chronotype> {
    return this.analytics.getChronotype(region, gameName, tagLine, count);
  }

  @Get("champion-pairs")
  async getChampionPairs(
    @Param() { region, gameName, tagLine }: AccountParamsDto,
    @Query("count", new DefaultValuePipe(100), ParseIntPipe) count: number
  ): Promise<ChampionPair[]> {
    return this.analytics.getChampionPairs(region, gameName, tagLine, count);
  }

  @Get("carry-profile")
  async getCarryProfile(
    @Param() { region, gameName, tagLine }: AccountParamsDto,
    @Query("count", new DefaultValuePipe(100), ParseIntPipe) count: number
  ): Promise<CarryProfile> {
    return this.analytics.getCarryProfile(region, gameName, tagLine, count);
  }

  @Get("objective-firsts")
  async getObjectiveFirsts(
    @Param() { region, gameName, tagLine }: AccountParamsDto,
    @Query("count", new DefaultValuePipe(100), ParseIntPipe) count: number
  ): Promise<ObjectiveFirsts> {
    return this.analytics.getObjectiveFirsts(region, gameName, tagLine, count);
  }

  @Get("champions/:championKey/build-flow")
  async getChampionBuildFlow(
    @Param() { region, gameName, tagLine, championKey }: ChampionAccountParamsDto,
    @Query("count", new DefaultValuePipe(100), ParseIntPipe) count: number
  ): Promise<ChampionBuildFlowEntry[]> {
    return this.analytics.getChampionBuildFlow(
      region,
      gameName,
      tagLine,
      championKey,
      count
    );
  }

  @Get("champions/:championKey/rune-diversity")
  async getChampionRuneDiversity(
    @Param() { region, gameName, tagLine, championKey }: ChampionAccountParamsDto,
    @Query("count", new DefaultValuePipe(100), ParseIntPipe) count: number
  ): Promise<ChampionRuneDiversityEntry[]> {
    return this.analytics.getChampionRuneDiversity(
      region,
      gameName,
      tagLine,
      championKey,
      count
    );
  }

  @Get("champions/:championKey/lane-phase")
  async getChampionLanePhase(
    @Param() { region, gameName, tagLine, championKey }: ChampionAccountParamsDto,
    @Query("count", new DefaultValuePipe(100), ParseIntPipe) count: number
  ): Promise<ChampionLanePhase> {
    return this.analytics.getChampionLanePhase(
      region,
      gameName,
      tagLine,
      championKey,
      count
    );
  }

  @Get("rank/history")
  async getRankHistory(
    @Param() { region, gameName, tagLine }: AccountParamsDto,
    @Query("days", new ParseIntPipe({ optional: true })) days?: number
  ): Promise<RankHistoryResponse> {
    return this.lol.getRankHistory(region, gameName, tagLine, days);
  }

  @Get("champions/:championKey/stats")
  async getChampionExtras(
    @Param() { region, gameName, tagLine, championKey }: ChampionAccountParamsDto,
    @Query("queues") queuesRaw?: string
  ): Promise<ChampionExtras> {
    const queues = queuesRaw
      ? queuesRaw
          .split(",")
          .map((s) => Number.parseInt(s, 10))
          .filter((n) => Number.isFinite(n))
      : undefined;
    return this.analytics.getChampionExtras(
      region,
      gameName,
      tagLine,
      championKey,
      queues
    );
  }

  @Get("champions/:championKey/recap")
  async getChampionRecap(
    @Param() { region, gameName, tagLine, championKey }: ChampionAccountParamsDto
  ): Promise<ChampionRecap> {
    return this.analytics.getChampionRecap(region, gameName, tagLine, championKey);
  }

  @Sse("matches/events")
  async matchEvents(
    @Param() { region, gameName, tagLine }: AccountParamsDto
  ): Promise<Observable<MessageEvent>> {
    return this.lol.subscribeToMatchEvents(region, gameName, tagLine);
  }

  @Get("live")
  async getLiveGame(
    @Param() { region, gameName, tagLine }: AccountParamsDto
  ): Promise<LiveMatch | null> {
    return this.lol.getLiveGame(region, gameName, tagLine);
  }

  @Sse("live/events")
  async liveEvents(
    @Param() { region, gameName, tagLine }: AccountParamsDto
  ): Promise<Observable<MessageEvent>> {
    return this.lol.subscribeLiveEvents(region, gameName, tagLine);
  }

  @Get("baselines/:championAlias/:role")
  async getBaseline(
    @Param() { region, gameName, tagLine, championAlias, role }: BaselineParamsDto
  ): Promise<MatchBaseline> {
    return this.baseline.getBaseline(region, gameName, tagLine, championAlias, role);
  }

  @Post("narrative")
  @HttpCode(200)
  async getNarrativeWindow(
    @Param() { region, gameName, tagLine }: AccountParamsDto,
    @Body() { matchIds }: NarrativeWindowDto
  ): Promise<MatchNarrativeWindow> {
    return this.narrative.getNarrativeWindow(region, gameName, tagLine, matchIds);
  }

  @Get("narrative/lifetime")
  async getNarrativeLifetime(
    @Param() { region, gameName, tagLine }: AccountParamsDto
  ): Promise<MatchNarrativeLifetime> {
    return this.narrative.getLifetimeNarrative(region, gameName, tagLine);
  }
}
