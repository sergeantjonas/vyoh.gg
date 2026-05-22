import { Injectable } from "@nestjs/common";
import type { MatchNarrativeLifetime, MatchNarrativeWindow } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LolService } from "./lol.service";

const MAX_MATCH_IDS = 1000;
// Hard cap on lifetime detail-row scan. A heavy account hits ~5000 stored
// matches; the JSON-scan + sum is cheap per row but unbounded growth would
// eventually starve other queries. The cap is high enough that no real user
// hits it today.
const LIFETIME_MAX_MATCHES = 10000;

type StoredDetailJson = {
  info: {
    participants: Array<{
      puuid: string;
      isOwner?: boolean;
      doubleKills?: number;
      tripleKills?: number;
      quadraKills?: number;
      pentaKills?: number;
      largestKillingSpree?: number;
      challenges?: {
        soloKills?: number;
        outnumberedKills?: number;
        survivedSingleDigitHpCount?: number;
      };
    }>;
  };
};

@Injectable()
export class MatchNarrativeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lol: LolService
  ) {}

  /**
   * Aggregate owner challenge counts across the requested matches. Owner
   * challenges live in MatchDetailCache.detail (not the lean MatchSummary
   * row) so this fetches one row per matchId and sums the projected fields.
   * Remakes are excluded per the LoL invariant before any counting happens.
   */
  async getNarrativeWindow(
    region: string,
    gameName: string,
    tagLine: string,
    matchIds: readonly string[]
  ): Promise<MatchNarrativeWindow> {
    if (matchIds.length === 0) {
      return {
        matchCount: 0,
        remakeCount: 0,
        highlightReel: {
          soloKills: 0,
          outnumberedKills: 0,
          survivedSingleDigitHpCount: 0,
        },
      };
    }

    const summoner = await this.lol.resolveSummoner(region, gameName, tagLine);
    const ids = matchIds.slice(0, MAX_MATCH_IDS);

    // Filter to matches the owner actually played and exclude remakes in the
    // same query. `puuid` + `remake: false` enforces both invariants at the
    // database boundary; we can't trust caller-supplied IDs to already be
    // owner-scoped.
    const rows = await this.prisma.match.findMany({
      where: {
        matchId: { in: ids },
        puuid: summoner.puuid,
        remake: false,
      },
      select: { matchId: true },
    });
    const remakeCount = ids.length - rows.length;

    if (rows.length === 0) {
      return {
        matchCount: 0,
        remakeCount,
        highlightReel: {
          soloKills: 0,
          outnumberedKills: 0,
          survivedSingleDigitHpCount: 0,
        },
      };
    }

    const detailRows = await this.prisma.matchDetailCache.findMany({
      where: { matchId: { in: rows.map((r) => r.matchId) } },
      select: { matchId: true, detail: true },
    });

    let soloKills = 0;
    let outnumberedKills = 0;
    let survivedSingleDigitHpCount = 0;
    let countedMatches = 0;

    for (const dr of detailRows) {
      const detail = dr.detail as StoredDetailJson;
      const owner = detail.info?.participants?.find((p) => p.puuid === summoner.puuid);
      if (!owner) continue;
      countedMatches++;
      soloKills += owner.challenges?.soloKills ?? 0;
      outnumberedKills += owner.challenges?.outnumberedKills ?? 0;
      survivedSingleDigitHpCount += owner.challenges?.survivedSingleDigitHpCount ?? 0;
    }

    return {
      matchCount: countedMatches,
      remakeCount,
      highlightReel: {
        soloKills,
        outnumberedKills,
        survivedSingleDigitHpCount,
      },
    };
  }

  /**
   * Lifetime multikill totals across every non-remake game the owner played
   * that has a cached detail row. The Match table doesn't carry the multikill
   * fields (they live in MatchDetailCache.detail under the participant root,
   * not under challenges) so we still fan out one IN-query per puuid.
   */
  async getLifetimeNarrative(
    region: string,
    gameName: string,
    tagLine: string
  ): Promise<MatchNarrativeLifetime> {
    const summoner = await this.lol.resolveSummoner(region, gameName, tagLine);

    const rows = await this.prisma.match.findMany({
      where: { puuid: summoner.puuid, remake: false },
      select: { matchId: true },
      orderBy: { playedAt: "desc" },
      take: LIFETIME_MAX_MATCHES,
    });

    if (rows.length === 0) {
      return {
        matchCount: 0,
        multikills: {
          pentaKills: 0,
          quadraKills: 0,
          tripleKills: 0,
          doubleKills: 0,
          largestKillingSpree: 0,
        },
      };
    }

    const detailRows = await this.prisma.matchDetailCache.findMany({
      where: { matchId: { in: rows.map((r) => r.matchId) } },
      select: { matchId: true, detail: true },
    });

    let pentaKills = 0;
    let quadraKills = 0;
    let tripleKills = 0;
    let doubleKills = 0;
    let largestKillingSpree = 0;
    let countedMatches = 0;

    for (const dr of detailRows) {
      const detail = dr.detail as StoredDetailJson;
      const owner = detail.info?.participants?.find((p) => p.puuid === summoner.puuid);
      if (!owner) continue;
      countedMatches++;
      pentaKills += owner.pentaKills ?? 0;
      quadraKills += owner.quadraKills ?? 0;
      tripleKills += owner.tripleKills ?? 0;
      doubleKills += owner.doubleKills ?? 0;
      const spree = owner.largestKillingSpree ?? 0;
      if (spree > largestKillingSpree) largestKillingSpree = spree;
    }

    return {
      matchCount: countedMatches,
      multikills: {
        pentaKills,
        quadraKills,
        tripleKills,
        doubleKills,
        largestKillingSpree,
      },
    };
  }
}
