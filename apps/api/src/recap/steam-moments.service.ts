import { Injectable } from "@nestjs/common";
import type { RecapCandidate } from "@vyoh/shared";

import { PrismaService } from "../prisma/prisma.service";
import { RECAP_HIDDEN_APPIDS } from "./recap-curation";

/** Recency window for the FIRST_TIME_GAME detector. A new addition to the
 *  library that the owner has actually started playing within the last 30d
 *  qualifies — same "this season" frame the LoL moment detectors use. The
 *  selector's recency decay sits on top, so older first-times inside the
 *  window naturally score lower. */
const FIRST_TIME_WINDOW_DAYS = 30;

/** Minimum accumulated play minutes since the game was added before a
 *  candidate qualifies. Below this, a `firstSeenAt`-within-window row reads
 *  as "added to library, opened once for 3 minutes to check" — not a
 *  first-play moment. Mirrors the brief-launch floor used by the dormant
 *  top-up and Steam's own "3m" vs session-sized labels. */
const FIRST_TIME_MIN_PLAY_MINUTES = 30;

/** Threshold above which a shared `firstSeenAt` day is treated as a
 *  bootstrap event (the owned-games sync's first run, when every owned
 *  game's `firstSeenAt` defaults to `now()`). Real owner behaviour rarely
 *  yields ≥4 brand-new library additions on a single day; the bootstrap
 *  day routinely yields dozens. Bootstrap-day rows are excluded from
 *  FIRST_TIME_GAME detection — they're not first-time events, they're
 *  "this is when vyoh first saw the library". */
const BOOTSTRAP_DAY_THRESHOLD = 4;

/** Per-minute scaling for the FIRST_TIME_GAME base signal. With the
 *  selector's 14-day half-life and a 5-point floor, a 2-hour first session
 *  (120 min) at daysSince=0 lands score=8 — comfortably above floor. A 30-
 *  minute first session at daysSince=0 lands score=2 (below floor) — which
 *  is the right answer because the MIN_PLAY_MINUTES gate already accepted
 *  the row; this divisor decides editorial weight, not pass/fail. A 6-hour
 *  session at daysSince=7 lands score≈12.7 — first-time moments meaningfully
 *  outpace dormant subjects without crowding RANK_UP-class headlines. */
const FIRST_TIME_SIGNAL_DIVISOR = 15;

/**
 * Detectors that emit `steam-moment` candidates for the landing-page recap
 * stream. Shape mirrors `LolMomentsService` so the controller assembly and
 * `selectChapters` selector treat both feed sources identically. Produces
 * at most one candidate per momentType per call — multiple recent first-
 * times would crowd the chapter list with near-duplicates.
 *
 * R-7f scope: FIRST_TIME_GAME only. R-7g lands ACHIEVEMENT_CLUSTER alongside.
 */
@Injectable()
export class SteamMomentsService {
  constructor(private readonly prisma: PrismaService) {}

  async detectAll(now: Date = new Date()): Promise<RecapCandidate[]> {
    return this.detectFirstTimeGames(now);
  }

