import {
  ForbiddenException,
  Injectable,
  Logger,
  type MessageEvent,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CachedMatchesResult,
  ChampionExtras,
  LiveMatch,
  LolAccount,
  MatchDetail,
  MatchSummary,
  MatchTimelineProjection,
  RankEntry,
  RankHistoryPoint,
  RankHistoryResponse,
  SummonerProfile,
} from "@vyoh/shared";
import { type Observable, interval, map, merge } from "rxjs";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";
import { type Platform, type Regional, platformToRegional } from "../riot/regions";
import { RiotService } from "../riot/riot.service";
import { LiveGamePollerService } from "./live-game-poller.service";
import { MatchEventsService } from "./match-events.service";
import { extractItems, riotMatchToDetail, riotMatchToSummary } from "./match-mapper";
import { RANKED_QUEUE_MAP, queueTypeName } from "./queue-types";
import { riotTimelineToProjection } from "./timeline-mapper";

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
    private readonly events: MatchEventsService,
    private readonly livePoller: LiveGamePollerService
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
        remake: true,
        teamPosition: true,
        snapshotTier: true,
        snapshotRank: true,
        snapshotLp: true,
        laneOpponent: true,
      },
    });

    return rows.map(
      ({ playedAt, snapshotTier, snapshotRank, snapshotLp, laneOpponent, ...rest }) => ({
        ...rest,
        playedAt: playedAt.toISOString(),
        snapshotTier: snapshotTier ?? undefined,
        snapshotRank: snapshotRank ?? undefined,
        snapshotLp: snapshotLp ?? undefined,
        laneOpponent: laneOpponent as MatchSummary["laneOpponent"],
      })
    );
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
          remake: true,
          teamPosition: true,
          snapshotTier: true,
          snapshotRank: true,
          snapshotLp: true,
          laneOpponent: true,
        },
      }),
    ]);

    const matches = rows.map(
      ({ playedAt, snapshotTier, snapshotRank, snapshotLp, laneOpponent, ...rest }) => ({
        ...rest,
        playedAt: playedAt.toISOString(),
        snapshotTier: snapshotTier ?? undefined,
        snapshotRank: snapshotRank ?? undefined,
        snapshotLp: snapshotLp ?? undefined,
        laneOpponent: laneOpponent as MatchSummary["laneOpponent"],
      })
    );

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
    const account = { slug: "", region, gameName, tagLine };
    // Capture a fresh snapshot so the manually-triggered sync attaches
    // post-game LP rather than whatever the cron last recorded.
    await this.captureRankSnapshot(account).catch((err: unknown) => {
      this.logger.warn(
        `rank snapshot failed during manual sync: ${err instanceof Error ? err.message : String(err)}`
      );
    });
    return this.syncAccountMatches(account);
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
    await this.backfillMissingMatches(summoner.puuid, ids, regional, {
      attachSnapshot: true,
    });
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
    await this.backfillMissingMatches(summoner.puuid, ids, regional, {
      attachSnapshotToNewest: true,
    });
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

  async getRankHistory(
    region: string,
    gameName: string,
    tagLine: string,
    days?: number
  ): Promise<RankHistoryResponse> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }

    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return { solo: [], flex: [] };

    const since =
      days !== undefined && days > 0
        ? new Date(Date.now() - days * 86_400_000)
        : undefined;

    const snapshots = await this.prisma.rankSnapshot.findMany({
      where: {
        puuid: summoner.puuid,
        ...(since && { capturedAt: { gte: since } }),
      },
      orderBy: { capturedAt: "asc" },
    });

    const solo: RankHistoryPoint[] = [];
    const flex: RankHistoryPoint[] = [];
    for (const s of snapshots) {
      const point: RankHistoryPoint = {
        capturedAt: s.capturedAt.toISOString(),
        queueId: s.queueId,
        tier: s.tier,
        rank: s.rank,
        leaguePoints: s.leaguePoints,
      };
      if (s.queueId === "RANKED_SOLO_5x5") solo.push(point);
      else if (s.queueId === "RANKED_FLEX_SR") flex.push(point);
    }
    return { solo, flex };
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

  async getLiveGame(
    region: string,
    gameName: string,
    tagLine: string
  ): Promise<LiveMatch | null> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
      select: { puuid: true },
    });
    if (!summoner) return null;
    return this.livePoller.getForPuuid(summoner.puuid);
  }

  async subscribeLiveEvents(
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
    if (!summoner) return heartbeat;
    const liveUpdates: Observable<MessageEvent> = this.events
      .forLiveGame(summoner.puuid)
      .pipe(map((event) => ({ type: "live-game-updated", data: event })));
    return merge(liveUpdates, heartbeat);
  }

  async getMatchDetail(matchId: string): Promise<MatchDetail> {
    const cached = await this.prisma.matchDetailCache.findUnique({
      where: { matchId },
    });
    if (cached)
      return riotMatchToDetail(
        cached.detail as unknown as Parameters<typeof riotMatchToDetail>[0]
      );

    const platform = matchId.split("_")[0]?.toLowerCase();
    if (!platform) throw new Error(`Cannot derive region from matchId ${matchId}`);
    const regional = platformToRegional(platform);
    const raw = await this.riot.getMatchById(matchId, regional);

    await this.prisma.matchDetailCache.create({
      data: { matchId, detail: raw as unknown as object },
    });
    return riotMatchToDetail(raw);
  }

  async getMatchTimeline(matchId: string): Promise<MatchTimelineProjection> {
    const cached = await this.prisma.matchTimelineCache.findUnique({
      where: { matchId },
    });
    if (cached)
      return riotTimelineToProjection(
        cached.timeline as unknown as Parameters<typeof riotTimelineToProjection>[0]
      );

    const platform = matchId.split("_")[0]?.toLowerCase();
    if (!platform) throw new Error(`Cannot derive region from matchId ${matchId}`);
    const regional = platformToRegional(platform);
    const raw = await this.riot.getMatchTimelineById(matchId, regional);

    await this.prisma.matchTimelineCache.create({
      data: { matchId, timeline: raw as unknown as object },
    });
    return riotTimelineToProjection(raw);
  }

  async getChampionExtras(
    region: string,
    gameName: string,
    tagLine: string,
    championKey: string,
    queue?: number
  ): Promise<ChampionExtras> {
    const summoner = await this.resolveSummoner(region, gameName, tagLine);

    const matches = await this.prisma.match.findMany({
      where: {
        puuid: summoner.puuid,
        champion: { equals: championKey, mode: "insensitive" },
        items: { isEmpty: false },
        ...(queue !== undefined && { queueType: queueTypeName(queue) }),
      },
      select: { items: true, laneOpponent: true, win: true },
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

    const matchupMap = new Map<string, { games: number; wins: number }>();
    for (const m of matches) {
      const oppName = (m.laneOpponent as { championName: string } | null)?.championName;
      if (oppName) {
        const s = matchupMap.get(oppName) ?? { games: 0, wins: 0 };
        matchupMap.set(oppName, { games: s.games + 1, wins: s.wins + (m.win ? 1 : 0) });
      }
    }
    const matchups = [...matchupMap.entries()]
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
    regional: Regional,
    opts: { attachSnapshot?: boolean; attachSnapshotToNewest?: boolean } = {}
  ): Promise<void> {
    if (matchIds.length === 0) return;

    // A row is fully synced if: it is a remake (no items expected),
    // OR items are populated for a real game. laneOpponent is nullable
    // (null for ARAM/Arena), so it cannot serve as a staleness indicator.
    const fullysynced = await this.prisma.match.findMany({
      where: {
        puuid,
        matchId: { in: matchIds },
        OR: [{ remake: true }, { items: { isEmpty: false } }],
      },
      select: { matchId: true },
    });
    const have = new Set(fullysynced.map((m) => m.matchId));
    const missing = matchIds.filter((id) => !have.has(id));

    this.logger.log(
      `match cache: ${have.size} hit, ${missing.length} missing for ${puuid}`
    );

    if (missing.length === 0) return;

    // Phase 1: fetch all raw match data before any writes. This lets phase 2
    // determine snapshot eligibility across the whole batch without races —
    // if we fetched-and-upserted in one pass, parallel tasks would each see
    // an empty DB for their queue and all claim to be "newest".
    const fetched = await Promise.allSettled(
      missing.map(async (matchId) => {
        const raw = await this.riot.getMatchById(matchId, regional);
        const summary = riotMatchToSummary(raw, puuid);
        const { items } = extractItems(raw, puuid);
        return { matchId, raw, summary, items };
      })
    );

    // Phase 2 (historical path only): find the chronologically newest match
    // per ranked queue in this batch, then drop any queue where the DB already
    // has a more recent game — those were covered by a head-sync snapshot.
    const snapshotMatchIds = new Set<string>();
    if (opts.attachSnapshotToNewest) {
      const newestPerQueue = new Map<string, { matchId: string; playedAt: string }>();
      for (const r of fetched) {
        if (r.status !== "fulfilled") continue;
        const { matchId, raw, summary } = r.value;
        if (!RANKED_QUEUE_MAP[raw.info.queueId]) continue;
        const prev = newestPerQueue.get(summary.queueType);
        if (!prev || summary.playedAt > prev.playedAt) {
          newestPerQueue.set(summary.queueType, { matchId, playedAt: summary.playedAt });
        }
      }
      for (const [queueType, { matchId, playedAt }] of newestPerQueue) {
        const hasNewer = await this.prisma.match.count({
          where: { puuid, queueType, playedAt: { gt: new Date(playedAt) } },
        });
        if (hasNewer === 0) snapshotMatchIds.add(matchId);
      }
    }

    // Phase 3: upsert all fetched matches.
    const results = await Promise.allSettled(
      fetched.map(async (r) => {
        if (r.status === "rejected") throw r.reason;
        const { matchId, raw, summary, items } = r.value;

        let snapshotTier: string | undefined;
        let snapshotRank: string | undefined;
        let snapshotLp: number | undefined;

        const rankedQueueId = RANKED_QUEUE_MAP[raw.info.queueId];
        if (rankedQueueId) {
          const shouldAttach =
            opts.attachSnapshot ||
            (opts.attachSnapshotToNewest && snapshotMatchIds.has(matchId));
          if (shouldAttach) {
            const snap = await this.prisma.rankSnapshot.findFirst({
              where: { puuid, queueId: rankedQueueId },
              orderBy: { capturedAt: "desc" },
              select: { tier: true, rank: true, leaguePoints: true },
            });
            if (snap) {
              snapshotTier = snap.tier;
              snapshotRank = snap.rank;
              snapshotLp = snap.leaguePoints;
            }
          }
        }

        const { laneOpponent, ...summaryRest } = summary;
        const matchRow = {
          ...summaryRest,
          puuid,
          playedAt: new Date(summary.playedAt),
          items,
          // Prisma requires DbNull (not JS null) to store a SQL NULL in a Json? column.
          laneOpponent: (laneOpponent ?? Prisma.DbNull) as Prisma.InputJsonValue,
          snapshotTier,
          snapshotRank,
          snapshotLp,
        };

        await Promise.all([
          this.prisma.matchDetailCache.upsert({
            where: { matchId },
            create: { matchId, detail: raw as unknown as object },
            update: {},
          }),
          this.prisma.match.upsert({
            where: { matchId_puuid: { matchId, puuid } },
            create: matchRow,
            update: matchRow,
          }),
        ]);
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
