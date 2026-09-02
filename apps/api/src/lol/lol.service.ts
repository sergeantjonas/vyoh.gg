import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  type MessageEvent,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  RANKED_QUEUE_KEYS,
  RANKED_QUEUE_KEY_TO_TYPE,
  RANKED_QUEUE_MAP,
  RANKED_QUEUE_TYPE_TO_KEY,
  emptyRankHistory,
} from "@vyoh/shared";
import type {
  CachedMatchesResult,
  ComparableRank,
  LiveMatch,
  LolAccount,
  MatchDetail,
  MatchSummary,
  MatchSyncResult,
  MatchTimelineProjection,
  RankEntry,
  RankHistoryResponse,
  SummonerProfile,
} from "@vyoh/shared";
import { pickHigherRank } from "@vyoh/shared/lol/rank-history";
import { type Observable, interval, map, merge } from "rxjs";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";
import { type Platform, type Regional, platformToRegional } from "../riot/regions";
import { RiotService } from "../riot/riot.service";
import type { RiotMatchTimeline } from "../riot/types";
import { LiveGamePollerService } from "./live-game-poller.service";
import { MatchEventsService } from "./match-events.service";
import { extractItems, riotMatchToDetail, riotMatchToSummary } from "./match-mapper";
import { projectMatchForStorage } from "./match-projection";
import { riotTimelineToProjection } from "./timeline-mapper";
import {
  type TimelineSummaryMetrics,
  riotTimelineToSummaryMetrics,
} from "./timeline-summary-mapper";