  /**
   * Detect the owner's most recent "first time playing" moment — a game
   * added to the library inside the recency window that has accumulated
   * meaningful play minutes since.
   *
   * Algorithm:
   *   1. Load owned games with `firstSeenAt >= cutoff` and the bootstrap
   *      day excluded. Filter non-games (`appType !== 0/null`) and the
   *      curated hidden-appid list.
   *   2. For each eligible appid, sum `SteamPlaySession` duration starting
   *      at-or-after `firstSeenAt`. Require ≥ FIRST_TIME_MIN_PLAY_MINUTES
   *      so a click-and-quit launch doesn't surface.
   *   3. Score each surviving candidate by play minutes / divisor. Emit
   *      all surviving candidates — `selectChapters` caps per-kind, so
   *      cap policy lives in the selector, not here.
   */
  async detectFirstTimeGames(now: Date): Promise<RecapCandidate[]> {
    const cutoff = new Date(now.getTime() - FIRST_TIME_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // Bootstrap-day guard. The owned-games sync stamps every previously-
    // unseen appid with `firstSeenAt = now()` on its first run, which
    // would otherwise flood the candidate pool with the entire library on
    // day one of vyoh tracking. Detect the bootstrap by grouping by
    // calendar day of `firstSeenAt` and flagging any day above the
    // threshold. Bootstrap days are excluded from FIRST_TIME_GAME — those
    // games aren't editorial first-times, they're a tracking artefact.
    const bootstrapDays = await this.findBootstrapDays();

    const eligibleGames = await this.prisma.steamOwnedGame.findMany({
      where: {
        firstSeenAt: { gte: cutoff },
        removedAt: null,
      },
      select: {
        appid: true,
        name: true,
        firstSeenAt: true,
      },
    });

    if (eligibleGames.length === 0) return [];

    // Enrichment for appType — non-games (Wallpaper Engine, 3DMark, …)
    // share the library filter rule with `recap-subjects.service.ts`.
    const enrichments = await this.prisma.steamGameEnrichment.findMany({
      where: { appid: { in: eligibleGames.map((g) => g.appid) } },
      select: { appid: true, appType: true },
    });
    const appTypeByAppid = new Map(enrichments.map((e) => [e.appid, e.appType]));

    const candidatePool = eligibleGames.filter((game) => {
      if (RECAP_HIDDEN_APPIDS.has(game.appid)) return false;
      const appType = appTypeByAppid.get(game.appid);
      if (appType !== undefined && appType !== null && appType !== 0) return false;
      const firstSeenDay = startOfUtcDay(game.firstSeenAt).getTime();
      if (bootstrapDays.has(firstSeenDay)) return false;
      return true;
    });

    if (candidatePool.length === 0) return [];

    // Sum in-window play minutes per appid. Sessions before `firstSeenAt`
    // (shouldn't happen by construction but stays correct under data
    // mutation) and sessions without `endedAt` are excluded — the latter
    // are mid-session rows that finalise when the session ends.
    const sessions = await this.prisma.steamPlaySession.findMany({
      where: {
        appid: { in: candidatePool.map((g) => g.appid) },
        endedAt: { not: null },
      },
      select: {
        appid: true,
        startedAt: true,
        endedAt: true,
      },
    });

    const playMinutesByAppid = new Map<number, number>();
    const sessionCountByAppid = new Map<number, number>();
    const firstSeenByAppid = new Map(candidatePool.map((g) => [g.appid, g.firstSeenAt]));
    for (const session of sessions) {
      if (!session.endedAt) continue;
      const firstSeen = firstSeenByAppid.get(session.appid);
      if (!firstSeen || session.startedAt < firstSeen) continue;
      const minutes = (session.endedAt.getTime() - session.startedAt.getTime()) / 60000;
      playMinutesByAppid.set(
        session.appid,
        (playMinutesByAppid.get(session.appid) ?? 0) + minutes
      );
      sessionCountByAppid.set(
        session.appid,
        (sessionCountByAppid.get(session.appid) ?? 0) + 1
      );
    }

    const candidates: RecapCandidate[] = [];
    for (const game of candidatePool) {
      const minutes = playMinutesByAppid.get(game.appid) ?? 0;
      if (minutes < FIRST_TIME_MIN_PLAY_MINUTES) continue;

      const daysSince = Math.max(
        0,
        Math.floor((now.getTime() - game.firstSeenAt.getTime()) / (1000 * 60 * 60 * 24))
      );
      const baseSignal = minutes / FIRST_TIME_SIGNAL_DIVISOR;

      candidates.push({
        kind: "steam-moment",
        slug: `steam-moment-first-${game.appid}`,
        momentType: "FIRST_TIME_GAME",
        appid: game.appid,
        name: game.name,
        baseSignal,
        daysSince,
        firstTime: {
          windowPlayMinutes: Math.round(minutes),
          sessionCount: sessionCountByAppid.get(game.appid) ?? 0,
        },
      });
    }
    return candidates;
  }

  /**
   * Collect the set of UTC-day-bucketed `firstSeenAt` timestamps that
   * contain ≥ `BOOTSTRAP_DAY_THRESHOLD` rows. Days returned here are
   * excluded from FIRST_TIME_GAME detection — they represent the owned-
   * games sync's first observation of pre-existing games rather than
   * editorial first-time events. Returns timestamps (ms-since-epoch of
   * the day-bucket) as map keys for O(1) lookup downstream.
   */
  private async findBootstrapDays(): Promise<Set<number>> {
    const rows = await this.prisma.steamOwnedGame.findMany({
      select: { firstSeenAt: true },
    });
    const countByDay = new Map<number, number>();
    for (const row of rows) {
      const dayMs = startOfUtcDay(row.firstSeenAt).getTime();
      countByDay.set(dayMs, (countByDay.get(dayMs) ?? 0) + 1);
    }
    const bootstrapDays = new Set<number>();
    for (const [dayMs, count] of countByDay) {
      if (count >= BOOTSTRAP_DAY_THRESHOLD) bootstrapDays.add(dayMs);
    }
    return bootstrapDays;
  }
}

function startOfUtcDay(d: Date): Date {
  const result = new Date(d);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}
