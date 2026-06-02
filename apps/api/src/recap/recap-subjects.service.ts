import { Injectable } from "@nestjs/common";
import type { RecapCandidate, RecapChapterDescriptor } from "@vyoh/shared";
import { ageBucketFromDaysSince, selectChapters } from "@vyoh/shared";

import { PrismaService } from "../prisma/prisma.service";
import { SteamOwnedGamesService } from "../steam/owned-games.service";
import { LolMomentsService } from "./lol-moments.service";
import { RECAP_HIDDEN_APPIDS } from "./recap-curation";

/** Lifetime-hours threshold for the dormant fallback. A game must carry
 *  meaningful historical engagement to surface in the no-recent-activity
 *  branch — a one-time launcher browse or 30-minute demo shouldn't qualify.
 *  5h is a casual-completion floor for most games. Tunable. */
const DORMANT_LIFETIME_FLOOR_HOURS = 5;

/** Same per-kind cap as the active path's steam-subject slot. */
const DORMANT_CAP = 3;

/** Below this 2w-playtime threshold, a recent `rtimeLastPlayedAt` is treated
 *  as a brief launch (e.g. opened the app to check something) rather than
 *  real engagement, and the dormant ranker falls back to the unlock signal
 *  for `freshest`. Without this, a 3-minute Silksong launch outranks an
 *  RE3 playthrough from 30 days ago in the dormant branch — the freshness
 *  signal is technically truer for Silksong but doesn't represent real
 *  engagement. 30 minutes is the rough threshold below which Steam will
 *  show a duration like "3m" rather than a session-sized number. */
const BRIEF_LAUNCH_2W_MINUTES = 30;

/**
 * Steam-subject candidate enumeration for the landing-page recap chapter
 * stream. Reads owned games (already filtered to currently-owned via the
 * service's `removedAt: null` join) and joins per-game unlock signal so a
 * recency-decayed score can be computed without a per-game round-trip.
 *
 * R-4a scope: Steam subjects only. LoL and Steam moment candidates land in
 * R-6/R-7 and feed the same `selectChapters` selector. The selector caps
 * per-kind and concatenates kinds in fixed order — see the shared scoring
 * module for the cross-kind contract.
 *
 * The Ahri chapter is a hardcoded structural anchor on the web side, not a
 * candidate here, per the arc note (ADR-6). This service produces only the
 * algorithmic list that sits *below* the anchor.
 */
@Injectable()
export class RecapSubjectsService {
  constructor(
    private readonly ownedGames: SteamOwnedGamesService,
    private readonly prisma: PrismaService,
    private readonly lolMoments: LolMomentsService
  ) {}

  async getChapters(now: Date = new Date()): Promise<RecapChapterDescriptor[]> {
    // Steam-subject candidates + LoL-moment candidates run in parallel —
    // they hit different tables and have no inter-dependency. `selectChapters`
    // handles per-kind capping + cross-kind ordering, so merging the lists
    // raw before the selector is sufficient.
    const [steamCandidates, lolMomentCandidates] = await Promise.all([
      this.collectSteamSubjectCandidates(now),
      this.lolMoments.detectAll(now),
    ]);
    const active = selectChapters([...steamCandidates, ...lolMomentCandidates]);
    if (active.length > 0) return active;
    // Dormant fallback: no game has cleared the recent-engagement floor in
    // the active path. Surface the most-recently-engaged games by lifetime
    // depth, no score floor, no decay — the bucket eyebrows derived from
    // daysSince ("Recently into", "This season on", "Earlier this year")
    // frame the result honestly, so a dormant Silksong from 30d ago reads
    // as "Earlier this year on Silksong" rather than "Playing lately".
    //
    // This is the "you've been busy with life" branch — common for any owner
    // with a job. Without it the algorithmic chapter list collapses to empty
    // whenever there's been no 14d activity, and the landing page shows only
    // the hardcoded Ahri anchor.
    return this.collectDormantFallback(now);
  }

