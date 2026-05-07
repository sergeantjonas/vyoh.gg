import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import type {
  CachedMatchesResult,
  LolAccount,
  MatchDetail,
  MatchSummary,
} from "@vyoh/shared";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";
import { type Regional, platformToRegional } from "../riot/regions";
import { RiotService } from "../riot/riot.service";
import { riotMatchToDetail, riotMatchToSummary } from "./match-mapper";
import { queueTypeName } from "./queue-types";

const DEFAULT_MATCH_COUNT = 20;
const MATCH_IDS_TTL_MS = 30_000;

type CachedIds = { ids: string[]; coveredCount: number; expiry: number };

@Injectable()
export class LolService {
  private readonly logger = new Logger(LolService.name);
  private readonly matchIdsCache = new Map<string, CachedIds>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly riot: RiotService,
    private readonly identity: IdentityService
  ) {}

  async getMatchesForSummoner(
    region: string,
    gameName: string,
    tagLine: string,
    start = 0,
    count: number = DEFAULT_MATCH_COUNT,
    queue?: number
  ): Promise<MatchSummary[]> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }

    const summoner = await this.resolveSummoner(region, gameName, tagLine);
    const regional = platformToRegional(region);

    const matchIds = await this.getMatchIds(summoner.puuid, regional, {
      start,
      count,
      queue,
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

  async getCachedMatches(
    region: string,
    gameName: string,
    tagLine: string,
    start: number,
    count: number,
    queue?: number
  ): Promise<CachedMatchesResult> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }

    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) {
      // No summoner row yet means we've never resolved this account from
      // Riot. The match list / detail paths populate that on demand; the
      // cached endpoint never calls Riot, so it returns an empty window.
      return { matches: [], total: 0 };
    }

    const where: { puuid: string; queueType?: string } = { puuid: summoner.puuid };
    if (queue !== undefined) {
      where.queueType = queueTypeName(queue);
    }

    const [total, rows] = await Promise.all([
      this.prisma.match.count({ where }),
      this.prisma.match.findMany({
        where,
        orderBy: { playedAt: "desc" },
        skip: start,
        take: count,
      }),
    ]);

    const matches = rows.map(({ playedAt, puuid: _puuid, ...rest }) => ({
      ...rest,
      playedAt: playedAt.toISOString(),
    }));

    return { matches, total };
  }

  async syncAccountMatches(
    account: LolAccount,
    count: number = DEFAULT_MATCH_COUNT
  ): Promise<{ idCount: number; backfilled: number }> {
    const regional = platformToRegional(account.region);
    const summoner = await this.resolveSummoner(
      account.region,
      account.gameName,
      account.tagLine
    );

    // Bypass the in-memory ID cache — sync is the canonical source of truth
    // for "what matches exist", so we always ask Riot directly. The TTL cache
    // is for shielding user navigations, not the worker.
    const ids = await this.riot.getMatchIdsByPuuid(summoner.puuid, regional, {
      count,
    });

    const before = await this.prisma.match.count({
      where: { puuid: summoner.puuid, matchId: { in: ids } },
    });
    await this.backfillMissingMatches(summoner.puuid, ids, regional);
    const after = await this.prisma.match.count({
      where: { puuid: summoner.puuid, matchId: { in: ids } },
    });

    return { idCount: ids.length, backfilled: after - before };
  }

  async getMatchDetail(matchId: string): Promise<MatchDetail> {
    const platform = matchId.split("_")[0]?.toLowerCase();
    if (!platform) {
      throw new Error(`Cannot derive region from matchId ${matchId}`);
    }
    const regional = platformToRegional(platform);
    const detail = await this.riot.getMatchById(matchId, regional);
    return riotMatchToDetail(detail);
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

  private async getMatchIds(
    puuid: string,
    regional: Regional,
    options: { start: number; count: number; queue?: number }
  ): Promise<string[]> {
    const queue = options.queue ?? "all";
    const key = `${puuid}:${regional}:${queue}`;
    const requestedEnd = options.start + options.count;

    // Cache hit when we've previously *asked Riot for* at least `requestedEnd`
    // and got an answer back. Tracking `coveredCount` (rather than just the
    // returned ids length) handles the "account has 2 games, asked for 20"
    // case correctly — the second call should hit, not re-ask Riot.
    const cached = this.matchIdsCache.get(key);
    if (cached && cached.expiry > Date.now() && requestedEnd <= cached.coveredCount) {
      this.logger.log(
        `match-ids cache HIT for ${puuid} (queue=${queue}, slice ${options.start}..${requestedEnd})`
      );
      return cached.ids.slice(options.start, requestedEnd);
    }

    const ids = await this.riot.getMatchIdsByPuuid(puuid, regional, options);

    // Only cache prefixes (start === 0). Update `coveredCount` to the largest
    // count we've ever asked for at this key; never shrink it.
    if (options.start === 0) {
      this.matchIdsCache.set(key, {
        ids,
        coveredCount: Math.max(options.count, cached?.coveredCount ?? 0),
        expiry: Date.now() + MATCH_IDS_TTL_MS,
      });
    }
    return ids;
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

    const results = await Promise.allSettled(
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

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      this.logger.warn(
        `backfill: ${failed.length}/${missing.length} matches failed for ${puuid} — partial results returned`
      );
    }
  }
}
