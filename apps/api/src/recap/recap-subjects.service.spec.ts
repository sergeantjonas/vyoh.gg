import type {
  RecapCandidate,
  SteamCurationSets,
  SteamOwnedGame,
  SteamOwnedGames,
} from "@vyoh/shared";
import { NO_CURATION } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import type { SteamGameCurationService } from "../steam/game-curation.service";

import type { PrismaService } from "../prisma/prisma.service";
import type { SteamOwnedGamesService } from "../steam/owned-games.service";
import type { LolMomentsService } from "./lol-moments.service";
import { RecapSubjectsService } from "./recap-subjects.service";
import type { SteamMomentsService } from "./steam-moments.service";

const NOW = new Date("2026-06-02T12:00:00Z");

function makeOwnedGame(overrides: Partial<SteamOwnedGame> = {}): SteamOwnedGame {
  return {
    appid: 1,
    name: "Test Game",
    playtimeForeverMinutes: 600,
    playtime2WeeksMinutes: 60,
    assetUrlFormat: null,
    assetTimestamp: null,
    libraryCapsulePath: null,
    libraryCapsule2xPath: null,
    libraryHeroPath: null,
    libraryHero2xPath: null,
    headerPath: null,
    heroCapsulePath: null,
    logoPath: null,
    appType: 0,
    tagIds: [],
    rtimeLastPlayedAt: "2026-06-02T00:00:00Z",
    shortDescription: null,
    steamDeckCompat: null,
    platformWindows: null,
    platformMac: null,
    platformLinux: null,
    platformVr: null,
    reviewSummary: null,
    gameRating: null,
    publisherNames: [],
    developerNames: [],
    franchiseNames: [],
    subjectXPercent: null,
    subjectYPercent: null,
    flipHero: false,
    dominantHex: null,
    microtrailerWebm: null,
    microtrailerMp4: null,
    microtrailerPoster: null,
    microtrailerName: null,
    trailers: null,
    recentPlaytimeMinutes: [],
    releaseDate: null,
    ...overrides,
  };
}

function makeOwnedGames(games: SteamOwnedGame[]): SteamOwnedGames {
  return { games, lastSyncedAt: NOW.toISOString() };
}

interface LastUnlockRow {
  appid: number;
  _max: { unlockedAt: Date | null };
}
interface RecentUnlockRow {
  appid: number;
  _count: { apiName: number };
}

interface Playtime2WRow {
  appid: number;
  snapshotDate: Date;
  playtime2WeeksMinutes: number | null;
}

interface UnlockRow {
  appid: number;
  unlockedAt: Date;
}

interface AchievementMetaRow {
  appid: number;
  achievementCount: number | null;
}

function makeService(
  games: SteamOwnedGame[],
  lastUnlockRows: LastUnlockRow[] = [],
  recentUnlockRows: RecentUnlockRow[] = [],
  playtime2WRows: Playtime2WRow[] = [],
  curation: SteamCurationSets = NO_CURATION,
  // Only the dormant lane reads these. Defaulted so a test aimed at the active
  // lane keeps its behaviour without knowing about achievement progress.
  dormant: { unlocks?: UnlockRow[]; achievementMeta?: AchievementMetaRow[] } = {}
): RecapSubjectsService {
  const ownedGames = {
    getOwnedGames: vi.fn().mockResolvedValue(makeOwnedGames(games)),
  } as unknown as SteamOwnedGamesService;
  // The service makes two distinct groupBy calls — one unfiltered for
  // `_max(unlockedAt)` (drives `freshest` / daysSince), one filtered to the
  // 14d window for `_count(apiName)` (drives baseSignal). Branch on the
  // presence of `where` to route each call to its fixture.
  // The dormant lane reads every unlock timestamp rather than a `_max`, because
  // it needs the last unlock *before* a brief launch — a per-appid boundary a
  // groupBy can't express. Derived from the same fixture by default so a test
  // aimed at the active lane needs no extra setup.
  const unlockRows: UnlockRow[] =
    dormant.unlocks ??
    lastUnlockRows.flatMap((row) =>
      row._max.unlockedAt ? [{ appid: row.appid, unlockedAt: row._max.unlockedAt }] : []
    );
  const prisma = {
    steamPlayerUnlock: {
      groupBy: vi
        .fn()
        .mockImplementation((args: { where?: unknown }) =>
          Promise.resolve(args.where ? recentUnlockRows : lastUnlockRows)
        ),
      findMany: vi.fn().mockResolvedValue(unlockRows),
    },
    steamPlaytimeSnapshot: {
      findMany: vi.fn().mockResolvedValue(playtime2WRows),
    },
    steamGameAchievementMeta: {
      findMany: vi.fn().mockResolvedValue(dormant.achievementMeta ?? []),
    },
  } as unknown as PrismaService;
  // LoL + Steam moment services default to empty so the existing steam-
  // subject specs stay focused — the cross-kind merge is covered by the
  // dedicated test below.
  const lolMoments = {
    detectAll: vi.fn().mockResolvedValue([]),
  } as unknown as LolMomentsService;
  const steamMoments = {
    detectAll: vi.fn().mockResolvedValue([]),
  } as unknown as SteamMomentsService;
  return new RecapSubjectsService(ownedGames, prisma, lolMoments, steamMoments, {
    getCuration: vi.fn().mockResolvedValue(curation),
  } as unknown as SteamGameCurationService);
}

/**
 * Prisma stub for the direct-construction specs below, which exercise the
 * cross-kind moment merges rather than the Steam queries — every read the
 * service makes answers empty. Shared so a new query in the service is one
 * edit here rather than five identical ones.
 */
