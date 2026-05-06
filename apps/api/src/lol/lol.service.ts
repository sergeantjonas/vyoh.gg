import { Injectable } from "@nestjs/common";
import type { MatchSummary } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { platformToRegional } from "../riot/regions";
import { RiotService } from "../riot/riot.service";
import { riotMatchToSummary } from "./match-mapper";

const DEFAULT_MATCH_COUNT = 10;

@Injectable()
export class LolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly riot: RiotService
  ) {}

  async getMatchesForSummoner(
    region: string,
    gameName: string,
    tagLine: string,
    count: number = DEFAULT_MATCH_COUNT
  ): Promise<MatchSummary[]> {
    const regional = platformToRegional(region);

    const account = await this.riot.getAccountByRiotId(gameName, tagLine, regional);
    const matchIds = await this.riot.getMatchIdsByPuuid(account.puuid, regional, {
      count,
    });

    const summaries = await Promise.all(
      matchIds.map(async (matchId) => {
        const detail = await this.riot.getMatchById(matchId, regional);
        const summary = riotMatchToSummary(detail, account.puuid);
        await this.prisma.match.upsert({
          where: { matchId: summary.matchId },
          create: { ...summary, playedAt: new Date(summary.playedAt) },
          update: { ...summary, playedAt: new Date(summary.playedAt) },
        });
        return summary;
      })
    );

    return summaries.sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  }
}
