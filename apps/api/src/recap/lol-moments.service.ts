import { Injectable } from "@nestjs/common";
import { type RecapCandidate, normalizeLp } from "@vyoh/shared";

import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";

/** Lookback window for the owner's "main champion pool". Long enough that a
 *  one-off off-meta game doesn't influence the pool itself; short enough that
 *  meta + role shifts (Riot rebalances, owner experimenting with a new role)
 *  re-shape the pool on a season-relevant timescale. 90d is the same window
 *  the LoL profile peaks chips average over — same "this season" frame. */
const MAIN_POOL_WINDOW_DAYS = 90;

/** Number of champions defining the main pool. Set so the off-meta detector
 *  treats the owner's deepest rotation as "expected" — anything outside is a
 *  candidate. Top-5 covers an Ahri OTP's deepest rotation plus a few flex/
 *  filler picks without leaving the lane open to surprise picks crowding in. */
const MAIN_POOL_SIZE = 5;

/** Lookback window for off-meta candidates. The chapter is a *recent* moment;
 *  surface picks from inside the editorial-recency frame (~30d ≈ "this
 *  season"). The selector's decay applies on top, so older candidates within
 *  the window naturally score lower. */
const OFF_META_WINDOW_DAYS = 30;

/** Base signal for an off-meta candidate before recency decay + the off-meta
 *  multiplier. Calibrated so a recent off-meta pick (daysSince ~ 0..7) clears
 *  the score floor (5) after `RECAP_OFF_META_BOOST` (1.5×) and decay:
 *    20 × 1.5 × 0.5^(7/14) ≈ 21 — comfortably above 5.
 *  At daysSince ~ 28 (two half-lives), score drops to ~ 7.5 — still surfaces.
 *  Beyond ~ 35d, it sinks below the floor and the chapter quietly drops. */
const OFF_META_BASE_SIGNAL = 20;

/** Lookback window for rank-up candidates. Same 30d "this season" frame as
 *  off-meta — a rank-up that happened two months ago isn't current news. */
const RANK_UP_WINDOW_DAYS = 30;

/** Maximum recent matches scanned when looking for a rank-up. The detector
 *  walks ranked matches newest-first and picks the first one whose snapshot
 *  pair crosses a tier or division boundary. 80 covers ~3 weeks of dense
 *  ranked play; beyond that the daysSince decay sinks the signal anyway. */
const RANK_UP_SCAN_LIMIT = 80;

/** Base signal for a tier-change rank-up (e.g. Silver → Gold, or Master →
 *  Grandmaster). Tier crossings are the headline rank events — they're the
 *  ones a player frames a season around — so they earn a higher base signal
 *  than division crossings (35 × 0.5^(14/14) ≈ 17, still well above the
 *  floor at the half-life boundary). */
const RANK_UP_TIER_SIGNAL = 35;

/** Base signal for a division-change rank-up (e.g. Silver IV → Silver III).
 *  Division crossings are routine inside a tier but still worth surfacing as
 *  recent forward motion — 22 × 0.5^(14/14) = 11 stays above the floor at
 *  the half-life boundary, and decays to ~5.5 at 28d. */
const RANK_UP_DIVISION_SIGNAL = 22;

/** Queue types where champion pick is a deliberate signal under stakes.
 *  ARAM rolls champions randomly; Swarm/Arena/URF run modified rulesets that
 *  invite experimentation; Normal Draft is practice space where Ahri OTPs
 *  trying Lee Sin once isn't a "stepping off Ahri" moment. Restricting the
 *  detector to ranked queues keeps the chapter framing honest — the off-meta
 *  pick has to have been a real pick under real ELO consequences. Mirrors
 *  the queueType strings emitted by `match-mapper.ts`. */
const RANKED_QUEUE_TYPES = ["Ranked Solo", "Ranked Flex"] as const;

/**
 * LoL moment detector for the landing-page recap chapter stream. R-6 ships
 * the OFF_META_PICK detector only; the service is structured so RANK_UP,
 * KDA_OUTLIER, STREAK_5W/5L, RETURN_FROM_HIATUS, and MARATHON can plug into
 * the same `detect*` shape in R-7 without re-doing the candidate-merge layer.
 *
 * Owner-filtered via `IdentityService.getOwnerPuuids()` — the recap chapter
 * stream is "this is what the owner has been doing", not aggregated.
 */
