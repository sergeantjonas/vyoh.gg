import { Injectable } from "@nestjs/common";
import type {
  RecapCandidate,
  RecapChapterDescriptor,
  SteamCurationSets,
} from "@vyoh/shared";
import {
  ageBucketFromDaysSince,
  excludeUnfeaturedGames,
  recapScore,
  selectChapters,
} from "@vyoh/shared";

import { PrismaService } from "../prisma/prisma.service";
import { SteamGameCurationService } from "../steam/game-curation.service";
import { SteamOwnedGamesService } from "../steam/owned-games.service";
import { LolMomentsService } from "./lol-moments.service";
import { SteamMomentsService } from "./steam-moments.service";

/** Lifetime-hours threshold for the dormant top-up. A game must carry
 *  meaningful historical engagement to surface in the no-recent-activity
 *  branch — a one-time launcher browse or 30-minute demo shouldn't qualify.
 *  5h is a casual-completion floor for most games. Tunable. */
const DORMANT_LIFETIME_FLOOR_HOURS = 5;

/** Hard cap on Steam subjects in the rendered list, ACROSS the active +
 *  dormant top-up streams. Mirrors `selectChapters`' `steamSubjectCap`
 *  default (kept as a local constant rather than imported because that
 *  default applies to the active branch only — dormant top-up consumes
 *  whatever slack remains under the same total ceiling). */
const STEAM_SUBJECT_HARD_CAP = 5;

/** Below this 2w-playtime threshold, a recent `rtimeLastPlayedAt` is treated
 *  as a brief launch (e.g. opened the app to check something) rather than
 *  real engagement, and the dormant ranker falls back to the unlock signal
 *  for `freshest`. Without this, a 3-minute Silksong launch outranks an
 *  RE3 playthrough from 30 days ago in the dormant branch — the freshness
 *  signal is technically truer for Silksong but doesn't represent real
 *  engagement. 30 minutes is the rough threshold below which Steam will
 *  show a duration like "3m" rather than a session-sized number. */
const BRIEF_LAUNCH_2W_MINUTES = 30;

/** How long a game's achievement progress must have been frozen — while
 *  achievements were still there to earn — before a launch stops being read as
 *  a return to it. The owner's 36h in Cyberpunk 2077 are largely in-game
 *  benchmark runs for hardware stress-testing: 46 of its 57 achievements are
 *  unclaimed, none has moved since 2025-06-10, and it is still launched most
 *  months. That shape is what separates time-at-the-executable from play, and
 *  it needs the "achievements remain" half to mean anything — Silksong shows
 *  the identical 8-month unlock gap at 100% complete, having simply run out of
 *  things to earn. A year, because this library's headroom gaps cluster under
 *  136 days (a run finished, then poked again a season later) with nothing
 *  between there and Cyberpunk's 447. */
const STALE_PROGRESS_DAYS = 365;

/** The brief-launch floor, raised for a game whose progress is stale. Two
 *  hours is the shape of an actual return to a game abandoned a year ago; below
 *  it, with achievements still unclaimed and untouched for that long, the launch
 *  is not evidence the game went anywhere. Raising the ordinary floor to match
 *  is not an option — it would suppress the real short sessions that floor
 *  exists to protect.
 *
 *  This is a backstop, and it fires on nothing in the library today: both
 *  observed Cyberpunk benchmark launches (14m and 25m) are already under the
 *  ordinary floor. It exists because a stress-testing loop left running is not
 *  bounded by 30 minutes, and the completion gate that used to be the only
 *  backstop for that case cost eight real playthroughs to keep.
 *
 *  Known false negative: a genuine 90-minute revisit that earns nothing keeps
 *  its old date. It re-dates itself the moment it earns one achievement, and
 *  the failure direction is a game staying where it was rather than a benchmark
 *  loop claiming the top of the lane.
 *  Full analysis: docs/working-notes/cross-cutting/dormant-chapter-ranking.md */