function emptyPrisma(): PrismaService {
  return {
    steamPlayerUnlock: {
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    steamPlaytimeSnapshot: { findMany: vi.fn().mockResolvedValue([]) },
    steamGameAchievementMeta: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
}

// Chapter selection consults the overlay; an empty one keeps every existing
// expectation about which games become chapters intact.
const CURATION_STUB = {
  getCuration: vi.fn().mockResolvedValue(NO_CURATION),
} as unknown as SteamGameCurationService;

// A game the owner curated off `/`. Chapter selection must drop it on the
// `unfeatured` axis alone — it stays fully visible everywhere else, which is
// what separates this from hiding.
const UNFEATURED_APPID = 1091500;
const unfeaturing = (appid: number): SteamCurationSets => ({
  hidden: new Set(),
  unfeatured: new Set([appid]),
});

describe("RecapSubjectsService.getChapters", () => {
  it("emits a steam-subject descriptor for a game with recent playtime and unlocks", async () => {
    const service = makeService(
      [
        makeOwnedGame({
          appid: 42,
          name: "Recent Hit",
          playtime2WeeksMinutes: 60 * 10, // 10h recent → baseSignal contribution 10
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
      ],
      [{ appid: 42, _max: { unlockedAt: NOW } }],
      [{ appid: 42, _count: { apiName: 12 } }] // +6 baseSignal contribution
    );

    const chapters = await service.getChapters(NOW);
    expect(chapters).toHaveLength(1);
    const first = chapters[0];
    expect(first?.kind).toBe("steam-subject");
    if (first?.kind === "steam-subject") {
      expect(first.appid).toBe(42);
      expect(first.slug).toBe("steam-42");
      expect(first.daysSince).toBe(0);
      expect(first.ageBucket).toBe("current");
      // baseSignal = 10 + 12×0.5 = 16, no decay (days=0).
      expect(first.score).toBeCloseTo(16);
      expect(first.framing).toBeNull();
    }
  });

  it("drops a high-lifetime game with negligible recent engagement", async () => {
    // Regression: a brief re-launch of a high-lifetime game (67h Silksong
    // opened for 3 min) was outranking an active recent playthrough (15h of
    // RE2 the prior week) because baseSignal used lifetime playtime + lifetime
    // unlock count. Now baseSignal is recent-only — Silksong's 3m drops
    // below floor while RE2 lands as the active chapter.
    const service = makeService(
      [
        makeOwnedGame({
          appid: 42, // Silksong-shaped
          name: "Silksong",
          playtimeForeverMinutes: 60 * 67, // 67h lifetime
          playtime2WeeksMinutes: 3, // 3 minutes recent
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
        makeOwnedGame({
          appid: 99, // RE2-shaped
          name: "Resident Evil 2",
          playtimeForeverMinutes: 60 * 25,
          playtime2WeeksMinutes: 60 * 15, // 15h recent
          rtimeLastPlayedAt: new Date(
            NOW.getTime() - 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
        }),
      ],
      [],
      []
    );

    const chapters = await service.getChapters(NOW);
    // Silksong falls below RECAP_SCORE_FLOOR (3/60 ≈ 0.05); only RE2 survives.
    expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
      99,
    ]);
  });

  it("filters out unfeatured appids even when score would qualify", async () => {
    const service = makeService(
      [
        makeOwnedGame({
          appid: UNFEATURED_APPID,
          name: "Unfeatured",
          playtime2WeeksMinutes: 60 * 200,
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
        makeOwnedGame({
          appid: 99,
          name: "Visible",
          playtime2WeeksMinutes: 60 * 10,
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
      ],
      [],
      [],
      [],
      unfeaturing(UNFEATURED_APPID)
    );

    const chapters = await service.getChapters(NOW);
    expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
      99,
    ]);
  });

  // Guards the guard: the appid above is only dropped because the overlay says
  // so. Without that, its far higher playtime makes it the winning chapter —
  // so a lint-free but inert filter would fail here.
  it("keeps that same appid when nothing is unfeatured", async () => {
    const service = makeService(
      [
        makeOwnedGame({
          appid: UNFEATURED_APPID,
          name: "Unfeatured",
          playtime2WeeksMinutes: 60 * 200,
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
        makeOwnedGame({
          appid: 99,
          name: "Visible",
          playtime2WeeksMinutes: 60 * 10,
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
      ],
      []
    );

    const chapters = await service.getChapters(NOW);
    expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toContain(
      UNFEATURED_APPID
    );
  });

  it("filters out non-game appTypes (tools, utilities)", async () => {
    const service = makeService(
      [
        makeOwnedGame({
          appid: 431960, // Wallpaper Engine shape
          name: "Wallpaper Engine",
          appType: 6,
          playtime2WeeksMinutes: 60 * 500, // huge — would dominate without the filter
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
        makeOwnedGame({
          appid: 42,
          name: "Actual Game",
          appType: 0,
          playtime2WeeksMinutes: 60 * 20,
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
        makeOwnedGame({
          appid: 99,
          name: "Unenriched Game",
          appType: null,
          playtime2WeeksMinutes: 60 * 10,
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
      ],
      []
    );

    const chapters = await service.getChapters(NOW);
    expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
      42, 99,
    ]);
  });

  it("skips games with no recency signal at all", async () => {
    const service = makeService(
      [
        makeOwnedGame({
          appid: 1,
          playtimeForeverMinutes: 60 * 1000, // huge — but never launched, no unlocks
          rtimeLastPlayedAt: null,
        }),
      ],
      []
    );
    const chapters = await service.getChapters(NOW);
    expect(chapters).toEqual([]);
  });

  it("uses the freshest signal — last unlock can win over older last-played", async () => {
    // Steam's `rtimeLastPlayedAt` can lag the actual unlock stream — a
    // recent unlock proves the game was just launched even if last-played
    // hasn't refreshed. `playtime2WeeksMinutes` covers the same window as
    // the recent unlock count, so it's set consistently here.
    const service = makeService(
      [
        makeOwnedGame({
          appid: 1,
          playtime2WeeksMinutes: 60 * 5,
          rtimeLastPlayedAt: "2026-04-01T00:00:00Z", // ~62 days ago
        }),
      ],
      [{ appid: 1, _max: { unlockedAt: new Date("2026-06-01T00:00:00Z") } }],
      [{ appid: 1, _count: { apiName: 4 } }]
    );
    const chapters = await service.getChapters(NOW);
    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.ageBucket).toBe("current");
  });

  it("ranks higher-score candidates first and caps at five", async () => {
    const games = Array.from({ length: 7 }, (_, i) =>
      makeOwnedGame({
        appid: i + 1,
        name: `Game ${i + 1}`,
        playtime2WeeksMinutes: 60 * (50 - i * 6), // 50h, 44h, 38h, 32h, 26h, 20h, 14h
        rtimeLastPlayedAt: NOW.toISOString(),
      })
    );
    const service = makeService(games, []);
    const chapters = await service.getChapters(NOW);
    expect(chapters).toHaveLength(5);
    expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("drops candidates below the score floor", async () => {
    // appid 2: 1h recent (below floor), 60min lifetime (below the 5h dormant
    // floor too) → dropped by BOTH the active branch and the dormant top-up.
    const service = makeService(
      [
        makeOwnedGame({
          appid: 1,
          playtimeForeverMinutes: 60 * 20,
          playtime2WeeksMinutes: 60 * 20,
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
        makeOwnedGame({
          appid: 2,
          playtimeForeverMinutes: 60, // 1h lifetime — below dormant floor (5h)
          playtime2WeeksMinutes: 60, // 1h recent — below active floor
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
      ],
      []
    );
    const chapters = await service.getChapters(NOW);
    expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([1]);
  });

  describe("dormant top-up", () => {
    it("surfaces the most-recently-engaged games when no game clears the active floor", async () => {
      // Quiet period: zero 2w playtime across the library. The top-up fills
      // every slot from dormant lifetime ranking; without it the page would
      // collapse to the Ahri anchor.
      const service = makeService(
        [
          makeOwnedGame({
            appid: 1,
            name: "Older",
            playtimeForeverMinutes: 60 * 40,
            playtime2WeeksMinutes: 0,
            rtimeLastPlayedAt: new Date(
              NOW.getTime() - 45 * 24 * 60 * 60 * 1000
            ).toISOString(),
          }),
          makeOwnedGame({
            appid: 2,
            name: "Newer",
            playtimeForeverMinutes: 60 * 25,
            playtime2WeeksMinutes: 0,
            rtimeLastPlayedAt: new Date(
              NOW.getTime() - 20 * 24 * 60 * 60 * 1000
            ).toISOString(),
          }),
        ],
        [],
        []
      );

      const chapters = await service.getChapters(NOW);
      // Sorted by freshest desc — Newer (20d ago) before Older (45d ago).
      expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
        2, 1,
      ]);
      // Eyebrows reflect honest dormancy through ageBucket — "recent" for
      // ≤30d, "season" for ≤90d.
      expect(chapters[0]?.ageBucket).toBe("recent");
      expect(chapters[1]?.ageBucket).toBe("season");
    });

    it("tops up the active block when active candidates leave Steam slots open", async () => {
      // One active + one dormant. With the cap at 5, slack=4, so the dormant
      // game fills a trailing slot. Active row sits first inside the Steam
      // block; dormant row trails it. The reader sees "Playing lately on
      // Active" → "Earlier this year on Dormant".
      const service = makeService(
        [
          makeOwnedGame({
            appid: 1,
            name: "Active",
            playtimeForeverMinutes: 60 * 25,
            playtime2WeeksMinutes: 60 * 10,
            rtimeLastPlayedAt: NOW.toISOString(),
          }),
          makeOwnedGame({
            appid: 2,
            name: "Dormant",
            playtimeForeverMinutes: 60 * 80, // larger lifetime
            playtime2WeeksMinutes: 0,
            rtimeLastPlayedAt: new Date(
              NOW.getTime() - 45 * 24 * 60 * 60 * 1000
            ).toISOString(),
          }),
        ],
        [],
        []
      );

      const chapters = await service.getChapters(NOW);
      expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
        1, 2,
      ]);
    });

    it("excludes appids already in the active block from the dormant top-up", async () => {
      // The same appid can't legitimately appear twice in one render. Active
      // wins the slot; dormant skips that appid even if it would otherwise
      // rank high by lifetime.
      const service = makeService(
        [
          makeOwnedGame({
            appid: 1,
            name: "Both",
            playtimeForeverMinutes: 60 * 100, // huge lifetime
            playtime2WeeksMinutes: 60 * 10, // also active
            rtimeLastPlayedAt: NOW.toISOString(),
          }),
        ],
        [],
        []
      );

      const chapters = await service.getChapters(NOW);
      // Surfaces exactly once.
      expect(
        chapters.filter((c) => c.kind === "steam-subject" && c.appid === 1)
      ).toHaveLength(1);
    });

    it("ignores brief-launch lastPlayed when ranking — a 3m relaunch must not outrank an older real session", async () => {
      // Silksong-shaped: high lifetime, freshly *launched* (3m 2w playtime),
      // but the last meaningful engagement (unlock) was months ago.
      // RE3-shaped: high lifetime, last played ~30d ago for hours (zero 2w
      // playtime since the 14d window has rolled past).
      // Without the brief-launch floor, Silksong's freshly-bumped
      // rtimeLastPlayedAt outranks RE3's 30d-old engagement. With the floor,
      // Silksong's `freshest` falls back to its lastUnlockAt (200d ago) and
      // RE3 wins on freshness.
      const silksongUnlock = new Date(NOW.getTime() - 200 * 24 * 60 * 60 * 1000);
      const re3LastPlayed = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
      const service = makeService(
        [
          makeOwnedGame({
            appid: 1145360, // Silksong shape
            name: "Silksong",
            playtimeForeverMinutes: 60 * 67,
            playtime2WeeksMinutes: 3, // 3m — brief relaunch
            rtimeLastPlayedAt: NOW.toISOString(),
          }),
          makeOwnedGame({
            appid: 952060, // RE3 shape
            name: "Resident Evil 3",
            playtimeForeverMinutes: 60 * 20,
            playtime2WeeksMinutes: 0,
            rtimeLastPlayedAt: re3LastPlayed.toISOString(),
          }),
        ],
        [{ appid: 1145360, _max: { unlockedAt: silksongUnlock } }],
        []
      );

      const chapters = await service.getChapters(NOW);
      expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
        952060, 1145360,
      ]);
    });

    it("reads the brief-launch floor off snapshot history once the 2w window has rolled", async () => {
      // Regression: the live `playtime2WeeksMinutes` is null for every
      // dormant game, because Steam drops the field once the window rolls
      // past the session. `playtime2W > 0` therefore failed on exactly the
      // launches the floor exists to catch — a 10-minute Requiem launch to
      // check GPU settings, 17d ago, took the top dormant slot ahead of
      // Sekiro's 10h playthrough. The snapshot taken while the window still
      // covered the launch preserves the reading, so the floor can still
      // fire. Note both games report null today: the discriminator is the
      // history, not the current value.
      const requiemLastPlayed = new Date(NOW.getTime() - 17 * 24 * 60 * 60 * 1000);
      const sekiroLastPlayed = new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000);
      const requiemUnlock = new Date(NOW.getTime() - 180 * 24 * 60 * 60 * 1000);
      const service = makeService(
        [
          makeOwnedGame({
            appid: 3764200, // Requiem shape
            name: "Resident Evil Requiem",
            playtimeForeverMinutes: 60 * 43,
            playtime2WeeksMinutes: null,
            rtimeLastPlayedAt: requiemLastPlayed.toISOString(),
          }),
          makeOwnedGame({
            appid: 814380, // Sekiro shape
            name: "Sekiro",
            playtimeForeverMinutes: 60 * 53,
            playtime2WeeksMinutes: null,
            rtimeLastPlayedAt: sekiroLastPlayed.toISOString(),
          }),
        ],
        [
          { appid: 3764200, _max: { unlockedAt: requiemUnlock } },
          { appid: 814380, _max: { unlockedAt: sekiroLastPlayed } },
        ],
        [],
        [
          // Taken 2d after each session, while the window still covered it.
          {
            appid: 3764200,
            snapshotDate: new Date(requiemLastPlayed.getTime() + 2 * 24 * 60 * 60 * 1000),
            playtime2WeeksMinutes: 10, // the GPU-settings launch
          },
          {
            appid: 814380,
            snapshotDate: new Date(sekiroLastPlayed.getTime() + 2 * 24 * 60 * 60 * 1000),
            playtime2WeeksMinutes: 596, // a real playthrough
          },
        ]
      );

      const chapters = await service.getChapters(NOW);
      expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
        814380, 3764200,
      ]);
    });

    it("keeps trusting lastPlayed when no snapshot covers the session", async () => {
      // Games last played before snapshot coverage began have no evidence
      // either way. Absence of a reading must not be read as a brief launch —
      // that would demote every pre-history game to its unlock date and drop
      // the ones with no achievements out of the dormant branch entirely.
      const recent = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000);
      const older = new Date(NOW.getTime() - 60 * 24 * 60 * 60 * 1000);
      const service = makeService(
        [
          makeOwnedGame({
            appid: 1,
            name: "No Snapshot Coverage",
            playtimeForeverMinutes: 60 * 30,
            playtime2WeeksMinutes: null,
            rtimeLastPlayedAt: recent.toISOString(),
          }),
          makeOwnedGame({
            appid: 2,
            name: "Older",
            playtimeForeverMinutes: 60 * 30,
            playtime2WeeksMinutes: null,
            rtimeLastPlayedAt: older.toISOString(),
          }),
        ],
        [],
        [],
        []
      );

      const chapters = await service.getChapters(NOW);
      expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
        1, 2,
      ]);
    });

    it("ignores snapshots predating the session when applying the brief-launch floor", async () => {
      // `snapshotDate` is a date-only column, so a row keyed to the session's
      // own day sits at midnight and describes the state *before* the launch.
      // Counting it would let an old playthrough's reading vouch for a later
      // brief launch. Here the pre-session reading is 596m and the only
      // post-session one is 10m — the floor must still fire.
      const lastPlayed = new Date(NOW.getTime() - 17 * 24 * 60 * 60 * 1000);
      const unlock = new Date(NOW.getTime() - 180 * 24 * 60 * 60 * 1000);
      const service = makeService(
        [
          makeOwnedGame({
            appid: 1,
            name: "Relaunched",
            playtimeForeverMinutes: 60 * 43,
            playtime2WeeksMinutes: null,
            rtimeLastPlayedAt: lastPlayed.toISOString(),
          }),
          makeOwnedGame({
            appid: 2,
            name: "Older Real Session",
            playtimeForeverMinutes: 60 * 20,
            playtime2WeeksMinutes: null,
            rtimeLastPlayedAt: new Date(
              NOW.getTime() - 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
          }),
        ],
        [{ appid: 1, _max: { unlockedAt: unlock } }],
        [],
        [
          {
            appid: 1,
            snapshotDate: new Date(lastPlayed.getTime() - 5 * 24 * 60 * 60 * 1000),
            playtime2WeeksMinutes: 596,
          },
          {
            appid: 1,
            snapshotDate: new Date(lastPlayed.getTime() + 2 * 24 * 60 * 60 * 1000),
            playtime2WeeksMinutes: 10,
          },
        ]
      );

      const chapters = await service.getChapters(NOW);
      expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
        2, 1,
      ]);
    });

    it("drops dormant candidates below the lifetime floor", async () => {
      // A briefly-launched-but-never-actually-played game must not surface
      // in the dormant branch — the lifetime floor is the gate that distinguishes
      // "engaged with at some point" from "opened the launcher once".
      const service = makeService(
        [
          makeOwnedGame({
            appid: 1,
            name: "Launcher Browse",
            playtimeForeverMinutes: 60 * 0.5, // 30 minutes, below 5h floor
            playtime2WeeksMinutes: 0,
            rtimeLastPlayedAt: new Date(
              NOW.getTime() - 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
          }),
        ],
        [],
        []
      );

      const chapters = await service.getChapters(NOW);
      expect(chapters).toEqual([]);
    });

    it("respects appType + unfeatured filters in the dormant branch", async () => {
      const service = makeService(
        [
          makeOwnedGame({
            appid: UNFEATURED_APPID,
            name: "Unfeatured",
            appType: 0,
            playtimeForeverMinutes: 60 * 500,
            playtime2WeeksMinutes: 0,
            rtimeLastPlayedAt: new Date(
              NOW.getTime() - 20 * 24 * 60 * 60 * 1000
            ).toISOString(),
          }),
          makeOwnedGame({
            appid: 999,
            name: "Wallpaper Engine",
            appType: 6,
            playtimeForeverMinutes: 60 * 500,
            playtime2WeeksMinutes: 0,
            rtimeLastPlayedAt: new Date(
              NOW.getTime() - 20 * 24 * 60 * 60 * 1000
            ).toISOString(),
          }),
          makeOwnedGame({
            appid: 42,
            name: "Eligible",
            appType: 0,
            playtimeForeverMinutes: 60 * 30,
            playtime2WeeksMinutes: 0,
            rtimeLastPlayedAt: new Date(
              NOW.getTime() - 25 * 24 * 60 * 60 * 1000
            ).toISOString(),
          }),
        ],
        [],
        [],
        [],
        unfeaturing(UNFEATURED_APPID)
      );

      const chapters = await service.getChapters(NOW);
      expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
        42,
      ]);
    });

    // The lane floors on lifetime minutes and ranks on recency, and neither can
    // tell 36h of in-game benchmark runs from 36h of playing. What separates
    // them is a launch that earns nothing in a game whose achievements stopped
    // moving a year ago — and a benchmark pass clears the ordinary 30-minute
    // floor, which is why that floor alone can't catch it.
    it("does not let a launch re-date a game whose progress has been frozen for a year", async () => {
      const benchmarkRun = new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000);
      const staleUnlock = new Date(NOW.getTime() - 500 * 24 * 60 * 60 * 1000);
      const playthrough = new Date(NOW.getTime() - 70 * 24 * 60 * 60 * 1000);
      const service = makeService(
        [
          makeOwnedGame({
            appid: 1091500, // Cyberpunk shape: hours, almost no progress
            name: "Benchmarked",
            playtimeForeverMinutes: 60 * 36,
            playtime2WeeksMinutes: null,
            rtimeLastPlayedAt: benchmarkRun.toISOString(),
          }),
          makeOwnedGame({
            appid: 814380,
            name: "Finished",
            playtimeForeverMinutes: 60 * 54,
            playtime2WeeksMinutes: null,
            rtimeLastPlayedAt: playthrough.toISOString(),
          }),
        ],
        [],
        [],
        [
          {
            appid: 1091500,
            snapshotDate: new Date(benchmarkRun.getTime() + 2 * 24 * 60 * 60 * 1000),
            // Over the 30-minute floor, under the stale-return floor.
            playtime2WeeksMinutes: 40,
          },
        ],
        NO_CURATION,
        {
          unlocks: [
            { appid: 1091500, unlockedAt: staleUnlock },
            ...Array.from({ length: 10 }, () => ({
              appid: 814380,
              unlockedAt: playthrough,
            })),
          ],
          achievementMeta: [
            { appid: 1091500, achievementCount: 20 },
            { appid: 814380, achievementCount: 20 },
          ],
        }
      );

      const chapters = await service.getChapters(NOW);
      // Benchmarked is the fresher of the two by `rtimeLastPlayedAt` and still
      // loses the slot: it re-dates to its 500-day-old unlock.
      expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
        814380, 1091500,
      ]);
      const benchmarked = chapters.find(
        (c) => c.kind === "steam-subject" && c.appid === 1091500
      );
      expect(benchmarked?.kind === "steam-subject" && benchmarked.daysSince).toBe(500);
    });

    // Silksong shows the identical unlock gap — 8 months between its last
    // achievement and its last launch — at 100% complete. Nothing was left to
    // earn, so the gap says nothing, and the ordinary floor must still apply.
    it("applies the ordinary floor to a game with nothing left to earn", async () => {
      const relaunch = new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000);
      const staleUnlock = new Date(NOW.getTime() - 500 * 24 * 60 * 60 * 1000);
      const service = makeService(
        [
          makeOwnedGame({
            appid: 1030300, // Silksong shape: completed, then re-opened
            name: "Completed",
            playtimeForeverMinutes: 60 * 67,
            playtime2WeeksMinutes: null,
            rtimeLastPlayedAt: relaunch.toISOString(),
          }),
        ],
        [],
        [],
        [
          {
            appid: 1030300,
            snapshotDate: new Date(relaunch.getTime() + 2 * 24 * 60 * 60 * 1000),
            playtime2WeeksMinutes: 40,
          },
        ],
        NO_CURATION,
        {
          unlocks: Array.from({ length: 20 }, () => ({
            appid: 1030300,
            unlockedAt: staleUnlock,
          })),
          achievementMeta: [{ appid: 1030300, achievementCount: 20 }],
        }
      );

      const chapters = await service.getChapters(NOW);
      const completed = chapters.find((c) => c.kind === "steam-subject");
      expect(completed?.kind === "steam-subject" && completed.daysSince).toBe(40);
    });

    // A real return to a long-abandoned game is play even when it earns nothing:
    // 21 of Binding of Isaac's *641* achievements is a genuine playthrough, and
    // the completion gate this replaced called it abandonment.
    it("keeps a substantial return to a game whose progress is stale", async () => {
      const returned = new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000);
      const staleUnlock = new Date(NOW.getTime() - 4000 * 24 * 60 * 60 * 1000);
      const service = makeService(
        [
          makeOwnedGame({
            appid: 250900,
            name: "Grindy Set",
            playtimeForeverMinutes: 60 * 11,
            playtime2WeeksMinutes: null,
            rtimeLastPlayedAt: returned.toISOString(),
          }),
        ],
        [],
        [],
        [
          {
            appid: 250900,
            snapshotDate: new Date(returned.getTime() + 2 * 24 * 60 * 60 * 1000),
            playtime2WeeksMinutes: 180, // three hours, earning nothing
          },
        ],
        NO_CURATION,
        {
          unlocks: Array.from({ length: 21 }, () => ({
            appid: 250900,
            unlockedAt: staleUnlock,
          })),
          achievementMeta: [{ appid: 250900, achievementCount: 641 }],
        }
      );

      const chapters = await service.getChapters(NOW);
      const grindy = chapters.find((c) => c.kind === "steam-subject");
      expect(grindy?.kind === "steam-subject" && grindy.daysSince).toBe(40);
    });

    // Low completion on its own is not a verdict. Skyrim at 5 of 75 and DayZ at
    // 0 of 13 are hours the owner really spent; with no session evidence against
    // the launch, the lane has nothing to hold against them.
    it("keeps a barely-completed game the snapshots never caught being launched", async () => {
      const played = new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000);
      const service = makeService(
        [
          makeOwnedGame({
            appid: 72850,
            name: "Barely Completed",
            playtimeForeverMinutes: 60 * 18,
            playtime2WeeksMinutes: null,
            rtimeLastPlayedAt: played.toISOString(),
          }),
        ],
        [],
        [],
        [],
        NO_CURATION,
        {
          unlocks: [{ appid: 72850, unlockedAt: played }],
          achievementMeta: [{ appid: 72850, achievementCount: 75 }],
        }
      );

      const chapters = await service.getChapters(NOW);
      expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
        72850,
      ]);
    });

    // Absence of a schema is not evidence of absence of play — Witcher 1 and
    // Fallout 3 GOTY predate achievements and are real playthroughs.
    it("keeps a dormant game that has no achievement schema to judge it by", async () => {
      const played = new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000);
      const service = makeService(
        [
          makeOwnedGame({
            appid: 22300,
            name: "Pre-Achievements",
            playtimeForeverMinutes: 60 * 30,
            playtime2WeeksMinutes: 0,
            rtimeLastPlayedAt: played.toISOString(),
          }),
        ],
        [],
        [],
        [],
        NO_CURATION,
        // A schema row exists but reports zero achievements — same verdict as no
        // row at all: nothing to measure, so nothing to hold against it.
        { achievementMeta: [{ appid: 22300, achievementCount: 0 }] }
      );

      const chapters = await service.getChapters(NOW);
      expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
        22300,
      ]);
    });

    // The brief-launch floor nulls `lastPlayed`, but `freshest` takes the later
    // of that and the unlock — so an achievement popped during the launch used
    // to carry today's date straight past the guard and re-top the lane.
    it("does not let an unlock earned during a brief launch re-date the game", async () => {
      const briefLaunch = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000);
      const realSessionUnlock = new Date(NOW.getTime() - 200 * 24 * 60 * 60 * 1000);
      const service = makeService(
        [
          makeOwnedGame({
            appid: 1,
            name: "Poked Yesterday",
            playtimeForeverMinutes: 60 * 50,
            playtime2WeeksMinutes: 10, // under the floor — a check, not a session
            rtimeLastPlayedAt: briefLaunch.toISOString(),
          }),
          makeOwnedGame({
            appid: 2,
            name: "Played A Month Ago",
            playtimeForeverMinutes: 60 * 30,
            playtime2WeeksMinutes: 0,
            rtimeLastPlayedAt: new Date(
              NOW.getTime() - 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
          }),
        ],
        [],
        [],
        [],
        NO_CURATION,
        {
          unlocks: [
            // Earned during the brief launch — must not count as freshness.
            { appid: 1, unlockedAt: briefLaunch },
            { appid: 1, unlockedAt: realSessionUnlock },
          ],
        }
      );

      const chapters = await service.getChapters(NOW);
      // The month-old real session outranks yesterday's poke.
      expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
        2, 1,
      ]);
      // And the eyebrow tells the truth about when it was last played properly.
      expect(chapters[1]?.ageBucket).toBe("year");
    });

    // The paired control. The guard must only fire on trivial touches — a real
    // session has to re-date the game, or returning to something is invisible.
    it("lets a substantial session re-date the game", async () => {
      const yesterday = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000);
      const service = makeService(
        [
          makeOwnedGame({
            appid: 1,
            name: "Played Properly Yesterday",
            playtimeForeverMinutes: 60 * 50,
            playtime2WeeksMinutes: 120, // two hours — real engagement
            rtimeLastPlayedAt: yesterday.toISOString(),
          }),
          makeOwnedGame({
            appid: 2,
            name: "Played A Month Ago",
            playtimeForeverMinutes: 60 * 30,
            playtime2WeeksMinutes: 0,
            rtimeLastPlayedAt: new Date(
              NOW.getTime() - 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
          }),
        ],
        [],
        [],
        [],
        NO_CURATION,
        { unlocks: [{ appid: 1, unlockedAt: yesterday }] }
      );

      const chapters = await service.getChapters(NOW);
      expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
        1, 2,
      ]);
    });
  });

  describe("LoL moment merge", () => {
    it("emits a lol-moment descriptor when LolMomentsService returns an off-meta candidate", async () => {
      // Active steam path is empty (no recent engagement), so the only
      // candidate is the off-meta pick. Cross-kind ordering puts steam-
      // subject first, then lol-moment, then steam-moment — with an empty
      // steam slot the chapter list is just the LoL moment.
      const ownedGames = {
        getOwnedGames: vi.fn().mockResolvedValue(makeOwnedGames([])),
      } as unknown as SteamOwnedGamesService;
      const prisma = emptyPrisma();
      const lolMoments = {
        detectAll: vi.fn().mockResolvedValue([
          {
            kind: "lol-moment",
            slug: "lol-moment-off-meta-EUW_42",
            momentType: "OFF_META_PICK",
            baseSignal: 20,
            daysSince: 2,
            matchId: "EUW_42",
            championAlias: "Renekton",
            offMeta: true,
          },
        ]),
      } as unknown as LolMomentsService;
      const steamMoments = {
        detectAll: vi.fn().mockResolvedValue([]),
      } as unknown as SteamMomentsService;
      const service = new RecapSubjectsService(
        ownedGames,
        prisma,
        lolMoments,
        steamMoments,
        CURATION_STUB
      );

      const chapters = await service.getChapters(NOW);
      expect(chapters).toHaveLength(1);
      const first = chapters[0];
      expect(first?.kind).toBe("lol-moment");
      if (first?.kind === "lol-moment") {
        expect(first.momentType).toBe("OFF_META_PICK");
        expect(first.matchId).toBe("EUW_42");
        expect(first.championAlias).toBe("Renekton");
      }
    });
  });

  describe("Steam moment ↔ steam-subject dedup", () => {
    it("suppresses the steam-subject row when a FIRST_TIME_GAME outscores it", async () => {
      // A freshly-added game with recent play qualifies for both:
      // steam-subject ("Playing lately") AND steam-moment (FIRST_TIME_GAME).
      // They're exclusive framings of one appid, so the higher score wins.
      // Here the subject clears the floor on its own (6h recent, no unlocks
      // → 6) but the moment outscores it (10 decayed over 3d ≈ 8.6), so
      // "first time loading X" is the better story and the subject is
      // dropped before scoring rather than by the floor.
      const ownedGames = {
        getOwnedGames: vi.fn().mockResolvedValue(
          makeOwnedGames([
            makeOwnedGame({
              appid: 2050650,
              name: "Resident Evil 4",
              playtime2WeeksMinutes: 60 * 6, // 6h recent → baseSignal 6
              rtimeLastPlayedAt: NOW.toISOString(),
            }),
          ])
        ),
      } as unknown as SteamOwnedGamesService;
      const prisma = {
        steamPlayerUnlock: {
          groupBy: vi
            .fn()
            .mockImplementation((args: { where?: unknown }) =>
              Promise.resolve(
                args.where ? [] : [{ appid: 2050650, _max: { unlockedAt: NOW } }]
              )
            ),
          findMany: vi.fn().mockResolvedValue([]),
        },
        steamPlaytimeSnapshot: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        steamGameAchievementMeta: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as unknown as PrismaService;
      const lolMoments = {
        detectAll: vi.fn().mockResolvedValue([]),
      } as unknown as LolMomentsService;
      const steamMoments = {
        detectAll: vi.fn().mockResolvedValue([
          {
            kind: "steam-moment",
            slug: "steam-moment-first-2050650",
            momentType: "FIRST_TIME_GAME",
            appid: 2050650,
            name: "Resident Evil 4",
            baseSignal: 10,
            daysSince: 3,
            firstTime: {
              windowPlayMinutes: 150,
              sessionCount: 3,
              firstSessionMinutes: 60,
              addedAt: "2026-05-30T10:00:00.000Z",
              firstPlayedAt: "2026-05-30T12:00:00.000Z",
            },
          },
        ]),
      } as unknown as SteamMomentsService;
      const service = new RecapSubjectsService(
        ownedGames,
        prisma,
        lolMoments,
        steamMoments,
        CURATION_STUB
      );

      const chapters = await service.getChapters(NOW);
      // Only the steam-moment survives — the steam-subject for the same
      // appid was dropped before scoring.
      expect(chapters.filter((c) => c.kind === "steam-subject")).toHaveLength(0);
      expect(chapters.filter((c) => c.kind === "steam-moment")).toHaveLength(1);
    });

    it("keeps the steam-subject row when it outscores the FIRST_TIME_GAME", async () => {
      // The converse, and the case that made the dedup score-based:
      // 9.5h across the first two days with 12 unlocks is the strongest
      // Steam signal on the page (baseSignal 9.5 + 6 = 15.5). Moments render
      // after every subject, so hardcoding "the moment wins" buried it as
      // one tile in the closing Highlights rack, behind five dormant
      // subjects — while the FIRST_TIME detector scored it at 7.2, because
      // its signal is observed session minutes and the poller only saw part
      // of the play. The subject wins and the moment is dropped.
      const ownedGames = {
        getOwnedGames: vi.fn().mockResolvedValue(
          makeOwnedGames([
            makeOwnedGame({
              appid: 2001760,
              name: "Beast of Reincarnation",
              playtimeForeverMinutes: 569,
              playtime2WeeksMinutes: 569, // 9.5h, all of it in the window
              rtimeLastPlayedAt: NOW.toISOString(),
            }),
          ])
        ),
      } as unknown as SteamOwnedGamesService;
      const prisma = {
        steamPlayerUnlock: {
          groupBy: vi
            .fn()
            .mockImplementation((args: { where?: unknown }) =>
              Promise.resolve(
                args.where
                  ? [{ appid: 2001760, _count: { apiName: 12 } }]
                  : [{ appid: 2001760, _max: { unlockedAt: NOW } }]
              )
            ),
          findMany: vi.fn().mockResolvedValue([]),
        },
        steamPlaytimeSnapshot: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        steamGameAchievementMeta: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as unknown as PrismaService;
      const lolMoments = {
        detectAll: vi.fn().mockResolvedValue([]),
      } as unknown as LolMomentsService;
      const steamMoments = {
        detectAll: vi.fn().mockResolvedValue([
          {
            kind: "steam-moment",
            slug: "steam-moment-first-2001760",
            momentType: "FIRST_TIME_GAME",
            appid: 2001760,
            name: "Beast of Reincarnation",
            baseSignal: 108 / 15, // observed session minutes / signal divisor
            daysSince: 0,
            firstTime: {
              windowPlayMinutes: 108,
              sessionCount: 7,
              firstSessionMinutes: 32,
              addedAt: "2026-05-25T08:25:18.000Z",
              firstPlayedAt: "2026-05-30T22:15:49.000Z",
            },
          },
        ]),
      } as unknown as SteamMomentsService;
      const service = new RecapSubjectsService(
        ownedGames,
        prisma,
        lolMoments,
        steamMoments,
        CURATION_STUB
      );

      const chapters = await service.getChapters(NOW);
      expect(chapters.filter((c) => c.kind === "steam-moment")).toHaveLength(0);
      const subjects = chapters.filter((c) => c.kind === "steam-subject");
      expect(subjects).toHaveLength(1);
      expect(subjects[0]?.kind === "steam-subject" && subjects[0].appid).toBe(2001760);
      // And it leads the page rather than trailing the dormant block.
      expect(chapters[0]?.kind).toBe("steam-subject");
    });

    it("keeps the steam-subject row when the same appid surfaces only as an ACHIEVEMENT_CLUSTER", async () => {
      // An ACHIEVEMENT_CLUSTER is a complementary fact ("you binged 5 in
      // one sitting"), not a substitute framing for "Playing lately".
      // Stripping the subject in that case sent the prominent chapter slot
      // to a less-played game while the actually-active game only appeared
      // as one of the small Highlights tiles — the bug this carve-out
      // fixes. Both the subject AND the cluster moment should survive for
      // the same appid.
      const ownedGames = {
        getOwnedGames: vi.fn().mockResolvedValue(
          makeOwnedGames([
            makeOwnedGame({
              appid: 2050650,
              name: "Resident Evil 4",
              playtime2WeeksMinutes: 60 * 8,
              rtimeLastPlayedAt: NOW.toISOString(),
            }),
          ])
        ),
      } as unknown as SteamOwnedGamesService;
      const prisma = {
        steamPlayerUnlock: {
          groupBy: vi
            .fn()
            .mockImplementation((args: { where?: unknown }) =>
              Promise.resolve(
                args.where
                  ? [{ appid: 2050650, _count: { apiName: 5 } }]
                  : [{ appid: 2050650, _max: { unlockedAt: NOW } }]
              )
            ),
          findMany: vi.fn().mockResolvedValue([]),
        },
        steamPlaytimeSnapshot: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        steamGameAchievementMeta: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as unknown as PrismaService;
      const lolMoments = {
        detectAll: vi.fn().mockResolvedValue([]),
      } as unknown as LolMomentsService;
      const steamMoments = {
        detectAll: vi.fn().mockResolvedValue([
          {
            kind: "steam-moment",
            slug: "steam-moment-cluster-2050650",
            momentType: "ACHIEVEMENT_CLUSTER",
            appid: 2050650,
            name: "Resident Evil 4",
            baseSignal: 20,
            daysSince: 1,
            cluster: {
              unlockCount: 5,
              spanHours: 6,
              capUnlockedAt: NOW.toISOString(),
              unlockNames: ["A", "B", "C", "D", "E"],
            },
          },
        ]),
      } as unknown as SteamMomentsService;
      const service = new RecapSubjectsService(
        ownedGames,
        prisma,
        lolMoments,
        steamMoments,
        CURATION_STUB
      );

      const chapters = await service.getChapters(NOW);
      expect(chapters.filter((c) => c.kind === "steam-subject")).toHaveLength(1);
      expect(chapters.filter((c) => c.kind === "steam-moment")).toHaveLength(1);
    });
  });

  describe("Steam moment same-appid dedup", () => {
    // A launch title the owner binged fires ACHIEVEMENT_CLUSTER and
    // LAUNCH_RARITY_DRIFT off the same week of play. Both scales top out at
    // 40 against the same decay, so the stronger story keeps the appid and the
    // page never shows two beats about one game.
    const DRIFT_APPID = 2001760;

    function driftCandidate(appid: number, baseSignal: number) {
      const headline = {
        apiName: "closest_companion",
        displayName: "Closest Companion",
        unlockedAt: "2026-05-13T20:00:00.000Z",
        percentAtUnlock: 3.2,
        percentNow: 38.4,
      };
      return {
        kind: "steam-moment" as const,
        slug: `steam-moment-launch-drift-${appid}`,
        momentType: "LAUNCH_RARITY_DRIFT" as const,
        appid,
        name: "Beast of Reincarnation",
        baseSignal,
        daysSince: 20,
        launchDrift: {
          releaseDate: "2026-04-24",
          observedFrom: "2026-04-26T05:30:00.000Z",
          observedTo: NOW.toISOString(),
          observationCount: 12,
          bracketedUnlockCount: 5,
          headline,
          curve: [3.2, 12.0, 25.5, 38.4],
          receipt: [headline],
        },
      };
    }

    function clusterCandidate(appid: number, baseSignal: number) {
      return {
        kind: "steam-moment" as const,
        slug: `steam-moment-cluster-${appid}`,
        momentType: "ACHIEVEMENT_CLUSTER" as const,
        appid,
        name: "Beast of Reincarnation",
        baseSignal,
        daysSince: 20,
        cluster: {
          unlockCount: 10,
          spanHours: 6,
          capUnlockedAt: "2026-05-13T20:00:00.000Z",
          unlockNames: ["A", "B", "C", "D", "E"],
        },
      };
    }

    function firstTimeCandidate(appid: number, baseSignal: number) {
      return {
        kind: "steam-moment" as const,
        slug: `steam-moment-first-${appid}`,
        momentType: "FIRST_TIME_GAME" as const,
        appid,
        name: "Beast of Reincarnation",
        baseSignal,
        daysSince: 20,
        firstTime: {
          windowPlayMinutes: 150,
          sessionCount: 3,
          firstSessionMinutes: 60,
          addedAt: "2026-05-11T10:00:00.000Z",
          firstPlayedAt: "2026-05-13T12:00:00.000Z",
        },
      };
    }

    function serviceWith(candidates: RecapCandidate[]): RecapSubjectsService {
      const ownedGames = {
        getOwnedGames: vi.fn().mockResolvedValue(makeOwnedGames([])),
      } as unknown as SteamOwnedGamesService;
      const lolMoments = {
        detectAll: vi.fn().mockResolvedValue([]),
      } as unknown as LolMomentsService;
      const steamMoments = {
        detectAll: vi.fn().mockResolvedValue(candidates),
      } as unknown as SteamMomentsService;
      return new RecapSubjectsService(
        ownedGames,
        emptyPrisma(),
        lolMoments,
        steamMoments,
        CURATION_STUB
      );
    }

    it("keeps only the higher-scoring moment when two fire on one appid", async () => {
      const service = serviceWith([
        clusterCandidate(DRIFT_APPID, 20),
        driftCandidate(DRIFT_APPID, 40),
      ]);
      const moments = (await service.getChapters(NOW)).filter(
        (c) => c.kind === "steam-moment"
      );
      expect(moments).toHaveLength(1);
      expect(moments[0]?.kind === "steam-moment" && moments[0].momentType).toBe(
        "LAUNCH_RARITY_DRIFT"
      );
    });

    it("keeps the cluster when it outscores the drift beat on the same appid", async () => {
      const service = serviceWith([
        clusterCandidate(DRIFT_APPID, 40),
        driftCandidate(DRIFT_APPID, 20),
      ]);
      const moments = (await service.getChapters(NOW)).filter(
        (c) => c.kind === "steam-moment"
      );
      expect(moments).toHaveLength(1);
      expect(moments[0]?.kind === "steam-moment" && moments[0].momentType).toBe(
        "ACHIEVEMENT_CLUSTER"
      );
    });

    it("leaves a FIRST_TIME_GAME beside a cluster on the same appid", async () => {
      // FIRST_TIME_GAME's baseSignal is play-minutes / 15 — on no shared
      // ceiling and under-observed by the poller — so it is exempt: scoring it
      // against a cluster would drop the first-time story on the one game
      // where it is the story. It also has to survive to here for the
      // moment ↔ subject suppression to fire, which the specs above pin.
      // 20 at 20 days decays to 7.43 — above the floor on its own, and below
      // the cluster's 14.86, so an unscoped dedup would drop it.
      const service = serviceWith([
        firstTimeCandidate(DRIFT_APPID, 20),
        clusterCandidate(DRIFT_APPID, 40),
      ]);
      const moments = (await service.getChapters(NOW)).filter(
        (c) => c.kind === "steam-moment"
      );
      expect(moments).toHaveLength(2);
      expect(
        new Set(moments.map((c) => (c.kind === "steam-moment" ? c.momentType : null)))
      ).toEqual(new Set(["FIRST_TIME_GAME", "ACHIEVEMENT_CLUSTER"]));
    });

    it("leaves moments on different appids alone", async () => {
      const service = serviceWith([
        clusterCandidate(DRIFT_APPID, 40),
        driftCandidate(2584270, 40),
      ]);
      const moments = (await service.getChapters(NOW)).filter(
        (c) => c.kind === "steam-moment"
      );
      expect(moments).toHaveLength(2);
      expect(new Set(moments.map((c) => c.appid))).toEqual(
        new Set([DRIFT_APPID, 2584270])
      );
    });
  });

  describe("Steam moment merge", () => {
    it("emits a steam-moment descriptor when SteamMomentsService returns a first-time candidate", async () => {
      // Active steam-subject path empty; lol moments empty; only the
      // steam-moment fires. Verifies the third feed-source plumbs through
      // `selectChapters` and lands as `steam-moment` in the final list.
      const ownedGames = {
        getOwnedGames: vi.fn().mockResolvedValue(makeOwnedGames([])),
      } as unknown as SteamOwnedGamesService;
      const prisma = emptyPrisma();
      const lolMoments = {
        detectAll: vi.fn().mockResolvedValue([]),
      } as unknown as LolMomentsService;
      const steamMoments = {
        detectAll: vi.fn().mockResolvedValue([
          {
            kind: "steam-moment",
            slug: "steam-moment-first-2050650",
            momentType: "FIRST_TIME_GAME",
            appid: 2050650,
            name: "Resident Evil 4",
            baseSignal: 10,
            daysSince: 3,
            firstTime: {
              windowPlayMinutes: 150,
              sessionCount: 3,
              firstSessionMinutes: 60,
              addedAt: "2026-05-30T10:00:00.000Z",
              firstPlayedAt: "2026-05-30T12:00:00.000Z",
            },
          },
        ]),
      } as unknown as SteamMomentsService;
      const service = new RecapSubjectsService(
        ownedGames,
        prisma,
        lolMoments,
        steamMoments,
        CURATION_STUB
      );

      const chapters = await service.getChapters(NOW);
      expect(chapters).toHaveLength(1);
      const first = chapters[0];
      expect(first?.kind).toBe("steam-moment");
      if (first?.kind === "steam-moment") {
        expect(first.momentType).toBe("FIRST_TIME_GAME");
        expect(first.appid).toBe(2050650);
        expect(first.name).toBe("Resident Evil 4");
        expect(first.firstTime?.windowPlayMinutes).toBe(150);
      }
    });
  });
});
