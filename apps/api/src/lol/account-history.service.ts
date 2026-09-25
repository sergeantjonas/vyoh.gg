import { Injectable } from "@nestjs/common";
import type { AccountHistory } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LolService } from "./lol.service";

@Injectable()
export class AccountHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lol: LolService
  ) {}

  // Two indexed reads rather than the account's whole match list: a count and
  // the earliest row answer the question without shipping thousands of rows.
  async getAccountHistory(
    region: string,
    gameName: string,
    tagLine: string
  ): Promise<AccountHistory> {
    const { puuid } = await this.lol.resolveSummoner(region, gameName, tagLine);
    const where = { puuid, remake: false };
    const [totalGames, first] = await Promise.all([
      this.prisma.match.count({ where }),
      this.prisma.match.findFirst({
        where,
        orderBy: { playedAt: "asc" },
        select: {
          matchId: true,
          playedAt: true,
          champion: true,
          queueId: true,
          win: true,
        },
      }),
    ]);
    return {
      totalGames,
      firstGame: first ? { ...first, playedAt: first.playedAt.toISOString() } : null,
    };
  }
}
