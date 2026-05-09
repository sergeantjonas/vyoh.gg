import {
  ForbiddenException,
  Injectable,
  Logger,
  type MessageEvent,
} from "@nestjs/common";
import type {
  CachedMatchesResult,
  ChampionExtras,
  LolAccount,
  MatchDetail,
  MatchSummary,
  RankEntry,
  SummonerProfile,
} from "@vyoh/shared";
import { type Observable, interval, map, merge } from "rxjs";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";
import { type Platform, type Regional, platformToRegional } from "../riot/regions";
import { RiotService } from "../riot/riot.service";
import { MatchEventsService } from "./match-events.service";
import {
  extractItemsAndOpponents,
  riotMatchToDetail,
  riotMatchToSummary,
} from "./match-mapper";
import { queueTypeName } from "./queue-types";

const DEFAULT_MATCH_COUNT = 20;
const MATCH_IDS_TTL_MS = 30_000;
const HISTORICAL_PAGE_SIZE = 20;
const SSE_HEARTBEAT_MS = 30_000;

type CachedIds = { ids: string[]; coveredCount: number; expiry: number };

@Injectable()
export class LolService {
  private readonly logger = new Logger(LolService.name);
  private readonly matchIdsCache = new Map<string, CachedIds>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly riot: RiotService,
    private readonly identity: IdentityService,
    private readonly events: MatchEventsService
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
      select: {
        matchId: true,
        queueType: true,
        champion: true,
        kills: true,
        deaths: true,
        assists: true,
        win: true,
        durationSec: true,
        playedAt: true,
      },
    });

    return rows.map(({ playedAt, ...rest }) => ({
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
        select: {
          matchId: true,
          queueType: true,
          champion: true,
          kills: true,
          deaths: true,
          assists: true,
          win: true,
          durationSec: true,
          playedAt: true,
        },
      }),
    ]);

    const matches = rows.map(({ playedAt, ...rest }) => ({
      ...rest,
      playedAt: playedAt.toISOString(),
    }));

    return { matches, total };
  }

  async syncForSummoner(
    region: string,
    gameName: string,
    tagLine: string
  ): Promise<{ idCount: number; backfilled: number }> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    // syncAccountMatches reads region/gameName/tagLine off the LolAccount;
    // slug is unused on this path so we leave it empty.
    return this.syncAccountMatches({
      slug: "",
      region,
      gameName,
      tagLine,
    });
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

    const backfilled = after - before;
    if (backfilled > 0) {
      this.events.emit({ puuid: summoner.puuid, added: backfilled, source: "head" });
    }
    return { idCount: ids.length, backfilled };
  }

  // One step of backwards historical walk for an account. Anchors on the
  // oldest match in the DB and asks Riot for matches strictly older than
  // that — robust to new games being played at the head between ticks.
  // Returns `done: true` when Riot's reply is shorter than the page size,
  // which we treat as "reached genesis" and persist to skip future ticks.
  async syncAccountHistorical(
    account: LolAccount
  ): Promise<{ idCount: number; backfilled: number; done: boolean; skipped: boolean }> {
    if (
      !this.identity.isLolAccountAllowed(
        account.gameName,
        account.tagLine,
        account.region
      )
    ) {
      return { idCount: 0, backfilled: 0, done: false, skipped: true };
    }

    const summoner = await this.prisma.summoner.findUnique({
      where: {
        gameName_tagLine_region: {
          gameName: account.gameName,
          tagLine: account.tagLine,
          region: account.region,
        },
      },
    });

    // Head sync hasn't run yet, or summoner not yet resolved. Wait for the
    // next tick — the head sync that runs first will populate this.
    if (!summoner) {
      return { idCount: 0, backfilled: 0, done: false, skipped: true };
    }

    if (summoner.historicalDoneAt) {
      return { idCount: 0, backfilled: 0, done: true, skipped: true };
    }

    const oldest = await this.prisma.match.findFirst({
      where: { puuid: summoner.puuid },
      orderBy: { playedAt: "asc" },
      select: { playedAt: true },
    });

    if (!oldest) {
      // No matches in DB for this summoner yet — head sync hasn't filled
      // anything. Skip; we'll try again next tick.
      return { idCount: 0, backfilled: 0, done: false, skipped: true };
    }

    const regional = platformToRegional(account.region);
    // endTime is epoch seconds, exclusive on Riot's side. Subtracting 1s
    // keeps the window strictly older than what we already have.
    const endTime = Math.floor(oldest.playedAt.getTime() / 1000) - 1;

    const ids = await this.riot.getMatchIdsByPuuid(summoner.puuid, regional, {
      endTime,
      count: HISTORICAL_PAGE_SIZE,
    });

    const before = await this.prisma.match.count({
      where: { puuid: summoner.puuid, matchId: { in: ids } },
    });
    await this.backfillMissingMatches(summoner.puuid, ids, regional);
    const after = await this.prisma.match.count({
      where: { puuid: summoner.puuid, matchId: { in: ids } },
    });

    const done = ids.length < HISTORICAL_PAGE_SIZE;
    if (done) {
      await this.prisma.summoner.update({
        where: { puuid: summoner.puuid },
        data: { historicalDoneAt: new Date() },
      });
    }

    const backfilled = after - before;
    if (backfilled > 0) {
      this.events.emit({
        puuid: summoner.puuid,
        added: backfilled,
        source: "historical",
      });
    }
    return { idCount: ids.length, backfilled, done, skipped: false };
  }

  async getSummonerProfile(
    region: string,
    gameName: string,
    tagLine: string
  ): Promise<SummonerProfile> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }

    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return { profileIconId: null, summonerLevel: null, rankEntries: [] };

    const snapshots = await Promise.all(
      ["RANKED_SOLO_5x5", "RANKED_FLEX_SR"].map((queueId) =>
        this.prisma.rankSnapshot.findFirst({
          where: { puuid: summoner.puuid, queueId },
          orderBy: { capturedAt: "desc" },
        })
      )
    );

    const rankEntries: RankEntry[] = [];
    for (const s of snapshots) {
      if (s)
        rankEntries.push({
          queueId: s.queueId,
          tier: s.tier,
          rank: s.rank,
          leaguePoints: s.leaguePoints,
          wins: s.wins,
          losses: s.losses,
          hotStreak: s.hotStreak,
        });
    }

    return {
      profileIconId: summoner.profileIconId,
      summonerLevel: summoner.summonerLevel,
      rankEntries,
    };
  }

  async captureRankSnapshot(account: LolAccount): Promise<void> {
    const summoner = await this.prisma.summoner.findUnique({
      where: {
        gameName_tagLine_region: {
          gameName: account.gameName,
          tagLine: account.tagLine,
          region: account.region,
        },
      },
    });
    if (!summoner) return;

    const platform = account.region.toLowerCase() as Platform;
    const entries = await this.riot.getLeagueEntriesByPuuid(summoner.puuid, platform);

    for (const entry of entries) {
      if (entry.queueType !== "RANKED_SOLO_5x5" && entry.queueType !== "RANKED_FLEX_SR") {
        continue;
      }

      const latest = await this.prisma.rankSnapshot.findFirst({
        where: { puuid: summoner.puuid, queueId: entry.queueType },
        orderBy: { capturedAt: "desc" },
      });

      const changed =
        !latest ||
        latest.tier !== entry.tier ||
        latest.rank !== entry.rank ||
        latest.leaguePoints !== entry.leaguePoints;

      if (changed) {
        await this.prisma.rankSnapshot.create({
          data: {
            puuid: summoner.puuid,
            queueId: entry.queueType,
            tier: entry.tier,
            rank: entry.rank,
            leaguePoints: entry.leaguePoints,
            wins: entry.wins,
            losses: entry.losses,
            hotStreak: entry.hotStreak,
          },
        });
        this.logger.log(
          `rank snapshot: ${account.gameName}#${account.tagLine} ${entry.queueType} → ${entry.tier} ${entry.rank} ${entry.leaguePoints}LP`
        );
      }
    }
  }

  async syncSummonerProfile(account: LolAccount): Promise<void> {
    const summoner = await this.prisma.summoner.findUnique({
      where: {
        gameName_tagLine_region: {
          gameName: account.gameName,
          tagLine: account.tagLine,
          region: account.region,
        },
      },
    });
    if (!summoner) return;

    const platform = account.region.toLowerCase() as Platform;
    const data = await this.riot.getSummonerByPuuid(summoner.puuid, platform);

    await this.prisma.summoner.update({
      where: { puuid: summoner.puuid },
      data: {
        profileIconId: data.profileIconId,
        summonerLevel: data.summonerLevel,
        fetchedAt: new Date(),
      },
    });
  }

  // SSE entry point. Resolves the account to a puuid, then returns an
  // Observable that streams MessageEvents for backfill notifications.
  // Heartbeats keep intermediate proxies (and EventSource itself) from
  // closing the idle connection between real events.
  async subscribeToMatchEvents(
    region: string,
    gameName: string,
    tagLine: string
  ): Promise<Observable<MessageEvent>> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }

    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });

    const heartbeat: Observable<MessageEvent> = interval(SSE_HEARTBEAT_MS).pipe(
      map(() => ({ type: "heartbeat", data: {} satisfies object }))
    );

    // Summoner not yet resolved — keep the connection open with heartbeats
    // alone. Once the head sync creates the row, the client will see
    // events on the next backfill (no reconnect needed).
    if (!summoner) return heartbeat;

    const updates: Observable<MessageEvent> = this.events
      .forPuuid(summoner.puuid)
      .pipe(map((event) => ({ type: "match-updated", data: event })));

    return merge(updates, heartbeat);
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

  async getChampionExtras(
    region: string,
    gameName: string,
    tagLine: string,
    championKey: string
  ): Promise<ChampionExtras> {
    const summoner = await this.resolveSummoner(region, gameName, tagLine);

    const matches = await this.prisma.match.findMany({
      where: {
        puuid: summoner.puuid,
        champion: { equals: championKey, mode: "insensitive" },
        items: { isEmpty: false },
      },
      select: { items: true, opponents: true, win: true },
    });

    // Item frequency across all games on this champion
    const itemMap = new Map<number, { games: number; wins: number }>();
    for (const m of matches) {
      for (const itemId of m.items) {
        const s = itemMap.get(itemId) ?? { games: 0, wins: 0 };
        itemMap.set(itemId, { games: s.games + 1, wins: s.wins + (m.win ? 1 : 0) });
      }
    }
    const topItems = [...itemMap.entries()]
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 6)
      .map(([itemId, s]) => ({ itemId, games: s.games, wins: s.wins }));

    // Matchup aggregation — only opponents faced ≥ 3 times
    const matchupMap = new Map<string, { games: number; wins: number }>();
    for (const m of matches) {
      for (const opp of m.opponents) {
        const s = matchupMap.get(opp) ?? { games: 0, wins: 0 };
        matchupMap.set(opp, { games: s.games + 1, wins: s.wins + (m.win ? 1 : 0) });
      }
    }
    const matchups = [...matchupMap.entries()]
      .filter(([, s]) => s.games >= 3)
      .sort((a, b) => b[1].games - a[1].games)
      .map(([champion, s]) => ({ champion, games: s.games, wins: s.wins }));

    return { topItems, matchups };
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

    // Rows that already have item data are fully synced — skip them.
    // Rows that exist but have empty items (synced before this feature) are
    // treated as missing so they get backfilled on the next sync pass.
    const fullysynced = await this.prisma.match.findMany({
      where: { puuid, matchId: { in: matchIds }, items: { isEmpty: false } },
      select: { matchId: true },
    });
    const have = new Set(fullysynced.map((m) => m.matchId));
    const missing = matchIds.filter((id) => !have.has(id));

    this.logger.log(
      `match cache: ${have.size} hit, ${missing.length} missing for ${puuid}`
    );

    const results = await Promise.allSettled(
      missing.map(async (matchId) => {
        const detail = await this.riot.getMatchById(matchId, regional);
        const summary = riotMatchToSummary(detail, puuid);
        const { items, opponents } = extractItemsAndOpponents(detail, puuid);
        await this.prisma.match.upsert({
          where: { matchId_puuid: { matchId, puuid } },
          create: {
            ...summary,
            puuid,
            playedAt: new Date(summary.playedAt),
            items,
            opponents,
          },
          update: {
            ...summary,
            puuid,
            playedAt: new Date(summary.playedAt),
            items,
            opponents,
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
