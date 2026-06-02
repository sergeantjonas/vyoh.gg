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

/** Lookback window for KDA outlier detection — same 30d "this season" frame
 *  used everywhere else in the moment family. The owner's recent baseline is
 *  what makes an outlier an outlier; widening this would drown a hot streak
 *  in a cold-season average. */
const KDA_OUTLIER_WINDOW_DAYS = 30;

/** Minimum number of ranked matches required before computing a baseline.
 *  Below this and "your average" isn't a real average — five games of "9 KDA"
 *  averaged from one outlier doesn't tell us anything about typical perf.
 *  8 strikes a balance: enough for a baseline, low enough that recently-active
 *  accounts qualify after a week or two. */
const KDA_OUTLIER_BASELINE_MIN_MATCHES = 8;

/** Minimum ratio of match KDA to baseline KDA for a game to count as an
 *  outlier. 1.8× means a player averaging 3.0 needs ≥5.4 KDA to surface;
 *  a player averaging 5.0 needs ≥9.0. Tight enough that routine games don't
 *  qualify, loose enough that a clearly good performance does. */
const KDA_OUTLIER_RATIO = 1.8;

/** Absolute KDA floor — independent of baseline — that an outlier must clear.
 *  Prevents a player on a 1.5-KDA cold streak from getting a "standout" chapter
 *  for a routine 3.0 game (1.5 × 1.8 = 2.7 — below this floor). 6.0 is the
 *  shape of an editorially-real standout, not just a not-terrible game. */
const KDA_OUTLIER_ABSOLUTE_FLOOR = 6.0;

/** Per-KDA-unit scaling for the base signal. matchKda × factor → baseSignal
 *  before recency decay. Calibrated so a 7 KDA match at 0d lands ≈ 21 raw
 *  score — clears the floor (5) at the 14d half-life, sinks past ~30d. A 12
 *  KDA at 0d lands ≈ 36, clearly above an off-meta-pick-recency-boosted
 *  signal so a fresh standout wins over a fresh off-meta. */
const KDA_OUTLIER_SIGNAL_FACTOR = 3;

/** Minimum gap (days) between two ranked owner matches to count as a
 *  "hiatus return". 14d is the threshold below which "a break" reads as
 *  routine rest rather than an editorial moment. A 7d gap is just "took a
 *  weekend off"; 14d+ starts feeling like "you stopped playing for a while
 *  and came back". */
const HIATUS_THRESHOLD_DAYS = 14;

/** The return match must have happened within this many days for the
 *  chapter to surface. A return from hiatus 60d ago is editorially stale —
 *  the page is about *current* moments, and recency decay would drop it
 *  anyway. 30d matches the other moment detectors' frame. */
const HIATUS_RETURN_WINDOW_DAYS = 30;

/** Upper bound on gap days fed into the base signal. Beyond this point the
 *  story is "you came back from dormancy" regardless of exact duration —
 *  a 6-month break and a 9-month break read about the same to the reader.
 *  Caps `baseSignal` at HIATUS_GAP_CAP_DAYS × HIATUS_SIGNAL_FACTOR. */
const HIATUS_GAP_CAP_DAYS = 90;

/** Per-day scaling for the hiatus base signal. gapDays × factor → baseSignal
 *  before decay. Calibrated so a 14d gap (just-qualifies) → 5.6 raw, a 30d
 *  gap → 12, a 60d gap → 24, a 90d+ gap → 36 (capped). Editorial weight
 *  scales with break length: short hiatus is a quiet beat, long hiatus is
 *  a strong story. */
const HIATUS_SIGNAL_FACTOR = 0.4;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Lookback window for streak detection. The most recent match must fall
 *  within this many days to count as an active/just-completed streak — a
 *  5-win streak that ended 45d ago isn't current news. */
const STREAK_WINDOW_DAYS = 30;

/** Minimum consecutive same-result match count to qualify as a streak.
 *  Five matches is the canonical "streak" in League — Riot's own
 *  honor/hot-streak UI uses the same threshold. Below this, two or three
 *  in a row reads as "you played well/poorly twice", not as a streak. */