const STALE_RETURN_2W_MINUTES = 120;

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
    private readonly lolMoments: LolMomentsService,
    private readonly steamMoments: SteamMomentsService,
    private readonly curation: SteamGameCurationService
  ) {}

  /**
   * Chapter selection reads the public curation regardless of who is asking,
   * and unlike the Steam routes it takes no `isOwner`. A chapter names its
   * subject in 60pt type, so hiding a game rules it out as chapter material for
   * the owner too — the owner still finds it in their library, which is where
   * "the owner still sees hidden games" was meant to apply.
   */
  private curationForChapters(): Promise<SteamCurationSets> {
    return this.curation.getCuration();
  }

  async getChapters(now: Date = new Date()): Promise<RecapChapterDescriptor[]> {
    // Steam-subject + LoL-moment + Steam-moment candidates run in parallel —
    // they hit different tables (Steam playtime snapshots, LoL match
    // history, Steam owned-games + sessions) and have no inter-dependency.
    // `selectChapters` handles per-kind capping + cross-kind ordering, so
    // merging the lists raw before the selector is sufficient.
    const curation = await this.curationForChapters();
    const [steamCandidates, lolMomentCandidates, steamMomentCandidates] =
      await Promise.all([
        this.collectSteamSubjectCandidates(now),
        this.lolMoments.detectAll(now),
        this.steamMoments.detectAll(now, curation),
      ]);

    // Two moment types can fire on one appid: a launch title the owner binged
    // produces an ACHIEVEMENT_CLUSTER and a LAUNCH_RARITY_DRIFT off the same
    // week of play, and two beats about one game read as a bug whichever order
    // they land in. Both scales top out at 40 against the same decay and the
    // same floor, so the score is a fair comparison here in a way it would not
    // be if either ceiling moved — see the factor's own comment in
    // `launch-drift.ts`. Ties go to the earlier detector in `detectAll`, which
    // keeps the result deterministic. Runs before the moment ↔ subject dedup
    // below so that only ever sees one moment per appid, and pre-selection so
    // the cap isn't burned on a row that's about to be dropped.
    const bestMomentByAppid = new Map<number, RecapCandidate>();
    for (const c of steamMomentCandidates) {
      if (c.kind !== "steam-moment") continue;
      // FIRST_TIME_GAME is deliberately out of scope. Its baseSignal is
      // play-minutes / 15 — uncapped, on no shared ceiling, and systematically
      // under-observed because the poller only ever sees part of the play — so
      // scoring it against a cluster would drop the first-time story on
      // precisely the game where it is the story. It would also strand the
      // moment ↔ subject suppression below, which needs the first-time
      // candidate to still exist to know it should drop the subject.
      if (c.momentType === "FIRST_TIME_GAME") continue;
      const held = bestMomentByAppid.get(c.appid);
      if (
        !held ||
        recapScore(c.baseSignal, c.daysSince) >
          recapScore(held.baseSignal, held.daysSince)
      ) {
        bestMomentByAppid.set(c.appid, c);
      }
    }
    const dedupedMomentCandidates = steamMomentCandidates.filter(
      (c) =>
        c.kind !== "steam-moment" ||
        c.momentType === "FIRST_TIME_GAME" ||
        bestMomentByAppid.get(c.appid) === c
    );

    const allSteamMomentAppids = new Set(
      dedupedMomentCandidates
        .filter((c) => c.kind === "steam-moment")
        .map((c) => (c.kind === "steam-moment" ? c.appid : -1))
    );
    // Steam-moment ↔ steam-subject dedup, momentType-scoped. FIRST_TIME_GAME
    // and "Playing lately" overlap by construction — a freshly-added game
    // with hours of recent play fires both, and the two are genuinely
    // exclusive framings of the same appid, so one of them has to lose.
    // ACHIEVEMENT_CLUSTER and LAUNCH_RARITY_DRIFT are different: a binge
    // day on a recently-played game, or a rarity curve that moved under
    // the owner while they played it, are COMPLEMENTARY facts ("you also
    // unlocked 5 in one sitting", "and you were early") — not substitute
    // framings. Stripping the subject in that case sends the
    // prominent chapter slot to a less-played game while the actually-active
    // game only appears as one of up to 3 small Highlights tiles — which
    // reads as a bug to anyone looking at the page. So the dedup is narrowed
    // to FIRST_TIME_GAME only.
    //
    // Which side loses is a question about the game, not about the kind.
    // Hardcoding "the moment wins" is right for a game opened once for forty
    // minutes, where "first time loading X" is the whole story — and wrong
    // for one that pulled 9h across its first two days, where a Highlights
    // tile buries the strongest Steam signal on the page behind five dormant
    // subjects. Both sides carry a comparable score (same `recapScore`
    // decay, calibrated against the same floor), so let the score decide and
    // drop the loser. Runs PRE-selection so neither cap gets burned on a row
    // that's about to be dropped.
    const firstTimeByAppid = new Map<number, RecapCandidate>();
    for (const c of dedupedMomentCandidates) {
      if (c.kind === "steam-moment" && c.momentType === "FIRST_TIME_GAME") {
        firstTimeByAppid.set(c.appid, c);
      }
    }
    const outscoredMomentAppids = new Set<number>();
    const filteredSteamCandidates = steamCandidates.filter((c) => {
      if (c.kind !== "steam-subject") return true;
      const moment = firstTimeByAppid.get(c.appid);
      if (!moment) return true;
      if (
        recapScore(c.baseSignal, c.daysSince) <=
        recapScore(moment.baseSignal, moment.daysSince)
      ) {
        return false;
      }
      outscoredMomentAppids.add(c.appid);
      return true;
    });
    const filteredSteamMomentCandidates = dedupedMomentCandidates.filter(
      (c) =>
        c.kind !== "steam-moment" ||
        c.momentType !== "FIRST_TIME_GAME" ||
        !outscoredMomentAppids.has(c.appid)
    );

    const active = selectChapters([
      ...filteredSteamCandidates,
      ...lolMomentCandidates,
      ...filteredSteamMomentCandidates,
    ]);

    // Dormant top-up. The active branch surfaces "Playing lately" games via
    // the 14d-playtime + 14d-unlocks `baseSignal`, which means anything not
    // touched in two weeks gets `baseSignal: 0` and never qualifies — even
    // with hundreds of lifetime hours. Without a top-up the Steam block
    // collapses to whatever's currently fresh, dry-spelling the page during
    // life breaks. We fill remaining Steam slots from lifetime-ranked dormant
    // candidates, framed as "Earlier this year on …" via the daysSince
    // bucket eyebrows on the web side — same kind, different editorial
    // register. Dormant rows sit AFTER active rows inside the Steam block so
    // the reader sees the fresh-engagement story first.
    const activeSteamSubjectAppids = new Set(
      active.filter((c) => c.kind === "steam-subject").map((c) => c.appid)
    );
    // Dormant top-up exclusion uses the FULL steam-moment set (every
    // momentType), not just FIRST_TIME_GAME. A game with a recent
    // ACHIEVEMENT_CLUSTER or LAUNCH_RARITY_DRIFT has very recent activity by
    // definition, so it should never reappear lower down as a dormant
    // "Earlier this year on…" row — that framing fights the moment's
    // "this week" register.
    const excludeAppids = new Set([...activeSteamSubjectAppids, ...allSteamMomentAppids]);
    const steamSlack = STEAM_SUBJECT_HARD_CAP - activeSteamSubjectAppids.size;
    const dormant =
      steamSlack > 0
        ? await this.collectDormantTopUp(now, steamSlack, excludeAppids)
        : [];

    // Recompose with the platform-clustered ordering:
    //   lol-moment → steam-subject (active first, then dormant) → steam-moment.
    // `selectChapters` already produced the kinds in that order; we just
    // splice the dormant chapters in trailing the active steam-subjects.
    const lolMoments = active.filter((c) => c.kind === "lol-moment");
    const steamSubjects = active.filter((c) => c.kind === "steam-subject");
    const steamMoments = active.filter((c) => c.kind === "steam-moment");
    return [...lolMoments, ...steamSubjects, ...dormant, ...steamMoments];
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

    const curation = await this.curationForChapters();
    const [ownedGames, lastUnlockRows, recentUnlockRows] = await Promise.all([
      this.ownedGames.getOwnedGames(curation),
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
    for (const game of excludeUnfeaturedGames(ownedGames.games, curation)) {
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

  /**
   * Surface lifetime-ranked dormant games to top up the Steam-subject block
   * when the active branch hasn't filled the cap. Excludes any appids already
   * present in the active list so the same game can't appear twice with
   * conflicting "Playing lately" vs "Earlier this year" framing. Returns
   * `take` items max, ordered by `freshest` desc (most-recently-touched
   * dormant first), with `daysSince` set so the web side's bucket eyebrows
   * frame each row honestly.
   */
  private async collectDormantTopUp(
    now: Date,
    take: number,
    excludeAppids: Set<number>
  ): Promise<RecapChapterDescriptor[]> {
    // Only the unfiltered lastUnlock groupBy is needed here — dormant
    // ranking is by `freshest`, not by recent activity, so the 14d-window
    // count is irrelevant. The snapshot rows back the brief-launch floor
    // below; `gt: 0` keeps the read tiny (a couple hundred rows), since the
    // column is null for every game outside its own two-week window.
    const curation = await this.curationForChapters();
    // Every unlock timestamp rather than a `_max` groupBy, because the
    // brief-launch guard below needs the last unlock *before* a given moment,
    // not the last unlock overall — a per-appid boundary a groupBy cannot
    // express. Bounded by achievements-per-owned-game (~1.5k rows on a
    // 200-game library) and this endpoint is cached, so the trade is fine.
    // The same rows answer whether achievements remain, which needs the count.
    const [ownedGames, unlockRows, playtime2WRows, achievementMetaRows] =
      await Promise.all([
        this.ownedGames.getOwnedGames(curation),
        this.prisma.steamPlayerUnlock.findMany({
          select: { appid: true, unlockedAt: true },
        }),
        this.prisma.steamPlaytimeSnapshot.findMany({
          where: { playtime2WeeksMinutes: { gt: 0 } },
          select: { appid: true, snapshotDate: true, playtime2WeeksMinutes: true },
        }),
        this.prisma.steamGameAchievementMeta.findMany({
          select: { appid: true, achievementCount: true },
        }),
      ]);

    // Descending, so [0] is the latest and a `find` walks backwards in time.
    const unlocksByAppid = new Map<number, number[]>();
    for (const row of unlockRows) {
      const at = row.unlockedAt.getTime();
      const existing = unlocksByAppid.get(row.appid);
      if (existing) existing.push(at);
      else unlocksByAppid.set(row.appid, [at]);
    }
    for (const times of unlocksByAppid.values()) times.sort((a, b) => b - a);

    const achievementCountByAppid = new Map<number, number | null>(
      achievementMetaRows.map((row) => [row.appid, row.achievementCount])
    );

    const playtime2WHistory = new Map<number, Array<{ at: number; minutes: number }>>();
    for (const row of playtime2WRows) {
      if (row.playtime2WeeksMinutes === null) continue;
      const entry = {
        at: row.snapshotDate.getTime(),
        minutes: row.playtime2WeeksMinutes,
      };
      const existing = playtime2WHistory.get(row.appid);
      if (existing) existing.push(entry);
      else playtime2WHistory.set(row.appid, [entry]);
    }

    const ranked: Array<{
      appid: number;
      name: string;
      lifetimeHours: number;
      freshest: number;
      daysSince: number;
    }> = [];

    for (const game of excludeUnfeaturedGames(ownedGames.games, curation)) {
      if (game.appType !== null && game.appType !== 0) continue;
      // Exclude appids already represented in the active block — the same
      // game can't appear twice as both "Playing lately" and "Earlier this
      // year on".
      if (excludeAppids.has(game.appid)) continue;

      const lifetimeHours = game.playtimeForeverMinutes / 60;
      if (lifetimeHours < DORMANT_LIFETIME_FLOOR_HOURS) continue;

      const unlockTimes = unlocksByAppid.get(game.appid) ?? [];
      const achievementCount = achievementCountByAppid.get(game.appid) ?? null;
      // Is there anything left to earn? A `null`/0 schema and a completed one
      // both answer no, for opposite reasons that don't matter here: plenty of
      // real playthroughs (Witcher 1, Fallout 3 GOTY) predate achievements
      // entirely, and a 100% game has nothing to show for another session
      // either. Both keep the ordinary floor below.
      const achievementsRemain =
        achievementCount !== null && unlockTimes.length < achievementCount;

      const lastPlayedAtMs = game.rtimeLastPlayedAt
        ? new Date(game.rtimeLastPlayedAt).getTime()
        : null;
      // Brief-launch floor: a non-zero but tiny 2w playtime (e.g. 3 minutes)
      // means the game was opened recently but not actually played. Treat the
      // `rtimeLastPlayedAt` signal as untrustworthy in this case and fall
      // through to the unlock signal for `freshest`. If the user launched it
      // for testing/checking, we don't want it crowding RE3/RE4 sessions
      // that *were* real play but happened weeks ago.
      //
      // Read that evidence out of the snapshot history rather than off the
      // live field. Steam omits `playtime_2weeks` entirely once the window
      // rolls past the session, so it arrives as null — and null loses to
      // the `> 0` test below, which silently exempts precisely the launches
      // this floor exists to catch. Every dormant game is null by then, so
      // the guard could only ever fire in the ~14 days before a game became
      // dormant. The history keeps a reading taken while the window still
      // covered the session, so a 10-minute launch stays a 10-minute launch
      // however long ago it happened. Snapshots dated on or before the
      // session are excluded: `snapshotDate` is a date-only column, so a
      // same-day row sits at midnight and describes the state *before* the
      // launch. Nothing is lost by skipping it — the window keeps reporting
      // the session for another two weeks of rows.
      const observed2W = (playtime2WHistory.get(game.appid) ?? []).reduce(
        (max, entry) =>
          lastPlayedAtMs !== null && entry.at >= lastPlayedAtMs
            ? Math.max(max, entry.minutes)
            : max,
        0
      );
      const playtime2W = Math.max(game.playtime2WeeksMinutes ?? 0, observed2W);
      // The last unlock predating the session under test. Both the staleness
      // measure and the fallback date want the same value: the last time this
      // game demonstrably went somewhere before it was opened again.
      const priorUnlockMs =
        lastPlayedAtMs !== null
          ? (unlockTimes.find((at) => at < lastPlayedAtMs) ?? null)
          : null;
      // Progress frozen for a year while achievements were still there to earn:
      // the benchmark signature, and the case a flat completion gate could only
      // approximate — it read Cyberpunk's 19% as abandonment, and charged eight
      // real playthroughs with grindy achievement sets (21 of Isaac's *641*)
      // the same verdict. A game that has never earned an achievement counts as
      // stale too — nothing has ever moved in it — and costs nothing today,
      // since the floor applies only to sessions a snapshot observed and the
      // library's never-earning games (DayZ, Amnesia) predate coverage. Should
      // one be opened briefly now, it drops out of the lane rather than
      // re-dating, exactly as the 30-minute floor has always treated a game
      // with no unlock to fall back to.
      const progressStale =
        achievementsRemain &&
        lastPlayedAtMs !== null &&
        (priorUnlockMs === null ||
          lastPlayedAtMs - priorUnlockMs > STALE_PROGRESS_DAYS * 24 * 60 * 60 * 1000);
      const sessionFloor = progressStale
        ? STALE_RETURN_2W_MINUTES
        : BRIEF_LAUNCH_2W_MINUTES;
      const insubstantialLaunch = playtime2W > 0 && playtime2W < sessionFloor;
      const lastPlayedMs = insubstantialLaunch ? null : lastPlayedAtMs;
      // The unlock half has to obey the same floor, or the guard above is
      // decorative: `freshest` takes the later of the two, so a single
      // achievement popped during a ten-minute launch carries today's date
      // straight past a nulled `lastPlayedMs` and re-tops the lane.
      const lastUnlockMs =
        insubstantialLaunch && lastPlayedAtMs !== null
          ? priorUnlockMs
          : (unlockTimes[0] ?? null);
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

    return ranked.slice(0, take).map(({ appid, name, lifetimeHours, daysSince }) => ({
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
