import type { SteamOwnedGame, SteamOwnedGames } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";
import type { SteamOwnedGamesService } from "../steam/owned-games.service";
import type { LolMomentsService } from "./lol-moments.service";
import { RECAP_HIDDEN_APPIDS } from "./recap-curation";
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

function makeService(
  games: SteamOwnedGame[],
  lastUnlockRows: LastUnlockRow[] = [],
  recentUnlockRows: RecentUnlockRow[] = []
): RecapSubjectsService {
  const ownedGames = {
    getOwnedGames: vi.fn().mockResolvedValue(makeOwnedGames(games)),
  } as unknown as SteamOwnedGamesService;
  // The service makes two distinct groupBy calls — one unfiltered for
  // `_max(unlockedAt)` (drives `freshest` / daysSince), one filtered to the
  // 14d window for `_count(apiName)` (drives baseSignal). Branch on the
  // presence of `where` to route each call to its fixture.
  const prisma = {
    steamPlayerUnlock: {
      groupBy: vi
        .fn()
        .mockImplementation((args: { where?: unknown }) =>
          Promise.resolve(args.where ? recentUnlockRows : lastUnlockRows)
        ),
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
  return new RecapSubjectsService(ownedGames, prisma, lolMoments, steamMoments);
}

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

  it("filters out appids in the hidden list even when score would qualify", async () => {
    const [hidden] = [...RECAP_HIDDEN_APPIDS];
    if (hidden === undefined) {
      throw new Error("test precondition: RECAP_HIDDEN_APPIDS must be non-empty");
    }
    const service = makeService(
      [
        makeOwnedGame({
          appid: hidden,
          name: "Hidden",
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
    expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
      99,
    ]);
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

    it("respects appType + hidden-appid filters in the dormant branch", async () => {
      const [hidden] = [...RECAP_HIDDEN_APPIDS];
      if (hidden === undefined) {
        throw new Error("test precondition: RECAP_HIDDEN_APPIDS must be non-empty");
      }
      const service = makeService(
        [
          makeOwnedGame({
            appid: hidden,
            name: "Hidden",
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
        []
      );

      const chapters = await service.getChapters(NOW);
      expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
        42,
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
      const prisma = {
        steamPlayerUnlock: {
          groupBy: vi.fn().mockResolvedValue([]),
        },
      } as unknown as PrismaService;
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
        steamMoments
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
    it("suppresses the steam-subject row when the same appid surfaces as a steam-moment", async () => {
      // A freshly-added game with hours of recent play would qualify for
      // both: steam-subject ("Playing lately") AND steam-moment
      // (FIRST_TIME_GAME). The moment is the more interesting framing —
      // the dedup keeps it and drops the subject so the same appid doesn't
      // appear in two adjacent chapters with conflicting registers.
      const ownedGames = {
        getOwnedGames: vi.fn().mockResolvedValue(
          makeOwnedGames([
            makeOwnedGame({
              appid: 2050650,
              name: "Resident Evil 4",
              playtime2WeeksMinutes: 60 * 8, // 8h recent
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
            firstTime: { windowPlayMinutes: 150 },
          },
        ]),
      } as unknown as SteamMomentsService;
      const service = new RecapSubjectsService(
        ownedGames,
        prisma,
        lolMoments,
        steamMoments
      );

      const chapters = await service.getChapters(NOW);
      // Only the steam-moment survives — the steam-subject for the same
      // appid was dropped before scoring.
      expect(chapters.filter((c) => c.kind === "steam-subject")).toHaveLength(0);
      expect(chapters.filter((c) => c.kind === "steam-moment")).toHaveLength(1);
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
      const prisma = {
        steamPlayerUnlock: {
          groupBy: vi.fn().mockResolvedValue([]),
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
            firstTime: { windowPlayMinutes: 150 },
          },
        ]),
      } as unknown as SteamMomentsService;
      const service = new RecapSubjectsService(
        ownedGames,
        prisma,
        lolMoments,
        steamMoments
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
