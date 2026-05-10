import {
  ForbiddenException,
  Injectable,
  Logger,
  type MessageEvent,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CachedMatchesResult,
  ChampionBuildFlowEntry,
  ChampionExtras,
  ChampionPair,
  Duo,
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
import type { RiotMatchTimeline } from "../riot/types";
import { LiveGamePollerService } from "./live-game-poller.service";
import { MatchEventsService } from "./match-events.service";
import { extractItems, riotMatchToDetail, riotMatchToSummary } from "./match-mapper";
import { RANKED_QUEUE_MAP, queueTypeName } from "./queue-types";
import { riotTimelineToProjection } from "./timeline-mapper";
import {
  type TimelineSummaryMetrics,
  riotTimelineToSummaryMetrics,
} from "./timeline-summary-mapper";

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

    // Match-list path is user-driven (fresh page view). Eager-fetch
    // timelines so Phase B trends fields land at insert time.
    await this.backfillMissingMatches(summoner.puuid, matchIds, regional, {
      fetchTimeline: true,
    });

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
        gameVersion: true,
        visionScore: true,
        damageShare: true,
        firstBloodKill: true,
        csAt10: true,
        csAt15: true,
        goldAt10: true,
        goldAt15: true,
        teamGoldDiffAt15: true,
        deathTimings: true,
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
          gameVersion: true,
          visionScore: true,
          damageShare: true,
          firstBloodKill: true,
          csAt10: true,
          csAt15: true,
          goldAt10: true,
          goldAt15: true,
          teamGoldDiffAt15: true,
          deathTimings: true,
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
      // Head-sync path (manual + cron-driven). New matches arrive here;
      // pulling the timeline now is the cheapest way to populate Phase B
      // trends fields without a separate worker.
      fetchTimeline: true,
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

  // Duo / squad detection. Pure read against the existing MatchDetailCache —
  // no Riot calls. We read up to `count` of the user's most recent matches
  // (any queue), join the cached raw match JSON, and bucket teammates by
  // puuid. Filtered to recurring puuids only (≥ MIN_GAMES_TOGETHER) so a
  // one-off random duo queue doesn't surface.
  async getDuos(
    region: string,
    gameName: string,
    tagLine: string,
    count = 100
  ): Promise<Duo[]> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return [];

    const userMatches = await this.prisma.match.findMany({
      where: { puuid: summoner.puuid },
      orderBy: { playedAt: "desc" },
      take: count,
      select: { matchId: true, playedAt: true },
    });
    if (userMatches.length === 0) return [];

    const matchIds = userMatches.map((m) => m.matchId);
    const caches = await this.prisma.matchDetailCache.findMany({
      where: { matchId: { in: matchIds } },
    });
    // Sort cache rows newest-first so the gameName/tagLine we keep per puuid
    // is the most recent observation (Riot IDs can change).
    const playedAtByMatchId = new Map(
      userMatches.map((m) => [m.matchId, m.playedAt.getTime()])
    );
    const sortedCaches = [...caches].sort(
      (a, b) =>
        (playedAtByMatchId.get(b.matchId) ?? 0) - (playedAtByMatchId.get(a.matchId) ?? 0)
    );

    interface DuoAcc {
      puuid: string;
      gameName: string;
      tagLine: string;
      games: number;
      wins: number;
      championCounts: Map<string, number>;
    }
    const map = new Map<string, DuoAcc>();
    for (const cache of sortedCaches) {
      const detail = cache.detail as unknown as {
        info: {
          participants: Array<{
            puuid: string;
            riotIdGameName: string;
            riotIdTagline: string;
            championName: string;
            teamId: number;
            win: boolean;
          }>;
        };
      };
      const me = detail.info.participants.find((p) => p.puuid === summoner.puuid);
      if (!me) continue;
      const teammates = detail.info.participants.filter(
        (p) => p.teamId === me.teamId && p.puuid !== me.puuid
      );
      for (const t of teammates) {
        const prev = map.get(t.puuid);
        if (prev) {
          prev.games += 1;
          if (me.win) prev.wins += 1;
          prev.championCounts.set(
            t.championName,
            (prev.championCounts.get(t.championName) ?? 0) + 1
          );
        } else {
          // First (= most recent) sighting. Capture latest gameName/tagLine.
          map.set(t.puuid, {
            puuid: t.puuid,
            gameName: t.riotIdGameName,
            tagLine: t.riotIdTagline,
            games: 1,
            wins: me.win ? 1 : 0,
            championCounts: new Map([[t.championName, 1]]),
          });
        }
      }
    }

    const MIN_GAMES_TOGETHER = 3;
    const TOP_N = 10;
    return [...map.values()]
      .filter((d) => d.games >= MIN_GAMES_TOGETHER)
      .sort((a, b) => b.games - a.games)
      .slice(0, TOP_N)
      .map((d) => {
        const topChampion =
          [...d.championCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
        return {
          puuid: d.puuid,
          gameName: d.gameName,
          tagLine: d.tagLine,
          games: d.games,
          wins: d.wins,
          topChampion,
        };
      });
  }

  // Champion-pair synergy. For the user's most recent `count` matches, walk
  // teammates and bucket by (yourChamp, teammateChamp). The chord viz on the
  // Profile renders the bipartite flow: your champion pool on one side,
  // teammates' picks on the other, ribbon weight = games played together.
  // Win counted from the user's team perspective (me.win).
  async getChampionPairs(
    region: string,
    gameName: string,
    tagLine: string,
    count = 100
  ): Promise<ChampionPair[]> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return [];

    const userMatches = await this.prisma.match.findMany({
      where: { puuid: summoner.puuid },
      orderBy: { playedAt: "desc" },
      take: count,
      select: { matchId: true },
    });
    if (userMatches.length === 0) return [];

    const matchIds = userMatches.map((m) => m.matchId);
    const caches = await this.prisma.matchDetailCache.findMany({
      where: { matchId: { in: matchIds } },
    });

    interface PairAcc {
      yourChamp: string;
      teammateChamp: string;
      games: number;
      wins: number;
    }
    const map = new Map<string, PairAcc>();
    for (const cache of caches) {
      const detail = cache.detail as unknown as {
        info: {
          participants: Array<{
            puuid: string;
            championName: string;
            teamId: number;
            win: boolean;
          }>;
        };
      };
      const me = detail.info.participants.find((p) => p.puuid === summoner.puuid);
      if (!me) continue;
      const teammates = detail.info.participants.filter(
        (p) => p.teamId === me.teamId && p.puuid !== me.puuid
      );
      for (const t of teammates) {
        const key = `${me.championName}|${t.championName}`;
        const prev = map.get(key);
        if (prev) {
          prev.games += 1;
          if (me.win) prev.wins += 1;
        } else {
          map.set(key, {
            yourChamp: me.championName,
            teammateChamp: t.championName,
            games: 1,
            wins: me.win ? 1 : 0,
          });
        }
      }
    }

    return [...map.values()].sort((a, b) => b.games - a.games);
  }

  // Champion build-flow: for the user's recent N matches on `championKey`,
  // return the ordered list of item completions kept until end of game. We
  // intersect timeline PURCHASED events with the participant's final inventory
  // (Match.items) so intermediate components / sold items drop out and only
  // items that actually survived to the final inventory appear in the order.
  async getChampionBuildFlow(
    region: string,
    gameName: string,
    tagLine: string,
    championKey: string,
    count = 100
  ): Promise<ChampionBuildFlowEntry[]> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return [];

    const matches = await this.prisma.match.findMany({
      where: {
        puuid: summoner.puuid,
        champion: { equals: championKey, mode: "insensitive" },
      },
      orderBy: { playedAt: "desc" },
      take: count,
      select: { matchId: true, items: true, win: true, remake: true },
    });
    const playable = matches.filter((m) => !m.remake);
    if (playable.length === 0) return [];

    const timelineRows = await this.prisma.matchTimelineCache.findMany({
      where: { matchId: { in: playable.map((m) => m.matchId) } },
    });
    const timelineByMatchId = new Map(timelineRows.map((t) => [t.matchId, t.timeline]));

    const result: ChampionBuildFlowEntry[] = [];
    for (const m of playable) {
      const timelineRaw = timelineByMatchId.get(m.matchId);
      if (!timelineRaw) continue;
      const timeline = timelineRaw as unknown as RiotMatchTimeline;

      const participantIdFromInfo = timeline.info.participants?.find(
        (p) => p.puuid === summoner.puuid
      )?.participantId;
      const participantId =
        participantIdFromInfo ??
        (() => {
          const idx = timeline.metadata.participants.indexOf(summoner.puuid);
          return idx === -1 ? null : idx + 1;
        })();
      if (participantId === null) continue;

      const finalItems = new Set(m.items.filter((id) => id > 0));
      if (finalItems.size === 0) continue;

      const purchaseOrder: number[] = [];
      const usedSlots = new Set<number>();
      for (const frame of timeline.info.frames) {
        for (const ev of frame.events) {
          if (ev.type !== "ITEM_PURCHASED") continue;
          if (ev.participantId !== participantId) continue;
          if (typeof ev.itemId !== "number") continue;
          if (!finalItems.has(ev.itemId)) continue;
          // The same itemId may be purchased multiple times when the user
          // restocks a slot — keep each purchase event as a separate step so
          // the Sankey reflects what actually happened, but cap how many
          // copies of the same item appear across the run.
          const occurrences = purchaseOrder.filter((x) => x === ev.itemId).length;
          const slotKey = ev.itemId * 10 + occurrences;
          if (usedSlots.has(slotKey)) continue;
          usedSlots.add(slotKey);
          purchaseOrder.push(ev.itemId);
        }
      }

      if (purchaseOrder.length === 0) continue;
      result.push({ matchId: m.matchId, win: m.win, items: purchaseOrder });
    }

    return result;
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
    opts: {
      attachSnapshot?: boolean;
      attachSnapshotToNewest?: boolean;
      // Eager-fetch the timeline alongside the match detail. Set true for
      // sync paths (head sync, manual sync, list-window backfill) so Phase B
      // trends fields are populated as new matches stream in. Set false on
      // historical-paging where the bulk extra calls aren't justified.
      fetchTimeline?: boolean;
    } = {}
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
        const baseSummary = riotMatchToSummary(raw, puuid);
        const { items } = extractItems(raw, puuid);

        // Optionally also pull the timeline so Phase B trends fields land at
        // insert time. Failures here don't fail the whole match — the row
        // still upserts with default zeros and the timeline cache remains
        // empty for a later lazy fetch on match-detail visit.
        let rawTimeline: RiotMatchTimeline | undefined;
        let timelineMetrics: TimelineSummaryMetrics | undefined;
        if (opts.fetchTimeline) {
          try {
            rawTimeline = await this.riot.getMatchTimelineById(matchId, regional);
            timelineMetrics = riotTimelineToSummaryMetrics(rawTimeline, puuid);
          } catch (err) {
            this.logger.warn(
              `timeline fetch failed for ${matchId}: ${(err as Error).message}`
            );
          }
        }

        const summary: MatchSummary = timelineMetrics
          ? { ...baseSummary, ...timelineMetrics }
          : baseSummary;

        return { matchId, raw, summary, items, rawTimeline };
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
        const { matchId, raw, summary, items, rawTimeline } = r.value;

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
          // Persist the raw timeline alongside the match so downstream views
          // (build order, kill plot, lane phase) can read it without a
          // re-fetch. Skipped when no timeline was fetched.
          rawTimeline
            ? this.prisma.matchTimelineCache.upsert({
                where: { matchId },
                create: { matchId, timeline: rawTimeline as unknown as object },
                update: {},
              })
            : Promise.resolve(),
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
