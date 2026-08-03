// The Portrait's identity half: what the owner's hours are actually made of,
// how that has shifted lately, and how much of the library those hours cover.
// Feeds cards 1, 2 and 6 of docs/working-notes/steam/player-portrait.md.
//
// Every aggregation runs over a cleaned cohort — `excludeBarelyTouched` for
// lifetime, `excludeBarelyPlayedInWindow` for the recency delta — per the
// "centralise domain invariants" convention. Nothing here calls Steam; the
// numbers come from the daily owned-games and playtime-snapshot pollers.

import { Injectable } from "@nestjs/common";
import type {
  CompletionSummary,
  GenreFingerprint,
  SteamPortrait,
  SteamPortraitAnti,
  SteamPortraitGameRef,
  SteamPortraitRecent,
} from "@vyoh/shared";
import {
  PORTRAIT_RECENT_WINDOW_DAYS,
  buildGenreFingerprint,
  excludeBarelyPlayedInWindow,
  excludeBarelyTouched,
  isSteamGameAppType,
  selectColdest,
  selectEngagementCohort,
  selectQuickestAbandons,
  selectSingleAchievement,
  summariseCompletion,
  summariseEngagement,
  summariseTasted,
} from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;

const EMPTY_FINGERPRINT: GenreFingerprint = {
  genres: [],
  distributedMinutes: 0,
  gamesCounted: 0,
  gamesWithoutGenre: 0,
};

const EMPTY_COMPLETION: CompletionSummary = {
  cohortCount: 0,
  finishedCount: 0,
  perfectCount: 0,
  medianCompletion: 0,
  finished: [],
};

const EMPTY_ANTI: SteamPortraitAnti = {
  tasted: {
    count: 0,
    totalMinutes: 0,
    medianMinutes: 0,
    quickest: [],
    fingerprint: EMPTY_FINGERPRINT,
  },
  singleAchievement: { games: [], withAnyUnlock: 0, withSchema: 0 },
  coldest: null,
};

type PortraitGame = {
  appid: number;
  name: string;
  playtimeForeverMinutes: number;
  /** Minutes accrued between the baseline and latest snapshots. */
  windowMinutes: number;
  launchDayCount: number;
  /** Steam's `rtime_last_played`; null when it has never been launched. */
  lastPlayed: Date | null;
  tags: string[];
  /** Achievements in this game's schema; zero when it has none. */
  total: number;
  unlocked: number;
};

/**
 * The snapshot date the recency deltas measure *from*. Ideally the last one on
 * or before the 90-day mark; when history is shorter than that, the oldest
 * snapshot we hold, so the window reports the span it can actually evidence
 * rather than claiming a quarter. Returns null when there is only one date —
 * a delta needs two observations.
 *
 * Picking from dates that exist (rather than computing a calendar date) is
 * what makes snapshot gaps harmless: every game owned at the time has a row on
 * a date the poller actually wrote, so a missing baseline row means the game
 * was not owned yet, not that the poller skipped a day.
 */
export function pickBaselineDate(
  ascendingDates: Date[],
  windowDays: number
): Date | null {
  const latest = ascendingDates.at(-1);
  const oldest = ascendingDates.at(0);
  if (latest === undefined || oldest === undefined || ascendingDates.length < 2)
    return null;

  const target = latest.getTime() - windowDays * DAY_MS;
  const onOrBeforeTarget = ascendingDates
    .filter((date) => date.getTime() <= target)
    .at(-1);
  const baseline = onOrBeforeTarget ?? oldest;
  return baseline.getTime() === latest.getTime() ? null : baseline;
}

@Injectable()
export class SteamPortraitService {
  constructor(private readonly prisma: PrismaService) {}

