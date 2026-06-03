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

/** Recency window for the ACHIEVEMENT_CLUSTER detector. A cluster's cap
 *  unlock must fall inside the last 30d for the moment to surface — same
 *  "this season" frame the LoL moment detectors use. The selector's
 *  recency decay sits on top, so older clusters within the window decay
 *  below the floor by ~35d. */
const CLUSTER_WINDOW_DAYS = 30;

/** Sliding window span (hours) the cluster detector walks per appid. ≥
 *  CLUSTER_MIN_UNLOCKS unlocks inside this span qualify. 24h is wide
 *  enough to capture a "binge day" (start morning, finish night) and
 *  narrow enough that "this is a real session run, not month-long
 *  trickle". */
const CLUSTER_WINDOW_HOURS = 24;

/** Minimum unlocks for a cluster to qualify. 5 is the editorial threshold:
 *  fewer reads as routine progress, more reads as "you really sat down
 *  with this". Matches the arc-note design. */
const CLUSTER_MIN_UNLOCKS = 5;

/** Maximum unlock names carried on the descriptor for the chapter's
 *  receipt strip. Bounded so the receipt doesn't crash a chapter when an
 *  owner unlocks 30 in a single sitting; the chapter shows "and N more"
 *  beyond this cap. */
const CLUSTER_NAME_RECEIPT_CAP = 5;

/** Per-unlock scaling for the cluster base signal. 5-unlock cluster lands
 *  at 20 raw → clears floor (5) at the 14d half-life (~10). 10-unlock
 *  cluster lands at 40 raw → strong signal at daysSince=0, still ~14 at
 *  the half-life. Cap at CLUSTER_UNLOCK_CAP so a 30-unlock binge doesn't
 *  dominate the chapter list over a fresh RANK_UP. */