@Injectable()
export class LolMomentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService
  ) {}

  async detectAll(now: Date = new Date()): Promise<RecapCandidate[]> {
    const [offMeta, rankUps] = await Promise.all([
      this.detectOffMetaPicks(now),
      this.detectRankUps(now),
    ]);
    return [...offMeta, ...rankUps];
  }

  /**
   * Detect the owner's most recent "off-meta" pick — a match where the
   * champion played is outside the owner's deepest rotation. Produces at
   * most one candidate per call; multiple recent off-meta picks would
   * crowd the chapter list with near-duplicate moments, and the most
   * recent one is the editorially strongest framing.
   *
   * Algorithm:
   *   1. Read the owner's match history within the 90d main-pool window.
   *      Group by champion, count games. Top-5 by count = main pool.
   *   2. Scan the last 30d for matches outside the main pool, ordered by
   *      recency desc. Take the freshest. Empty result if every recent
   *      match is in the pool, or if the owner has no main-pool history
   *      yet (pool is undefined — every pick would be "off-meta", which
   *      is the wrong framing).
   *   3. Return one candidate with the off-meta multiplier flag set, so
   *      the selector's `RECAP_OFF_META_BOOST` lifts it above mainline
   *      Steam-subject candidates even when its raw signal is small.
   */
  async detectOffMetaPicks(now: Date): Promise<RecapCandidate[]> {
    const ownerPuuids = await this.identity.getOwnerPuuids();
    if (ownerPuuids.length === 0) return [];

    const mainPoolCutoff = new Date(
      now.getTime() - MAIN_POOL_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    const candidateCutoff = new Date(
      now.getTime() - OFF_META_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );

    const championCounts = await this.prisma.match.groupBy({
      by: ["champion"],
      where: {
        puuid: { in: ownerPuuids },
        playedAt: { gte: mainPoolCutoff },
        remake: false,
        queueType: { in: [...RANKED_QUEUE_TYPES] },
      },
      _count: { _all: true },
    });
    if (championCounts.length === 0) return [];

    const mainPool = new Set(
      championCounts
        .sort((a, b) => b._count._all - a._count._all)
        .slice(0, MAIN_POOL_SIZE)
        .map((c) => c.champion)
    );

    const offMetaMatch = await this.prisma.match.findFirst({
      where: {
        puuid: { in: ownerPuuids },
        playedAt: { gte: candidateCutoff },
        remake: false,
        queueType: { in: [...RANKED_QUEUE_TYPES] },
        champion: { notIn: Array.from(mainPool) },
      },
      orderBy: { playedAt: "desc" },
      // Select the receipt fields the chapter renders — KDA + result + duration
      // + queue. Pulling them from this same row avoids a second match-detail
      // round-trip on the web side just to populate the moment stat strip.
      select: {
        matchId: true,
        champion: true,
        playedAt: true,
        kills: true,
        deaths: true,
        assists: true,
        win: true,
        durationSec: true,
        queueType: true,
      },
    });
    if (!offMetaMatch) return [];

    const daysSince = Math.max(
      0,
      Math.floor(
        (now.getTime() - offMetaMatch.playedAt.getTime()) / (24 * 60 * 60 * 1000)
      )
    );

    return [
      {
        kind: "lol-moment",
        slug: `lol-moment-off-meta-${offMetaMatch.matchId}`,
        momentType: "OFF_META_PICK",
        baseSignal: OFF_META_BASE_SIGNAL,
        daysSince,
        matchId: offMetaMatch.matchId,
        championAlias: offMetaMatch.champion,
        matchStats: {
          kills: offMetaMatch.kills,
          deaths: offMetaMatch.deaths,
          assists: offMetaMatch.assists,
          win: offMetaMatch.win,
          durationSec: offMetaMatch.durationSec,
          queueType: offMetaMatch.queueType,
        },
        offMeta: true,
      },
    ];
  }

  /**
   * Detect the owner's most recent tier or division climb. Walks ranked
   * matches newest-first within the 30d window and returns the first whose
   * snapshot pair crosses a tier-or-division boundary in the up direction.
   * LP-only gains (same tier+division, higher LP) don't qualify — the chapter
   * needs a meaningful "you climbed" framing, not a one-game LP twitch.
   *
   * Algorithm:
   *   1. Read up to RANK_UP_SCAN_LIMIT recent ranked matches with both the
   *      before- and after-snapshot fully populated (six non-null columns).
   *   2. Walk newest-first; pick the first match where:
   *        normalizeLp(toTier,toRank,toLp) > normalizeLp(fromTier,fromRank,fromLp)
   *      AND (snapshotTier !== snapshotTierBefore
   *           OR snapshotRank !== snapshotRankBefore).
   *   3. Magnitude: tier-string change → RANK_UP_TIER_SIGNAL (loud); rank-only
   *      change → RANK_UP_DIVISION_SIGNAL (quieter). Decay applies on top.
   *
   * Returns at most one candidate per call — the most recent climb is the
   * editorially strongest moment, and multiple rank-up rows would crowd the
   * lol-moment cap with near-duplicates.
   */
  async detectRankUps(now: Date): Promise<RecapCandidate[]> {
    const ownerPuuids = await this.identity.getOwnerPuuids();
    if (ownerPuuids.length === 0) return [];

    const candidateCutoff = new Date(
      now.getTime() - RANK_UP_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );

    const recent = await this.prisma.match.findMany({
      where: {
        puuid: { in: ownerPuuids },
        playedAt: { gte: candidateCutoff },
        remake: false,
        queueType: { in: [...RANKED_QUEUE_TYPES] },
        snapshotTier: { not: null },
        snapshotRank: { not: null },
        snapshotLp: { not: null },
        snapshotTierBefore: { not: null },
        snapshotRankBefore: { not: null },
        snapshotLpBefore: { not: null },
      },
      orderBy: { playedAt: "desc" },
      take: RANK_UP_SCAN_LIMIT,
      select: {
        matchId: true,
        champion: true,
        playedAt: true,
        kills: true,
        deaths: true,
        assists: true,
        win: true,
        durationSec: true,
        queueType: true,
        snapshotTier: true,
        snapshotRank: true,
        snapshotLp: true,
        snapshotTierBefore: true,
        snapshotRankBefore: true,
        snapshotLpBefore: true,
      },
    });

    for (const m of recent) {
      // Type narrowing — the where-clause filtered nulls but Prisma still
      // types the columns as nullable. Bail safely if a null slips through.
      const toTier = m.snapshotTier;
      const toRank = m.snapshotRank;
      const toLp = m.snapshotLp;
      const fromTier = m.snapshotTierBefore;
      const fromRank = m.snapshotRankBefore;
      const fromLp = m.snapshotLpBefore;
      if (
        toTier === null ||
        toRank === null ||
        toLp === null ||
        fromTier === null ||
        fromRank === null ||
        fromLp === null
      ) {
        continue;
      }

      const toScalar = normalizeLp(toTier, toRank, toLp);
      const fromScalar = normalizeLp(fromTier, fromRank, fromLp);
      if (toScalar <= fromScalar) continue;

      const tierChanged = toTier !== fromTier;
      const rankChanged = toRank !== fromRank;
      if (!tierChanged && !rankChanged) continue;

      const baseSignal = tierChanged ? RANK_UP_TIER_SIGNAL : RANK_UP_DIVISION_SIGNAL;
      const daysSince = Math.max(
        0,
        Math.floor((now.getTime() - m.playedAt.getTime()) / (24 * 60 * 60 * 1000))
      );

      return [
        {
          kind: "lol-moment",
          slug: `lol-moment-rank-up-${m.matchId}`,
          momentType: "RANK_UP",
          baseSignal,
          daysSince,
          matchId: m.matchId,
          championAlias: m.champion,
          matchStats: {
            kills: m.kills,
            deaths: m.deaths,
            assists: m.assists,
            win: m.win,
            durationSec: m.durationSec,
            queueType: m.queueType,
          },
          rankUp: {
            fromTier,
            fromRank,
            fromLp,
            toTier,
            toRank,
            toLp,
          },
        },
      ];
    }

    return [];
  }
}