  async getPortrait(): Promise<SteamPortrait> {
    const dates = await this.prisma.steamPlaytimeSnapshot.findMany({
      select: { snapshotDate: true },
      distinct: ["snapshotDate"],
      orderBy: { snapshotDate: "asc" },
    });

    const latestDate = dates.at(-1)?.snapshotDate;
    if (latestDate === undefined) {
      return {
        lifetime: EMPTY_FINGERPRINT,
        recent: null,
        posture: {
          ownedCount: 0,
          meaningfulCount: 0,
          tastedCount: 0,
          ghostCount: 0,
          totalMinutes: 0,
          meaningfulMinutes: 0,
        },
        anti: EMPTY_ANTI,
        completion: EMPTY_COMPLETION,
        lastSyncedAt: null,
      };
    }

    const baselineDate = pickBaselineDate(
      dates.map((row) => row.snapshotDate),
      PORTRAIT_RECENT_WINDOW_DAYS
    );
    const games = await this.loadGames(latestDate, baselineDate);
    const cohort = excludeBarelyTouched(games);
    const summary = summariseEngagement(games);

    return {
      lifetime: buildGenreFingerprint(
        cohort.map((game) => fingerprintInput(game, game.playtimeForeverMinutes))
      ),
      recent: baselineDate === null ? null : buildRecent(games, baselineDate, latestDate),
      posture: {
        ownedCount: summary.owned,
        meaningfulCount: summary.meaningful,
        tastedCount: summary.tasted,
        ghostCount: summary.ghosts,
        totalMinutes: summary.totalMinutes,
        meaningfulMinutes: summary.meaningfulMinutes,
      },
      anti: buildAnti(games, cohort),
      // Deliberately over the whole library rather than the cleaned cohort:
      // the cohort floor is an hour and this one is ten, so filtering twice
      // would only ever remove games this filter already excludes.
      completion: summariseCompletion(games),
      lastSyncedAt: latestDate.toISOString(),
    };
  }

  /**
   * Currently-owned games of app type "game", each carrying lifetime minutes,
   * in-window minutes and resolved tag names. Wallpaper Engine and 3DMark are
   * excluded here rather than downstream — owning a benchmark says nothing
   * about what kind of player someone is, and its tags would say it loudly.
   */
  private async loadGames(
    latestDate: Date,
    baselineDate: Date | null
  ): Promise<PortraitGame[]> {
    const dates = baselineDate === null ? [latestDate] : [latestDate, baselineDate];

    const [owned, snapshots, enrichment, catalog, sessions, schemas, unlocks] =
      await Promise.all([
        this.prisma.steamOwnedGame.findMany({
          where: { removedAt: null },
          select: { appid: true, name: true, rtimeLastPlayed: true },
        }),
        this.prisma.steamPlaytimeSnapshot.findMany({
          where: { snapshotDate: { in: dates }, game: { removedAt: null } },
          select: { appid: true, snapshotDate: true, playtimeForeverMinutes: true },
        }),
        this.prisma.steamGameEnrichment.findMany({
          select: { appid: true, appType: true, tagIds: true },
        }),
        this.prisma.steamTag.findMany({ select: { id: true, name: true } }),
        this.prisma.steamPlaySession.findMany({
          select: { appid: true, startedAt: true },
        }),
        this.prisma.steamGameAchievement.groupBy({
          by: ["appid"],
          _count: { apiName: true },
        }),
        this.prisma.steamPlayerUnlock.groupBy({
          by: ["appid"],
          _count: { apiName: true },
        }),
      ]);

    const tagName = new Map(catalog.map((tag) => [tag.id, tag.name]));
    const enrichmentByAppid = new Map(enrichment.map((row) => [row.appid, row]));
    const latestMinutes = new Map<number, number>();
    const baselineMinutes = new Map<number, number>();
    for (const row of snapshots) {
      const target =
        row.snapshotDate.getTime() === latestDate.getTime()
          ? latestMinutes
          : baselineMinutes;
      target.set(row.appid, row.playtimeForeverMinutes);
    }

    const schemaSize = new Map(schemas.map((row) => [row.appid, row._count.apiName]));
    const unlockCount = new Map(unlocks.map((row) => [row.appid, row._count.apiName]));

    const launchDays = new Map<number, Set<string>>();
    for (const session of sessions) {
      const days = launchDays.get(session.appid) ?? new Set<string>();
      days.add(session.startedAt.toISOString().slice(0, 10));
      launchDays.set(session.appid, days);
    }

    return owned
      .filter((game) => isSteamGameAppType(enrichmentByAppid.get(game.appid)?.appType))
      .map((game) => {
        const minutes = latestMinutes.get(game.appid) ?? 0;
        // A game with no row on the baseline date was not owned when the
        // window opened, so everything it has accrued belongs to the window.
        const before = baselineMinutes.get(game.appid) ?? 0;
        const tags = (enrichmentByAppid.get(game.appid)?.tagIds ?? []).flatMap((id) => {
          const name = tagName.get(id);
          return name === undefined ? [] : [name];
        });

        return {
          appid: game.appid,
          name: game.name,
          playtimeForeverMinutes: minutes,
          windowMinutes: Math.max(0, minutes - before),
          launchDayCount: launchDays.get(game.appid)?.size ?? 0,
          lastPlayed: game.rtimeLastPlayed,
          tags,
          total: schemaSize.get(game.appid) ?? 0,
          unlocked: unlockCount.get(game.appid) ?? 0,
        };
      });
  }
}

