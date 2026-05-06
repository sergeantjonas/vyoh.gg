import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import type { MatchSummary } from "@vyoh/shared";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";
import { type Regional, platformToRegional } from "../riot/regions";
import { RiotService } from "../riot/riot.service";
import { riotMatchToSummary } from "./match-mapper";

const DEFAULT_MATCH_COUNT = 20;

@Injectable()
export class LolService {
  private readonly logger = new Logger(LolService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly riot: RiotService,
    private readonly identity: IdentityService
  ) {}

  async getMatchesForSummoner(
    region: string,
    gameName: string,
    tagLine: string,
    count: number = DEFAULT_MATCH_COUNT
  ): Promise<MatchSummary[]> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }

    const summoner = await this.resolveSummoner(region, gameName, tagLine);
    const regional = platformToRegional(region);

    const matchIds = await this.riot.getMatchIdsByPuuid(summoner.puuid, regional, {
      count,
    });

    await this.backfillMissingMatches(summoner.puuid, matchIds, regional);

    const rows = await this.prisma.match.findMany({
      where: { puuid: summoner.puuid, matchId: { in: matchIds } },
      orderBy: { playedAt: "desc" },
    });

    return rows.map(({ playedAt, puuid: _puuid, ...rest }) => ({
      ...rest,
      playedAt: playedAt.toISOString(),
    }));
  }

  private async resolveSummoner(
    region: string,
    gameName: string,
    tagLine: string
  ): Promise<{ puuid: string }> {
    const cached = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (cached) {
      this.logger.log(`summoner cache HIT for ${gameName}#${tagLine}`);
      return cached;
    }

    this.logger.log(
      `summoner cache MISS for ${gameName}#${tagLine} — fetching Account-V1`
    );
    const regional = platformToRegional(region);
    const account = await this.riot.getAccountByRiotId(gameName, tagLine, regional);

    return this.prisma.summoner.upsert({
      where: { puuid: account.puuid },
      create: {
        puuid: account.puuid,
        gameName: account.gameName,
        tagLine: account.tagLine,
        region,
      },
      update: {
        gameName: account.gameName,
        tagLine: account.tagLine,
        region,
        fetchedAt: new Date(),
      },
    });
  }

  private async backfillMissingMatches(
    puuid: string,
    matchIds: string[],
    regional: Regional
  ): Promise<void> {
    if (matchIds.length === 0) return;

    const existing = await this.prisma.match.findMany({
      where: { puuid, matchId: { in: matchIds } },
      select: { matchId: true },
    });
    const have = new Set(existing.map((m) => m.matchId));
    const missing = matchIds.filter((id) => !have.has(id));

    this.logger.log(
      `match cache: ${have.size} hit, ${missing.length} missing for ${puuid}`
    );

    await Promise.all(
      missing.map(async (matchId) => {
        const detail = await this.riot.getMatchById(matchId, regional);
        const summary = riotMatchToSummary(detail, puuid);
        await this.prisma.match.upsert({
          where: { matchId_puuid: { matchId, puuid } },
          create: {
            ...summary,
            puuid,
            playedAt: new Date(summary.playedAt),
          },
          update: {
            ...summary,
            puuid,
            playedAt: new Date(summary.playedAt),
          },
        });
      })
    );
  }
}
