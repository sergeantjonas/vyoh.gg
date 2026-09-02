import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  type ChampionBuildFlowEntry,
  type ChampionExtras,
  type ChampionLanePhase,
  type ChampionRecap,
  type ChampionRuneDiversityEntry,
  type MatchSummary,
  deriveChampionRecap,
  excludeRemakes,
} from "@vyoh/shared";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";
import type { RiotMatchTimeline } from "../riot/types";
import { LolService } from "./lol.service";
import { ownerParticipant, storedMatchOf } from "./match-projection";
import { frameAtMinute, resolveParticipantId } from "./timeline-summary-mapper";

// Trailing window for the per-champion landing-chapter recap. 365 days
// dodges the moving season-split boundary while staying "yearly at least"
// per owner direction.
const RECAP_WINDOW_DAYS = 365;

/**
 * Champion-scoped analytics: everything keyed on one `championKey`.
 *
 * Split out of `LolAnalyticsService` on 2026-07-26, which had reached 1443
 * lines and was past the ~1250-line god-class watch in `parked.md`. The seam
 * is the query shape rather than the feature area: every method here filters
 * `Match.champion` and answers "how do you play this champion", while what
 * stays behind answers account-level questions (duos, squads, chronotype,
 * objectives, calibration) across all champions.
 *
 * The two halves share no state, which is what made the seam safe to cut.
 * `LolAnalyticsService` keeps its calibration cache and drops `LolService`
 * entirely, since only the two methods moved here ever used it.
 *
 * Two pre-existing defects came across the move unchanged so it stayed
 * reviewable as a pure move, then were fixed in the follow-up commit:
 * `getChampionExtras` and `getChampionRecap` were the only two analytics
 * methods not calling `identity.isLolAccountAllowed`, and `getChampionExtras`
 * aggregated over raw rows with no `excludeRemakes()`. The second was
 * invisible to the structural lint because the code never spelled `remake` at
 * all, which is the same blind spot that hid the post-game streak bug.
 */
