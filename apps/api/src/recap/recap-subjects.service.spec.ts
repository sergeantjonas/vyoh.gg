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

interface UnlockRow {
  appid: number;
  _max: { unlockedAt: Date | null };
  _count: { apiName: number };
}

function makeService(
  games: SteamOwnedGame[],
  unlocks: UnlockRow[]
): RecapSubjectsService {
  const ownedGames = {
    getOwnedGames: vi.fn().mockResolvedValue(makeOwnedGames(games)),
  } as unknown as SteamOwnedGamesService;
  const prisma = {
    steamPlayerUnlock: {
      groupBy: vi.fn().mockResolvedValue(unlocks),
    },
  } as unknown as PrismaService;
  return new RecapSubjectsService(ownedGames, prisma);
}

describe("RecapSubjectsService.getChapters", () => {
  it("emits a steam-subject descriptor for a game with playtime and unlocks", async () => {
    const service = makeService(
      [
        makeOwnedGame({
          appid: 42,
          name: "Recent Hit",
          playtimeForeverMinutes: 60 * 30, // 30h → baseSignal contribution 30
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
      ],
      [
        {
          appid: 42,
          _max: { unlockedAt: NOW },
          _count: { apiName: 20 }, // +10 baseSignal contribution
        },
      ]
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
      // baseSignal = 30 + 20×0.5 = 40, no decay (days=0).
      expect(first.score).toBeCloseTo(40);
      expect(first.framing).toBeNull();
    }
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
          playtimeForeverMinutes: 60 * 200,
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
        makeOwnedGame({
          appid: 99,
          name: "Visible",
          playtimeForeverMinutes: 60 * 10,
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
          playtimeForeverMinutes: 60 * 500, // huge — would dominate without the filter
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
        makeOwnedGame({
          appid: 42,
          name: "Actual Game",
          appType: 0,
          playtimeForeverMinutes: 60 * 20,
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
        makeOwnedGame({
          appid: 99,
          name: "Unenriched Game",
          appType: null,
          playtimeForeverMinutes: 60 * 10,
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
    const service = makeService(
      [
        makeOwnedGame({
          appid: 1,
          playtimeForeverMinutes: 60 * 30,
          rtimeLastPlayedAt: "2026-04-01T00:00:00Z", // ~62 days ago
        }),
      ],
      [
        {
          appid: 1,
          _max: { unlockedAt: new Date("2026-06-01T00:00:00Z") }, // ~1 day ago
          _count: { apiName: 4 },
        },
      ]
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
        playtimeForeverMinutes: 60 * (100 - i * 10), // 100h, 90h, 80h, 70h, 60h
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
          playtimeForeverMinutes: 60 * 200,
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
        makeOwnedGame({
          appid: 2,
          playtimeForeverMinutes: 60 * 1, // 1h, no unlocks → floor drops it
          rtimeLastPlayedAt: NOW.toISOString(),
        }),
      ],
      []
    );
    const chapters = await service.getChapters(NOW);
    expect(chapters.map((c) => (c.kind === "steam-subject" ? c.appid : -1))).toEqual([1]);
  });
});
