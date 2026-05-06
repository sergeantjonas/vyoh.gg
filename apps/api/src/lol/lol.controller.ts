import { Controller, Get } from "@nestjs/common";
import type { MatchSummary } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";

@Controller("lol/summoners/:region/:name")
export class LolController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("matches")
  async getMatches(): Promise<MatchSummary[]> {
    const rows = await this.prisma.match.findMany({
      orderBy: { playedAt: "desc" },
    });
    return rows.map(({ playedAt, ...rest }) => ({
      ...rest,
      playedAt: playedAt.toISOString(),
    }));
  }
}