function gameRef(game: PortraitGame): SteamPortraitGameRef {
  return { appid: game.appid, name: game.name, minutes: game.playtimeForeverMinutes };
}

// The weighting minutes differ per fingerprint (lifetime vs in-window), so the
// caller passes them; identity and tags always come off the game.
function fingerprintInput(
  game: PortraitGame,
  minutes: number
): { appid: number; name: string; minutes: number; tags: string[] } {
  return { appid: game.appid, name: game.name, minutes, tags: game.tags };
}

/**
 * The Anti-Portrait's three claims. `games` is the whole library and `cohort`
 * is the meaningful slice of it — both are needed, because the tasted cards
 * read what the cohort filter threw away while the cold streak reads what it
 * kept.
 */
function buildAnti(games: PortraitGame[], cohort: PortraitGame[]): SteamPortraitAnti {
  const tasted = selectEngagementCohort(games, "tasted");
  const withSchema = games.filter((game) => game.total > 0);
  const coldest = selectColdest(cohort);

  return {
    tasted: {
      ...summariseTasted(tasted),
      quickest: selectQuickestAbandons(tasted).map(gameRef),
      // Weighted by lifetime minutes like every fingerprint, which inside a
      // cohort capped at 59 minutes is close to unweighted. The card reads
      // `gameCount` for exactly that reason.
      fingerprint: buildGenreFingerprint(
        tasted.map((game) => fingerprintInput(game, game.playtimeForeverMinutes))
      ),
    },
    singleAchievement: {
      games: selectSingleAchievement(withSchema)
        .sort((a, b) => b.playtimeForeverMinutes - a.playtimeForeverMinutes)
        .map(gameRef),
      withAnyUnlock: withSchema.filter((game) => game.unlocked > 0).length,
      withSchema: withSchema.length,
    },
    coldest:
      coldest?.lastPlayed == null
        ? null
        : { ...gameRef(coldest), lastPlayed: coldest.lastPlayed.toISOString() },
  };
}

function buildRecent(
  games: PortraitGame[],
  baselineDate: Date,
  latestDate: Date
): SteamPortraitRecent {
  const recent = excludeBarelyPlayedInWindow(games);
  return {
    window: {
      days: Math.round((latestDate.getTime() - baselineDate.getTime()) / DAY_MS),
      since: baselineDate.toISOString(),
      until: latestDate.toISOString(),
    },
    // Weighted by in-window minutes, not lifetime — otherwise a 400-hour game
    // played for an hour last week outranks the thing actually being played.
    fingerprint: buildGenreFingerprint(
      recent.map((game) => fingerprintInput(game, game.windowMinutes))
    ),
  };
}