const STREAK_MIN_LENGTH = 5;

/** Upper bound on streak length fed into the base signal. A 15-game streak
 *  and a 25-game streak both read as "incredible run" — the curve flattens
 *  past this point. */
const STREAK_LENGTH_CAP = 15;

/** Per-match scaling for the streak base signal. streakLength × factor →
 *  baseSignal. Calibrated so a 5-streak → 15 raw (clears floor easily at
 *  0d, marginal at 14d), 8-streak → 24, 15+ → 45 (max). */
const STREAK_SIGNAL_FACTOR = 3;

/** Number of recent ranked matches the streak detector reads. Capped because
 *  we only need enough rows to identify the run at the head of the desc
 *  order; pulling the entire match table for streak detection would be
 *  wasteful. 20 covers any plausible streak length and a buffer. */
const STREAK_SCAN_LIMIT = 20;

function computeKda(kills: number, deaths: number, assists: number): number {
  return (kills + assists) / Math.max(1, deaths);
}

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
    const [offMeta, rankUps, kdaOutliers, hiatusReturns, streaks] = await Promise.all([
      this.detectOffMetaPicks(now),
      this.detectRankUps(now),
      this.detectKdaOutliers(now),
      this.detectReturnsFromHiatus(now),
      this.detectStreaks(now),
    ]);
    return [...offMeta, ...rankUps, ...kdaOutliers, ...hiatusReturns, ...streaks];
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

  /**
   * Detect the owner's best recent KDA performance — a match whose
   * `(kills + assists) / max(1, deaths)` clearly outshines their 30-day
   * ranked baseline. The chapter framing leans on the multiplier ("4.2× the
   * 30-day average"), so the baseline is part of the descriptor receipt.
   *
   * Algorithm:
   *   1. Read every ranked match in the 30d window for the owner. If there
   *      are fewer than `KDA_OUTLIER_BASELINE_MIN_MATCHES`, bail — without a
   *      baseline the multiplier is meaningless.
   *   2. Compute the mean KDA across that set as the baseline.
   *   3. Pick the match with the HIGHEST KDA where
   *        matchKda >= baseline × KDA_OUTLIER_RATIO
   *        AND matchKda >= KDA_OUTLIER_ABSOLUTE_FLOOR.
   *      Highest (not most recent) because the editorial story is "this was
   *      your best game", not "your last decent game"; recency decay through
   *      `recapScore` handles freshness on top of magnitude.
   *   4. baseSignal scales linearly with matchKda × KDA_OUTLIER_SIGNAL_FACTOR
   *      so a 7 KDA → ~21, a 12 KDA → ~36. Decay drops it below the floor
   *      around 30d for typical magnitudes.
   *
   * Returns ≤1 candidate per call — multiple "standout" rows in one chapter
   * stream would dilute the framing.
   */
  async detectKdaOutliers(now: Date): Promise<RecapCandidate[]> {
    const ownerPuuids = await this.identity.getOwnerPuuids();
    if (ownerPuuids.length === 0) return [];

    const candidateCutoff = new Date(
      now.getTime() - KDA_OUTLIER_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );

    const recent = await this.prisma.match.findMany({
      where: {
        puuid: { in: ownerPuuids },
        playedAt: { gte: candidateCutoff },
        remake: false,
        queueType: { in: [...RANKED_QUEUE_TYPES] },
      },
      orderBy: { playedAt: "desc" },
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

    if (recent.length < KDA_OUTLIER_BASELINE_MIN_MATCHES) return [];

    const baselineKda =
      recent.reduce((sum, m) => sum + computeKda(m.kills, m.deaths, m.assists), 0) /
      recent.length;

    const threshold = Math.max(
      baselineKda * KDA_OUTLIER_RATIO,
      KDA_OUTLIER_ABSOLUTE_FLOOR
    );

    // Highest-KDA match in the window — tie-break by recency (newer wins)
    // so two identical-KDA peaks favour the freshest framing.
    let best: (typeof recent)[number] | null = null;
    let bestKda = 0;
    for (const m of recent) {
      const kda = computeKda(m.kills, m.deaths, m.assists);
      if (kda < threshold) continue;
      if (best === null || kda > bestKda) {
        best = m;
        bestKda = kda;
      }
    }

    if (best === null) return [];

    const daysSince = Math.max(
      0,
      Math.floor((now.getTime() - best.playedAt.getTime()) / (24 * 60 * 60 * 1000))
    );

    return [
      {
        kind: "lol-moment",
        slug: `lol-moment-kda-outlier-${best.matchId}`,
        momentType: "KDA_OUTLIER",
        baseSignal: bestKda * KDA_OUTLIER_SIGNAL_FACTOR,
        daysSince,
        matchId: best.matchId,
        championAlias: best.champion,
        matchStats: {
          kills: best.kills,
          deaths: best.deaths,
          assists: best.assists,
          win: best.win,
          durationSec: best.durationSec,
          queueType: best.queueType,
        },
        kdaOutlier: {
          matchKda: bestKda,
          baselineKda,
        },
      },
    ];
  }

  /**
   * Detect the owner's most recent return from a ranked-play hiatus — a
   * match where the previous owner ranked game was ≥ HIATUS_THRESHOLD_DAYS
   * earlier. Editorial framing: "X days away, then back on Champ".
   *
   * Algorithm:
   *   1. Read every owner ranked match (all-time, ASC by playedAt). The
   *      window restriction applies to the RETURN match, not the previous
   *      match — a 6-month break followed by a fresh return is a story.
   *   2. Walk consecutive pairs (prev, curr). If `curr.playedAt - prev.playedAt`
   *      ≥ HIATUS_THRESHOLD_DAYS AND `curr.playedAt` is within
   *      HIATUS_RETURN_WINDOW_DAYS of now, `curr` qualifies as a return.
   *   3. Pick the most recent qualifying return — editorially, if the owner
   *      came back twice in the window (multiple smaller hiatuses), the
   *      freshest comeback is the strongest framing.
   *   4. baseSignal scales linearly with gapDays up to HIATUS_GAP_CAP_DAYS,
   *      then plateaus. A two-week break is a quiet beat; three months is
   *      a strong one.
   *
   * Returns ≤1 candidate per call. The chapter shares the single-match
   * structural template with OFF_META_PICK / KDA_OUTLIER (matchStats from
   * the return match, championAlias drives the splash); the new
   * `hiatusReturn: { gapDays }` field carries the receipt for the prose.
   */
  async detectReturnsFromHiatus(now: Date): Promise<RecapCandidate[]> {
    const ownerPuuids = await this.identity.getOwnerPuuids();
    if (ownerPuuids.length === 0) return [];

    const returnCutoff = new Date(now.getTime() - HIATUS_RETURN_WINDOW_DAYS * DAY_MS);

    // Fetch ALL owner ranked matches — the "previous match" reference can
    // be arbitrarily old. We rely on `ownerPuuids` filter + the ranked-queue
    // narrowing to keep the row count tractable (the owner has hundreds, not
    // hundreds of thousands).
    const matches = await this.prisma.match.findMany({
      where: {
        puuid: { in: ownerPuuids },
        remake: false,
        queueType: { in: [...RANKED_QUEUE_TYPES] },
      },
      orderBy: { playedAt: "asc" },
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

    // Walk consecutive pairs newest-last; keep the latest qualifying return.
    let bestReturn: { match: (typeof matches)[number]; gapDays: number } | null = null;
    for (let i = 1; i < matches.length; i++) {
      const curr = matches[i];
      const prev = matches[i - 1];
      if (!curr || !prev) continue;
      if (curr.playedAt < returnCutoff) continue;
      const gapMs = curr.playedAt.getTime() - prev.playedAt.getTime();
      const gapDays = Math.floor(gapMs / DAY_MS);
      if (gapDays < HIATUS_THRESHOLD_DAYS) continue;
      // ASC order means a later iteration with a qualifying gap is always
      // the freshest return — keep overwriting until the loop ends.
      bestReturn = { match: curr, gapDays };
    }

    if (bestReturn === null) return [];

    const { match: m, gapDays } = bestReturn;
    const daysSince = Math.max(
      0,
      Math.floor((now.getTime() - m.playedAt.getTime()) / DAY_MS)
    );
    const cappedGapDays = Math.min(gapDays, HIATUS_GAP_CAP_DAYS);
    const baseSignal = cappedGapDays * HIATUS_SIGNAL_FACTOR;

    return [
      {
        kind: "lol-moment",
        slug: `lol-moment-hiatus-return-${m.matchId}`,
        momentType: "RETURN_FROM_HIATUS",
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
        hiatusReturn: { gapDays },
      },
    ];
  }

  /**
   * Detect an active or just-completed ranked streak — a run of ≥ 5
   * consecutive same-result matches at the head of the owner's recent
   * ranked history. Active streak (still going) and just-completed streak
   * (head match is the last of the run) both qualify — the framing is "you
   * just had a streak", not necessarily "you're currently on one".
   *
   * Algorithm:
   *   1. Read the top STREAK_SCAN_LIMIT ranked matches DESC by playedAt.
   *      Bail if the head match is outside STREAK_WINDOW_DAYS (an old
   *      streak isn't current news).
   *   2. The head match's `win` value defines the streak direction. Walk
   *      forward (older) and count consecutive same-result matches; stop at
   *      the first opposite-result.
   *   3. If length ≥ STREAK_MIN_LENGTH, emit a candidate with momentType
   *      `STREAK_5W` or `STREAK_5L`. baseSignal scales linearly with length
   *      up to STREAK_LENGTH_CAP, then plateaus.
   *
   * Returns ≤ 1 candidate per call. Multiple overlapping streak surfaces
   * in one chapter list would crowd the bucket with near-duplicate framing.
   * `take: STREAK_SCAN_LIMIT` on the findMany call also serves as the
   * spec-mock discriminator (KDA + hiatus don't pass `take`).
   */
  async detectStreaks(now: Date): Promise<RecapCandidate[]> {
    const ownerPuuids = await this.identity.getOwnerPuuids();
    if (ownerPuuids.length === 0) return [];

    const windowCutoff = new Date(now.getTime() - STREAK_WINDOW_DAYS * DAY_MS);

    const recent = await this.prisma.match.findMany({
      where: {
        puuid: { in: ownerPuuids },
        remake: false,
        queueType: { in: [...RANKED_QUEUE_TYPES] },
      },
      orderBy: { playedAt: "desc" },
      take: STREAK_SCAN_LIMIT,
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

    const head = recent[0];
    if (!head) return [];
    if (head.playedAt < windowCutoff) return [];

    const headResult = head.win;
    let length = 0;
    for (const m of recent) {
      if (m.win === headResult) length++;
      else break;
    }
    if (length < STREAK_MIN_LENGTH) return [];

    const daysSince = Math.max(
      0,
      Math.floor((now.getTime() - head.playedAt.getTime()) / DAY_MS)
    );
    const cappedLength = Math.min(length, STREAK_LENGTH_CAP);
    const baseSignal = cappedLength * STREAK_SIGNAL_FACTOR;
    const momentType = headResult ? "STREAK_5W" : "STREAK_5L";
    const result: "W" | "L" = headResult ? "W" : "L";

    return [
      {
        kind: "lol-moment",
        slug: `lol-moment-streak-${result.toLowerCase()}-${head.matchId}`,
        momentType,
        baseSignal,
        daysSince,
        matchId: head.matchId,
        championAlias: head.champion,
        matchStats: {
          kills: head.kills,
          deaths: head.deaths,
          assists: head.assists,
          win: head.win,
          durationSec: head.durationSec,
          queueType: head.queueType,
        },
        streak: { result, length },
      },
    ];
  }
}