const DEFAULT_MATCH_COUNT = 20;
const MATCH_IDS_TTL_MS = 30_000;
const MATCH_IDS_CACHE_MAX = 256;
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
      ...(queue !== undefined ? { queue } : {}),
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
        queueId: true,
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
        hasTimeline: true,
        csAt15: true,
        goldAt10: true,
        goldAt15: true,
        teamGoldDiffAt15: true,
        teamGoldDiffSeries: true,
        deathTimings: true,
        deathXs: true,
        deathYs: true,
        killTimings: true,
        killXs: true,
        killYs: true,
        snapshotTier: true,
        snapshotRank: true,
        snapshotLp: true,
        snapshotTierBefore: true,
        snapshotRankBefore: true,
        snapshotLpBefore: true,
        laneOpponent: true,
      },
    });

    return rows.map(
      ({
        playedAt,
        snapshotTier,
        snapshotRank,
        snapshotLp,
        snapshotTierBefore,
        snapshotRankBefore,
        snapshotLpBefore,
        laneOpponent,
        ...rest
      }) => ({
        ...rest,
        playedAt: playedAt.toISOString(),
        ...(snapshotTier != null ? { snapshotTier } : {}),
        ...(snapshotRank != null ? { snapshotRank } : {}),
        ...(snapshotLp != null ? { snapshotLp } : {}),
        ...(snapshotTierBefore != null ? { snapshotTierBefore } : {}),
        ...(snapshotRankBefore != null ? { snapshotRankBefore } : {}),
        ...(snapshotLpBefore != null ? { snapshotLpBefore } : {}),
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

    const where: { puuid: string; queueId?: number } = { puuid: summoner.puuid };
    if (queue !== undefined) {
      where.queueId = queue;
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
          queueId: true,
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
          hasTimeline: true,
          csAt15: true,
          goldAt10: true,
          goldAt15: true,
          teamGoldDiffAt15: true,
          teamGoldDiffSeries: true,
          deathTimings: true,
          deathXs: true,
          deathYs: true,
          killTimings: true,
          killXs: true,
          killYs: true,
          snapshotTier: true,
          snapshotRank: true,
          snapshotLp: true,
          snapshotTierBefore: true,
          snapshotRankBefore: true,
          snapshotLpBefore: true,
          laneOpponent: true,
        },
      }),
    ]);

    const matches = rows.map(
      ({
        playedAt,
        snapshotTier,
        snapshotRank,
        snapshotLp,
        snapshotTierBefore,
        snapshotRankBefore,
        snapshotLpBefore,
        laneOpponent,
        ...rest
      }) => ({
        ...rest,
        playedAt: playedAt.toISOString(),
        ...(snapshotTier != null ? { snapshotTier } : {}),
        ...(snapshotRank != null ? { snapshotRank } : {}),
        ...(snapshotLp != null ? { snapshotLp } : {}),
        ...(snapshotTierBefore != null ? { snapshotTierBefore } : {}),
        ...(snapshotRankBefore != null ? { snapshotRankBefore } : {}),
        ...(snapshotLpBefore != null ? { snapshotLpBefore } : {}),
        laneOpponent: laneOpponent as MatchSummary["laneOpponent"],
      })
    );

    return { matches, total };
  }

  async syncForSummoner(
    region: string,
    gameName: string,
    tagLine: string
  ): Promise<MatchSyncResult> {
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
      RANKED_QUEUE_KEYS.map((key) =>
        this.prisma.rankSnapshot.findFirst({
          where: { puuid: summoner.puuid, queueId: RANKED_QUEUE_KEY_TO_TYPE[key] },
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
    if (!summoner) return emptyRankHistory();

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

    // Reads the whole snapshot table for the account and routes each row by its
    // League-V4 queueType. Rows on a ladder we don't chart (RANKED_TFT) resolve
    // to no key and are dropped.
    const history = emptyRankHistory();
    for (const s of snapshots) {
      const key = RANKED_QUEUE_TYPE_TO_KEY[s.queueId];
      if (!key) continue;
      history[key].push({
        capturedAt: s.capturedAt.toISOString(),
        queueId: s.queueId,
        tier: s.tier,
        rank: s.rank,
        leaguePoints: s.leaguePoints,
      });
    }
    return history;
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

    let wroteSnapshot = false;
    for (const entry of entries) {
      // League-V4 returns every ladder the account has standing on, including
      // ones with no place in this app (RANKED_TFT). Deciding membership from
      // the shared map rather than from a condition here is what makes a new
      // ladder a one-line change: the previous hardcoded pair silently threw
      // away every RANKED_PREMADE_5x5 capture, and because the filter runs
      // before the write, the table it produced looked like proof that Riot
      // exposed no such ladder.
      if (!RANKED_QUEUE_TYPE_TO_KEY[entry.queueType]) continue;

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
        wroteSnapshot = true;
      }
    }

    if (wroteSnapshot) {
      await this.refreshAccountSummary(summoner.puuid);
    }
  }

  // Idempotent "current state" recompute for the Summoner denorm columns
  // (highest of solo/flex rank + last-played champion). Called from every
  // persistence chokepoint — rank-snapshot writes, match writes — so the
  // nav-bootstrap query reads coherent values in one Summoner read instead
  // of joining RankSnapshot + Match per account. Always reads canonical
  // tables, never trusts the caller's view of what just changed; that
  // keeps the function safe to call from any writer regardless of which
  // path Riot data arrived through. Public so one-off backfill scripts
  // can hydrate the denorm columns from existing snapshots without
  // re-running Riot fetches.
  async refreshAccountSummary(puuid: string): Promise<void> {
    const [latestPerQueue, lastMatch] = await Promise.all([
      Promise.all(
        RANKED_QUEUE_KEYS.map(async (key) => {
          const queueId = RANKED_QUEUE_KEY_TO_TYPE[key];
          const latest = await this.prisma.rankSnapshot.findFirst({
            where: { puuid, queueId },
            orderBy: { capturedAt: "desc" },
            select: { tier: true, rank: true, leaguePoints: true },
          });
          return latest && { ...latest, queueId };
        })
      ),
      this.prisma.match.findFirst({
        where: { puuid, remake: false },
        orderBy: { playedAt: "desc" },
        select: { champion: true },
      }),
    ]);

    // Folded in RANKED_QUEUE_KEYS order, and `pickHigherRank` favours its left
    // argument, so an identical-LP tie resolves to the earlier queue — solo
    // over flex over the premade ladder, matching the UI's display preference.
    const higher = latestPerQueue.reduce<ComparableRank | null>(
      (best, next) => pickHigherRank(best, next),
      null
    );

    await this.prisma.summoner.update({
      where: { puuid },
      data: {
        currentRankTier: higher?.tier ?? null,
        currentRankDivision: higher?.rank ?? null,
        currentRankLp: higher?.leaguePoints ?? null,
        currentRankQueue: higher?.queueId ?? null,
        lastPlayedChampionAlias: lastMatch?.champion ?? null,
        summaryUpdatedAt: new Date(),
      },
    });
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

    await this.assertTrackedMatch(matchId);

    const regional = this.regionalForMatch(matchId);
    const raw = await this.riot.getMatchById(matchId, regional);
    const ownerPuuids = await this.resolveOwnerPuuids();
    const projected = projectMatchForStorage(raw, ownerPuuids);

    await this.prisma.matchDetailCache.create({
      data: { matchId, detail: projected as unknown as object },
    });
    return riotMatchToDetail(projected);
  }

  async getMatchTimeline(matchId: string): Promise<MatchTimelineProjection> {
    const cached = await this.prisma.matchTimelineCache.findUnique({
      where: { matchId },
    });
    if (cached)
      return riotTimelineToProjection(
        cached.timeline as unknown as Parameters<typeof riotTimelineToProjection>[0]
      );

    await this.assertTrackedMatch(matchId);

    const regional = this.regionalForMatch(matchId);
    const raw = await this.riot.getMatchTimelineById(matchId, regional);

    await this.prisma.matchTimelineCache.create({
      data: { matchId, timeline: raw as unknown as object },
    });
    return riotTimelineToProjection(raw);
  }

  // Serving a cached match to anyone is fine — it is the same data the site
  // renders. Fetching an *uncached* one is not: the id shape is enumerable, so
  // without this the endpoint is an unauthenticated proxy onto the whole Riot
  // match API, paid for out of our rate-limit budget, writing a permanent cache
  // row per request. A `Match` row exists only for matches a tracked account
  // actually played, which makes it the right thing to gate on.
  //
  // The sync path does not come through here — it calls the Riot client
  // directly — so a genuinely new match still gets fetched and stored by the
  // match-list flow before anyone can open its detail page.
  private async assertTrackedMatch(matchId: string): Promise<void> {
    const known = await this.prisma.match.findFirst({
      where: { matchId },
      select: { matchId: true },
    });
    if (!known) throw new NotFoundException(`Unknown match ${matchId}`);
  }

  // `platformToRegional` throws a bare Error for an unrecognised prefix, which
  // surfaces as a 500. The id shape passes DTO validation long before we know
  // whether the platform is real, so map it to a 400 here.
  private regionalForMatch(matchId: string): Regional {
    const platform = matchId.split("_")[0]?.toLowerCase();
    if (!platform) throw new BadRequestException(`Malformed match id ${matchId}`);
    try {
      return platformToRegional(platform);
    } catch {
      throw new BadRequestException(`Unknown platform in match id ${matchId}`);
    }
  }

  // The allowlist lives here rather than only at the callers because this is
  // the choke point: every path that reaches Riot's Account-V1 or writes a
  // `Summoner` row goes through it. Enforcing it at each caller is what let
  // `MatchBaselineService` and `MatchNarrativeService` ship without the check
  // — they call this directly and never inject `IdentityService` — which made
  // three public routes resolve and persist any Riot ID an anonymous caller
  // named. Callers may still check first to fail before doing other work; the
  // duplicate costs an in-memory compare. `conventions.spec.ts` pins the check
  // being here so a future edit cannot quietly move it back out.
  async resolveSummoner(
    region: string,
    gameName: string,
    tagLine: string
  ): Promise<{ puuid: string }> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }

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
      this.pruneMatchIdsCache();
    }
    return ids;
  }

  // The TTL above is only consulted on a read of the same key, so an entry
  // nobody asks for again is held for the process lifetime. The key includes
  // the caller-supplied `queue`, so distinct queue values mint distinct
  // permanent entries — bounded now at the param (see BoundedIntPipe) and here,
  // because a bound on the key space is not the same as a bound on the map.
  private pruneMatchIdsCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.matchIdsCache) {
      if (entry.expiry <= now) this.matchIdsCache.delete(key);
    }
    // Map iterates in insertion order, so its own key order is the eviction
    // order. Real use is a handful of keys per tracked account.
    while (this.matchIdsCache.size > MATCH_IDS_CACHE_MAX) {
      const oldest = this.matchIdsCache.keys().next();
      if (oldest.done) break;
      this.matchIdsCache.delete(oldest.value);
    }
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
          ? { ...baseSummary, ...timelineMetrics, hasTimeline: true }
          : baseSummary;

        return { matchId, raw, summary, items, rawTimeline };
      })
    );

    // Phase 2 (historical path only): find the chronologically newest match
    // per ranked queue in this batch, then drop any queue where the DB already
    // has a more recent game — those were covered by a head-sync snapshot.
    const snapshotMatchIds = new Set<string>();
    if (opts.attachSnapshotToNewest) {
      // Keyed on queueId, not the label: labels are not injective, so two
      // distinct queues sharing one would collapse into a single bucket and
      // only the later of the two would get a snapshot. Solo/flex don't
      // collide today, but the bucket key should not depend on that.
      const newestPerQueue = new Map<number, { matchId: string; playedAt: string }>();
      for (const r of fetched) {
        if (r.status !== "fulfilled") continue;
        const { matchId, raw, summary } = r.value;
        if (!RANKED_QUEUE_MAP[raw.info.queueId]) continue;
        const prev = newestPerQueue.get(summary.queueId);
        if (!prev || summary.playedAt > prev.playedAt) {
          newestPerQueue.set(summary.queueId, { matchId, playedAt: summary.playedAt });
        }
      }
      for (const [queueId, { matchId, playedAt }] of newestPerQueue) {
        const hasNewer = await this.prisma.match.count({
          where: { puuid, queueId, playedAt: { gt: new Date(playedAt) } },
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
        let snapshotTierBefore: string | undefined;
        let snapshotRankBefore: string | undefined;
        let snapshotLpBefore: number | undefined;

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

          // BEFORE snapshot: the most recent RankSnapshot captured strictly
          // before this match's playedAt. Independent of attach-this-batch
          // rules — looking up history is always safe. Combined with the
          // AFTER snapshot above, the per-match LP delta becomes
          // self-contained (after - before) so decay between matches no
          // longer poisons the next match's delta.
          const before = await this.prisma.rankSnapshot.findFirst({
            where: {
              puuid,
              queueId: rankedQueueId,
              capturedAt: { lt: new Date(summary.playedAt) },
            },
            orderBy: { capturedAt: "desc" },
            select: { tier: true, rank: true, leaguePoints: true },
          });
          if (before) {
            snapshotTierBefore = before.tier;
            snapshotRankBefore = before.rank;
            snapshotLpBefore = before.leaguePoints;
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
          snapshotTier: snapshotTier ?? null,
          snapshotRank: snapshotRank ?? null,
          snapshotLp: snapshotLp ?? null,
          snapshotTierBefore: snapshotTierBefore ?? null,
          snapshotRankBefore: snapshotRankBefore ?? null,
          snapshotLpBefore: snapshotLpBefore ?? null,
        };

        await Promise.all([
          this.prisma.matchDetailCache.upsert({
            where: { matchId },
            create: {
              matchId,
              detail: projectMatchForStorage(raw, new Set([puuid])) as unknown as object,
            },
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

    // Refresh the denorm summary whenever this path actually upserted match
    // rows. `missing.length > 0` is the right signal: a cache-hit-only call
    // already exited early at the `missing.length === 0` short-circuit
    // above, so reaching this point means at least one match was attempted.
    // Even a partial failure path still updates because the surviving
    // upserts may have changed the last-played champion.
    if (results.some((r) => r.status === "fulfilled")) {
      await this.refreshAccountSummary(puuid);
    }
  }

  private async resolveOwnerPuuids(): Promise<Set<string>> {
    const accounts = this.identity.getLolAccounts();
    if (accounts.length === 0) return new Set();
    const summoners = await this.prisma.summoner.findMany({
      where: {
        OR: accounts.map((a) => ({
          gameName: a.gameName,
          tagLine: a.tagLine,
          region: a.region,
        })),
      },
      select: { puuid: true },
    });
    return new Set(summoners.map((s) => s.puuid));
  }
}
