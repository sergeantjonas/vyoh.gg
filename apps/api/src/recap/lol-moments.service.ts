import { Injectable } from "@nestjs/common";
import type { RecapCandidate } from "@vyoh/shared";

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
    const offMeta = await this.detectOffMetaPicks(now);
    return [...offMeta];
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
        champion: { notIn: Array.from(mainPool) },
      },
      orderBy: { playedAt: "desc" },
      select: { matchId: true, champion: true, playedAt: true },
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
        offMeta: true,
      },
    ];
  }
}