@Injectable()
export class LolChampionAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly lol: LolService
  ) {}

  async getChampionExtras(
    region: string,
    gameName: string,
    tagLine: string,
    championKey: string,
    queues?: readonly number[]
  ): Promise<ChampionExtras> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.lol.resolveSummoner(region, gameName, tagLine);

    const rows = await this.prisma.match.findMany({
      where: {
        puuid: summoner.puuid,
        champion: { equals: championKey, mode: "insensitive" },
        items: { isEmpty: false },
        ...(queues && queues.length > 0 && { queueId: { in: [...queues] } }),
      },
      select: { items: true, laneOpponent: true, win: true, remake: true },
    });
    // `items: { isEmpty: false }` does not stand in for the remake filter: a
    // remake can still run long enough for a first back, so it arrives here
    // with items and a win flag and would count toward both aggregations.
    const matches = excludeRemakes(rows);

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

  /**
   * Champion recap — aggregate "your X" verdict feeding the per-champion
   * landing chapter. Reads the trailing 365-day window of stored matches on
   * this champion and derives the recap server-side via the shared deriver.
   *
   * Window: rolling 365 days. The current LoL competitive season has split
   * boundaries that move between years; a fixed-day window dodges that
   * coupling and keeps the recap "yearly at least" as the owner asked.
   */
  async getChampionRecap(
    region: string,
    gameName: string,
    tagLine: string,
    championKey: string
  ): Promise<ChampionRecap> {
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.lol.resolveSummoner(region, gameName, tagLine);

    const cutoff = new Date(Date.now() - RECAP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.match.findMany({
      where: {
        puuid: summoner.puuid,
        champion: { equals: championKey, mode: "insensitive" },
        playedAt: { gte: cutoff },
      },
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
        hasTimeline: true,
        csAt10: true,
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
        laneOpponent: true,
      },
    });

    const matches: MatchSummary[] = rows.map(({ playedAt, laneOpponent, ...rest }) => ({
      ...rest,
      playedAt: playedAt.toISOString(),
      laneOpponent: laneOpponent as MatchSummary["laneOpponent"],
    }));

    return deriveChampionRecap(championKey, matches);
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
    const playable = excludeRemakes(matches);
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

  // Champion rune diversity: for the user's recent N matches on `championKey`,
  // tally which keystone rune they ran and the win count per keystone. Keystone
  // is read from the cached raw Riot detail (perks.styles[0].selections[0].perk)
  // — same source as the match-detail participant rows; no timeline needed, so
  // this covers every match that has a MatchDetailCache row.
  async getChampionRuneDiversity(
    region: string,
    gameName: string,
    tagLine: string,
    championKey: string,
    count = 100
  ): Promise<ChampionRuneDiversityEntry[]> {
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
      select: { matchId: true, remake: true },
    });
    const playable = excludeRemakes(matches);
    if (playable.length === 0) return [];

    const caches = await this.prisma.matchDetailCache.findMany({
      where: { matchId: { in: playable.map((m) => m.matchId) } },
    });

    const map = new Map<number, ChampionRuneDiversityEntry>();
    for (const cache of caches) {
      const detail = storedMatchOf(cache.detail);
      const me = ownerParticipant(detail, summoner.puuid);
      if (!me) continue;
      const keystoneId = me.perks?.styles?.[0]?.selections?.[0]?.perk ?? 0;
      if (keystoneId === 0) continue;
      const prev = map.get(keystoneId);
      if (prev) {
        prev.games += 1;
        if (me.win) prev.wins += 1;
      } else {
        map.set(keystoneId, { keystoneId, games: 1, wins: me.win ? 1 : 0 });
      }
    }

    return [...map.values()].sort((a, b) => b.games - a.games);
  }

  // Champion lane phase: for the user's recent N matches on `championKey`,
  // compute the owner-minus-laneOpponent CS@10 / CS@15 / gold@10 differentials
  // from the stored timeline and average them, plus how often the owner came
  // out ahead (diff > 0). Read live from MatchTimelineCache like build-flow —
  // the opponent's per-frame stats aren't projected onto the Match row, so this
  // is the only source. Matches with no lane opponent (ARAM/Arena, unresolved
  // lane) or no 10-min frame (remakes, fast surrenders) drop out.
  async getChampionLanePhase(
    region: string,
    gameName: string,
    tagLine: string,
    championKey: string,
    count = 100
  ): Promise<ChampionLanePhase> {
    const empty: ChampionLanePhase = {
      sampleSize: 0,
      csAt10: { diff: 0, aheadRate: 0 },
      csAt15: { diff: 0, aheadRate: 0 },
      goldAt10: { diff: 0, aheadRate: 0 },
    };
    if (!this.identity.isLolAccountAllowed(gameName, tagLine, region)) {
      throw new ForbiddenException("Account not in whitelist");
    }
    const summoner = await this.prisma.summoner.findUnique({
      where: { gameName_tagLine_region: { gameName, tagLine, region } },
    });
    if (!summoner) return empty;

    const matches = await this.prisma.match.findMany({
      where: {
        puuid: summoner.puuid,
        champion: { equals: championKey, mode: "insensitive" },
      },
      orderBy: { playedAt: "desc" },
      take: count,
      select: { matchId: true, remake: true, laneOpponent: true },
    });
    const playable = excludeRemakes(matches).filter(
      (m): m is typeof m & { laneOpponent: { puuid: string } } =>
        !!m.laneOpponent &&
        typeof (m.laneOpponent as { puuid?: unknown }).puuid === "string"
    );
    if (playable.length === 0) return empty;

    const timelineRows = await this.prisma.matchTimelineCache.findMany({
      where: { matchId: { in: playable.map((m) => m.matchId) } },
    });
    const timelineByMatchId = new Map(timelineRows.map((t) => [t.matchId, t.timeline]));

    const csOf = (
      pf: { minionsKilled?: number; jungleMinionsKilled?: number } | undefined
    ) => (pf ? (pf.minionsKilled ?? 0) + (pf.jungleMinionsKilled ?? 0) : 0);

    // Independent accumulators per metric — a game can reach 10 min without
    // reaching 15, so each metric's average uses only the games that had its
    // frame and both participants present in it.
    const acc = {
      cs10: { sum: 0, ahead: 0, n: 0 },
      cs15: { sum: 0, ahead: 0, n: 0 },
      gold10: { sum: 0, ahead: 0, n: 0 },
    };
    const add = (bucket: { sum: number; ahead: number; n: number }, diff: number) => {
      bucket.sum += diff;
      if (diff > 0) bucket.ahead += 1;
      bucket.n += 1;
    };

    for (const m of playable) {
      const raw = timelineByMatchId.get(m.matchId);
      if (!raw) continue;
      const timeline = raw as unknown as RiotMatchTimeline;
      const ownerId = resolveParticipantId(timeline, summoner.puuid);
      const oppId = resolveParticipantId(timeline, m.laneOpponent.puuid);
      if (ownerId === null || oppId === null) continue;
      const ownerKey = String(ownerId);
      const oppKey = String(oppId);

      const f10 = frameAtMinute(timeline, 10);
      const owner10 = f10?.participantFrames[ownerKey];
      const opp10 = f10?.participantFrames[oppKey];
      if (owner10 && opp10) {
        add(acc.cs10, csOf(owner10) - csOf(opp10));
        add(acc.gold10, (owner10.totalGold ?? 0) - (opp10.totalGold ?? 0));
      }

      const f15 = frameAtMinute(timeline, 15);
      const owner15 = f15?.participantFrames[ownerKey];
      const opp15 = f15?.participantFrames[oppKey];
      if (owner15 && opp15) {
        add(acc.cs15, csOf(owner15) - csOf(opp15));
      }
    }

    const metric = (b: { sum: number; ahead: number; n: number }) => ({
      diff: b.n > 0 ? b.sum / b.n : 0,
      aheadRate: b.n > 0 ? b.ahead / b.n : 0,
    });

    return {
      sampleSize: acc.cs10.n,
      csAt10: metric(acc.cs10),
      csAt15: metric(acc.cs15),
      goldAt10: metric(acc.gold10),
    };
  }
}
