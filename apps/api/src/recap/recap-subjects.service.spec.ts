import type { SteamOwnedGame, SteamOwnedGames } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";
import type { SteamOwnedGamesService } from "../steam/owned-games.service";
import { RECAP_HIDDEN_APPIDS } from "./recap-curation";
import { RecapSubjectsService } from "./recap-subjects.service";

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
  return new RecapSubjectsService(ownedGames, prisma);
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

  it("ranks higher-score candidates first and caps at three", async () => {
    const games = Array.from({ length: 5 }, (_, i) =>
      makeOwnedGame({
        appid: i + 1,
        name: `Game ${i + 1}`,
        playtime2WeeksMinutes: 60 * (50 - i * 8), // 50h, 42h, 34h, 26h, 18h recent
        rtimeLastPlayedAt: NOW.toISOString(),
      })
    );
    const service = makeService(games, []);
    const chapters = await service.getChapters(NOW);
    expect(chapters).toHaveLength(3);
    expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([
      1, 2, 3,
    ]);
  });

  it("drops candidates below the score floor", async () => {
    const service = makeService(
      [
        makeOwnedGame({
          appid: 1,
          playtime2WeeksMinutes: 60 * 20,
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
        makeOwnedGame({
          appid: 2,
          playtime2WeeksMinutes: 60 * 1, // 1h recent, no unlocks → floor drops it
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
      ],
      []
    );
    const chapters = await service.getChapters(NOW);
    expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([1]);
  });
});