  private async collectSteamSubjectCandidates(now: Date): Promise<RecapCandidate[]> {
    // 14d cutoff for the recent-unlock count that feeds baseSignal. Matches
    // the scoring half-life so a game has to be active *within* the decay
    // window to score on unlock signal at all. The unfiltered groupBy still
    // returns `_max(unlockedAt)` over all time — needed for the `freshest`
    // computation that drives the daysSince decay (a game last unlocked 20d
    // ago should still surface if it has recent playtime; its decay just
    // anchors on the unlock date).
    const recentUnlockCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [ownedGames, lastUnlockRows, recentUnlockRows] = await Promise.all([
      this.ownedGames.getOwnedGames(),
      this.prisma.steamPlayerUnlock.groupBy({
        by: ["appid"],
        _max: { unlockedAt: true },
      }),
      this.prisma.steamPlayerUnlock.groupBy({
        by: ["appid"],
        where: { unlockedAt: { gte: recentUnlockCutoff } },
        _count: { apiName: true },
      }),
    ]);

    const lastUnlockByAppid = new Map<number, Date | null>(
      lastUnlockRows.map((row) => [row.appid, row._max.unlockedAt ?? null])
    );
    const recentUnlockCountByAppid = new Map<number, number>(
      recentUnlockRows.map((row) => [row.appid, row._count.apiName])
    );

    const candidates: RecapCandidate[] = [];
    for (const game of ownedGames.games) {
      if (RECAP_HIDDEN_APPIDS.has(game.appid)) continue;
      // appType === 6 is tools/apps (Wallpaper Engine, 3DMark, RPG Maker,
      // SteamVR utilities). null falls through as "game" — same convention
      // as the library filter, correct for ~99% of newly-added rows in the
      // window between owned-sync and enrichment.
      if (game.appType !== null && game.appType !== 0) continue;

      const lastUnlockAt = lastUnlockByAppid.get(game.appid) ?? null;
      const lastUnlockMs = lastUnlockAt?.getTime() ?? null;
      const lastPlayedMs = game.rtimeLastPlayedAt
        ? new Date(game.rtimeLastPlayedAt).getTime()
        : null;
      const freshest =
        lastUnlockMs !== null && lastPlayedMs !== null
          ? Math.max(lastUnlockMs, lastPlayedMs)
          : (lastUnlockMs ?? lastPlayedMs);
      // No recency signal at all → skip. The arc never wants a chapter that
      // says "you've never opened this" — the floor in the selector would
      // drop it anyway once decay kicks in, but skipping here keeps the
      // candidate pool small and avoids fighting `Math.exp(NaN)`.
      if (freshest === null) continue;

      const daysSince = Math.max(
        0,
        Math.floor((now.getTime() - freshest) / (1000 * 60 * 60 * 24))
      );

      // baseSignal models *recent engagement*, not historical depth. An
      // earlier formulation used `playtimeForeverMinutes + lifetimeUnlocks
      // × 0.5`; that let a brief re-launch of a high-lifetime game (e.g.
      // 67h Silksong opened for 3 min) dominate over an active recent
      // playthrough (RE2 played for hours that week). Steam's own 2-week
      // playtime field + a 14d-filtered unlock count are precisely the
      // "what are you actively engaging with" signal we want.
      //
      // Side effect: games not touched in 14d will mostly fall below floor.
      // That's correct for a "Playing lately" recap — the bucket-based
      // eyebrow ("This season on", "Earlier this year") becomes rare and
      // fires only when a game has 8–14d-old freshest signal that still
      // carries recent unlocks. If we later want broader-freshness coverage,
      // it should be a separate chapter kind ("Greatest hits"-shaped), not a
      // tweak to subject scoring.
      const recentPlaytimeHours = (game.playtime2WeeksMinutes ?? 0) / 60;
      const recentUnlockCount = recentUnlockCountByAppid.get(game.appid) ?? 0;
      const baseSignal = recentPlaytimeHours * 1.0 + recentUnlockCount * 0.5;

      candidates.push({
        kind: "steam-subject",
        slug: `steam-${game.appid}`,
        appid: game.appid,
        name: game.name,
        baseSignal,
        daysSince,
      });
    }
    return candidates;
  }

  private async collectDormantFallback(now: Date): Promise<RecapChapterDescriptor[]> {
    // Only the unfiltered lastUnlock groupBy is needed here — dormant
    // ranking is by `freshest`, not by recent activity, so the 14d-window
    // count is irrelevant.
    const [ownedGames, lastUnlockRows] = await Promise.all([
      this.ownedGames.getOwnedGames(),
      this.prisma.steamPlayerUnlock.groupBy({
        by: ["appid"],
        _max: { unlockedAt: true },
      }),
    ]);

    const lastUnlockByAppid = new Map<number, Date | null>(
      lastUnlockRows.map((row) => [row.appid, row._max.unlockedAt ?? null])
    );

    const ranked: Array<{
      appid: number;
      name: string;
      lifetimeHours: number;
      freshest: number;
      daysSince: number;
    }> = [];

    for (const game of ownedGames.games) {
      if (RECAP_HIDDEN_APPIDS.has(game.appid)) continue;
      if (game.appType !== null && game.appType !== 0) continue;

      const lifetimeHours = game.playtimeForeverMinutes / 60;
      if (lifetimeHours < DORMANT_LIFETIME_FLOOR_HOURS) continue;

      const lastUnlockMs = lastUnlockByAppid.get(game.appid)?.getTime() ?? null;
      // Brief-launch floor: a non-zero but tiny 2w playtime (e.g. 3 minutes)
      // means the game was opened recently but not actually played. Treat the
      // `rtimeLastPlayedAt` signal as untrustworthy in this case and fall
      // through to the unlock signal for `freshest`. If the user launched it
      // for testing/checking, we don't want it crowding RE3/RE4 sessions
      // that *were* real play but happened weeks ago.
      const playtime2W = game.playtime2WeeksMinutes ?? 0;
      const brieflyLaunched = playtime2W > 0 && playtime2W < BRIEF_LAUNCH_2W_MINUTES;
      const lastPlayedMs =
        !brieflyLaunched && game.rtimeLastPlayedAt
          ? new Date(game.rtimeLastPlayedAt).getTime()
          : null;
      const freshest =
        lastUnlockMs !== null && lastPlayedMs !== null
          ? Math.max(lastUnlockMs, lastPlayedMs)
          : (lastUnlockMs ?? lastPlayedMs);
      if (freshest === null) continue;

      const daysSince = Math.max(
        0,
        Math.floor((now.getTime() - freshest) / (1000 * 60 * 60 * 24))
      );

      ranked.push({
        appid: game.appid,
        name: game.name,
        lifetimeHours,
        freshest,
        daysSince,
      });
    }

    ranked.sort((a, b) => b.freshest - a.freshest);

    return ranked
      .slice(0, DORMANT_CAP)
      .map(({ appid, name, lifetimeHours, daysSince }) => ({
        kind: "steam-subject" as const,
        slug: `steam-${appid}`,
        appid,
        name,
        // `score` in dormant mode is the magnitude shown (lifetime hours), not
        // the active-path's decayed engagement score. The web side displays
        // ageBucket-driven eyebrows, not the raw number.
        score: lifetimeHours,
        daysSince,
        ageBucket: ageBucketFromDaysSince(daysSince),
        framing: null,
      }));
  }
}