const CLUSTER_SIGNAL_FACTOR = 4;
const CLUSTER_UNLOCK_CAP = 10;

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
    const [firstTime, clusters] = await Promise.all([
      this.detectFirstTimeGames(now),
      this.detectAchievementClusters(now),
    ]);
    return [...firstTime, ...clusters];
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
    // Track the EARLIEST post-firstSeenAt session per appid — its start
    // time becomes `firstPlayedAt` (the "when you first actually launched
    // it" half of the chapter's added-vs-played pair) and its duration
    // becomes `firstSessionMinutes` (the receipt's "first sit-down" beat).
    // Both are receipts the chapter renders verbatim; the detector pays
    // the iteration cost once.
    const firstSessionByAppid = new Map<number, { startedAt: Date; minutes: number }>();
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
      const earliest = firstSessionByAppid.get(session.appid);
      if (!earliest || session.startedAt < earliest.startedAt) {
        firstSessionByAppid.set(session.appid, { startedAt: session.startedAt, minutes });
      }
    }

    const candidates: RecapCandidate[] = [];
    for (const game of candidatePool) {
      const minutes = playMinutesByAppid.get(game.appid) ?? 0;
      if (minutes < FIRST_TIME_MIN_PLAY_MINUTES) continue;
      // The first-session record is guaranteed by construction if `minutes`
      // is non-zero (we only sum sessions that also update the record), but
      // we narrow defensively so the type stays honest under future refactors.
      const firstSession = firstSessionByAppid.get(game.appid);
      if (!firstSession) continue;

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
          firstSessionMinutes: Math.round(firstSession.minutes),
          addedAt: game.firstSeenAt.toISOString(),
          firstPlayedAt: firstSession.startedAt.toISOString(),
        },
      });
    }
    return candidates;
  }

  /**
   * Detect the owner's densest recent achievement cluster — ≥5 unlocks on
   * a single game inside a 24h window, capped within the last 30 days.
   *
   * Algorithm:
   *   1. Load all `SteamPlayerUnlock` rows since `now - 30d`, joined with
   *      the achievement schema for `displayName`. Group by appid.
   *   2. Per appid, walk a sliding 24h window over unlocks ordered by
   *      `unlockedAt` ascending. Track the window with the most unlocks;
   *      ties prefer the most recent cap (later wins).
   *   3. If that best window has ≥ CLUSTER_MIN_UNLOCKS unlocks AND the cap
   *      is inside the recency window, emit one candidate. (The recency
   *      filter pre-truncates the unlock pool; the cap-check guards
   *      against clusters whose head spans into older data.)
   *   4. Filter non-games (`appType !== 0/null`) + the curated hidden
   *      appid list — same convention as FIRST_TIME_GAME.
   *
   * Emits at most one candidate per qualifying appid; the selector caps
   * `steam-moment` total via the per-kind cap.
   */
  async detectAchievementClusters(now: Date): Promise<RecapCandidate[]> {
    const cutoff = new Date(now.getTime() - CLUSTER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // Joined query so we get achievement displayName + game name + appType
    // in one round-trip. Schema relations: SteamPlayerUnlock →
    // SteamGameAchievement (composite key, FK) → SteamOwnedGame (appid).
    // `enrichment` lookup separately because SteamGameEnrichment isn't
    // FK-related to SteamOwnedGame (it covers wishlist titles too).
    const unlocks = await this.prisma.steamPlayerUnlock.findMany({
      where: { unlockedAt: { gte: cutoff } },
      select: {
        appid: true,
        unlockedAt: true,
        achievement: {
          select: {
            displayName: true,
            game: { select: { name: true, removedAt: true } },
          },
        },
      },
      orderBy: { unlockedAt: "asc" },
    });

    if (unlocks.length === 0) return [];

    const appids = [...new Set(unlocks.map((u) => u.appid))];
    const enrichments = await this.prisma.steamGameEnrichment.findMany({
      where: { appid: { in: appids } },
      select: { appid: true, appType: true },
    });
    const appTypeByAppid = new Map(enrichments.map((e) => [e.appid, e.appType]));

    // Group unlocks by appid; appids that fail the non-game / hidden /
    // removed filter are dropped here so the sliding window doesn't waste
    // cycles on them.
    const groupedByAppid = new Map<
      number,
      Array<{
        unlockedAt: Date;
        displayName: string;
        gameName: string;
      }>
    >();
    for (const unlock of unlocks) {
      if (RECAP_HIDDEN_APPIDS.has(unlock.appid)) continue;
      const appType = appTypeByAppid.get(unlock.appid);
      if (appType !== undefined && appType !== null && appType !== 0) continue;
      if (unlock.achievement.game.removedAt !== null) continue;
      const list = groupedByAppid.get(unlock.appid) ?? [];
      list.push({
        unlockedAt: unlock.unlockedAt,
        displayName: unlock.achievement.displayName,
        gameName: unlock.achievement.game.name,
      });
      groupedByAppid.set(unlock.appid, list);
    }

    const candidates: RecapCandidate[] = [];
    for (const [appid, rows] of groupedByAppid) {
      if (rows.length < CLUSTER_MIN_UNLOCKS) continue;

      // Sliding-window pass. `rows` is already sorted ascending by
      // `unlockedAt` because the source query is. For each potential right-
      // edge `j`, advance left edge `i` while the span exceeds 24h. The
      // window `[i..j]` is the largest cluster ending at row j.
      const windowMs = CLUSTER_WINDOW_HOURS * 60 * 60 * 1000;
      let bestStart = -1;
      let bestEnd = -1;
      let i = 0;
      for (let j = 0; j < rows.length; j++) {
        const jRow = rows[j];
        if (!jRow) continue;
        while (i <= j) {
          const iRow = rows[i];
          if (!iRow) {
            i++;
            continue;
          }
          if (jRow.unlockedAt.getTime() - iRow.unlockedAt.getTime() <= windowMs) break;
          i++;
        }
        const size = j - i + 1;
        const bestSize = bestStart < 0 ? 0 : bestEnd - bestStart + 1;
        // Ties prefer the LATER cap — fresher clusters surface first when
        // multiple equal-sized windows exist in the data. Recency decay
        // already favours the latest anyway, but the explicit tiebreak
        // keeps the receipt aligned with the score.
        if (size > bestSize || (size === bestSize && j > bestEnd)) {
          bestStart = i;
          bestEnd = j;
        }
      }

      if (bestStart < 0 || bestEnd - bestStart + 1 < CLUSTER_MIN_UNLOCKS) continue;
      const clusterRows = rows.slice(bestStart, bestEnd + 1);
      const startRow = clusterRows[0];
      const endRow = clusterRows[clusterRows.length - 1];
      if (!startRow || !endRow) continue;
      // Cap must be inside the recency window — the pre-truncation at
      // `cutoff` already enforces this on the source rows, but the assert
      // keeps the contract honest under future changes.
      if (endRow.unlockedAt < cutoff) continue;

      const unlockCount = clusterRows.length;
      const spanMs = endRow.unlockedAt.getTime() - startRow.unlockedAt.getTime();
      const spanHours = Math.round((spanMs / (60 * 60 * 1000)) * 10) / 10;
      const daysSince = Math.max(
        0,
        Math.floor((now.getTime() - endRow.unlockedAt.getTime()) / (1000 * 60 * 60 * 24))
      );
      const baseSignal =
        Math.min(unlockCount, CLUSTER_UNLOCK_CAP) * CLUSTER_SIGNAL_FACTOR;
      const unlockNames = clusterRows
        .slice(0, CLUSTER_NAME_RECEIPT_CAP)
        .map((r) => r.displayName);

      candidates.push({
        kind: "steam-moment",
        slug: `steam-moment-cluster-${appid}`,
        momentType: "ACHIEVEMENT_CLUSTER",
        appid,
        name: startRow.gameName,
        baseSignal,
        daysSince,
        cluster: {
          unlockCount,
          spanHours,
          capUnlockedAt: endRow.unlockedAt.toISOString(),
          unlockNames,
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
