import { Injectable } from "@nestjs/common";
import type { MatchBaseline } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LolService } from "./lol.service";

const SAMPLE_MIN = 5;
const MAX_GAMES = 50;

export function winsorizedMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const clip = Math.floor(sorted.length * 0.1);
  const clipped = clip > 0 ? sorted.slice(clip, -clip) : sorted;
  const mid = Math.floor(clipped.length / 2);
  return clipped.length % 2 === 0
    ? ((clipped[mid - 1] ?? 0) + (clipped[mid] ?? 0)) / 2
    : (clipped[mid] ?? 0);
}

@Injectable()
export class MatchBaselineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lol: LolService
  ) {}

  async getBaseline(
    region: string,
    gameName: string,
    tagLine: string,
    championAlias: string,
    role: string
  ): Promise<MatchBaseline> {
    const summoner = await this.lol.resolveSummoner(region, gameName, tagLine);

    // Non-remake Rift games on this champion. teamPosition is empty for ARAM/Arena
    // so filtering { not: "" } naturally excludes non-positional queues.
    const rows = await this.prisma.match.findMany({
      where: {
        puuid: summoner.puuid,
        champion: { equals: championAlias, mode: "insensitive" },
        remake: false,
        teamPosition: { not: "" },
      },
      select: {
        matchId: true,
        kills: true,
        deaths: true,
        assists: true,
        damageShare: true,
        csAt10: true,
        visionScore: true,
        teamPosition: true,
      },
      orderBy: { playedAt: "desc" },
      take: MAX_GAMES,
    });

    if (rows.length === 0) {
      return { state: "first-game", sampleSize: 0 };
    }

    // Second query: fetch totalTimeSpentDead from the detail cache for the
    // same matchIds. One IN query — not N+1. The field lives in the raw Riot
    // JSON, not in the Match summary row.
    type DetailJson = {
      info: { participants: Array<{ puuid: string; totalTimeSpentDead: number }> };
    };
    const detailRows = await this.prisma.matchDetailCache.findMany({
      where: { matchId: { in: rows.map((r) => r.matchId) } },
      select: { matchId: true, detail: true },
    });
    const timeDeadByMatchId = new Map<string, number>();
    for (const dr of detailRows) {
      const p = (dr.detail as DetailJson).info?.participants?.find(
        (participant) => participant.puuid === summoner.puuid
      );
      if (p?.totalTimeSpentDead !== undefined) {
        timeDeadByMatchId.set(dr.matchId, p.totalTimeSpentDead);
      }
    }

    const sameRole = rows.filter((r) => r.teamPosition === role);
    const useRows = sameRole.length >= SAMPLE_MIN ? sameRole : rows;
    const state =
      sameRole.length >= SAMPLE_MIN
        ? "full"
        : rows.length >= SAMPLE_MIN
          ? "champion-only"
          : "first-game";

    if (state === "first-game") {
      return { state, sampleSize: useRows.length };
    }

    const timeDeadValues = useRows
      .map((r) => timeDeadByMatchId.get(r.matchId))
      .filter((v): v is number => v !== undefined);

    return {
      state,
      sampleSize: useRows.length,
      kda: winsorizedMedian(
        useRows.map((r) => (r.kills + r.assists) / Math.max(1, r.deaths))
      ),
      damageShare: winsorizedMedian(useRows.map((r) => r.damageShare)),
      csAt10: winsorizedMedian(useRows.map((r) => r.csAt10)),
      visionScore: winsorizedMedian(useRows.map((r) => r.visionScore)),
      ...(timeDeadValues.length > 0
        ? { timeDead: winsorizedMedian(timeDeadValues) }
        : {}),
    };
  }
}
