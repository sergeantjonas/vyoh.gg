import { NotFoundException } from "@nestjs/common";
import {
  type MatchDetail,
  type ParticipantDetail,
  type SteamGameRecap,
  championTheme,
  formatKda,
  formatPercent,
  formatPlaytimeFromSeconds,
} from "@vyoh/shared";
import { NO_CURATION } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import type { HomeLifetimeTotalsService } from "../home/home-lifetime-totals.service";
import type { IdentityService } from "../identity/identity.service";
import type { LolImageService } from "../img/lol-image.service";
import type { SteamImageService } from "../img/steam-image.service";
import type { LolChampionAnalyticsService } from "../lol/lol-champion-analytics.service";
import type { LolService } from "../lol/lol.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { SteamGameCurationService } from "../steam/game-curation.service";
import type { SteamGameRecapService } from "../steam/game-recap.service";
import { OgService } from "./og.service";

const renderMatchCardMock = vi.fn(async (_args: unknown) => Buffer.from("mock-png"));
const renderChampionCardMock = vi.fn(async (_args: unknown) => Buffer.from("mock-champ"));
const renderProfileCardMock = vi.fn(async (_args: unknown) =>
  Buffer.from("mock-profile")
);
const renderHomeCardMock = vi.fn(async (_args: unknown) => Buffer.from("mock-home"));
const renderSteamGameCardMock = vi.fn(async (_args: unknown) =>
  Buffer.from("mock-steam")
);
const renderRecapChapterCardMock = vi.fn(async (_args: unknown) =>
  Buffer.from("mock-recap-chapter")
);
vi.mock("./og-card", () => ({
  renderMatchCard: (args: unknown) => renderMatchCardMock(args),
  renderChampionCard: (args: unknown) => renderChampionCardMock(args),
  renderProfileCard: (args: unknown) => renderProfileCardMock(args),
  renderHomeCard: (args: unknown) => renderHomeCardMock(args),
  renderSteamGameCard: (args: unknown) => renderSteamGameCardMock(args),
  renderRecapChapterCard: (args: unknown) => renderRecapChapterCardMock(args),
}));

interface ServiceStubs {
  lol?: Partial<LolService>;
  identity?: Partial<IdentityService>;
  lolImage?: Partial<LolImageService>;
  steamImage?: Partial<SteamImageService>;
  prisma?: Partial<PrismaService>;
  steamGameRecap?: Partial<SteamGameRecapService>;
  championAnalytics?: Partial<LolChampionAnalyticsService>;
  lifetimeTotals?: Partial<HomeLifetimeTotalsService>;
}

function participant(overrides: Partial<ParticipantDetail> = {}): ParticipantDetail {
  return {
    puuid: "puuid-1",
    riotIdGameName: "Vyoh",
    riotIdTagline: "Ahri",
    championName: "Ahri",
    teamId: 100,
    teamPosition: "MIDDLE",
    kills: 8,
    deaths: 3,
    assists: 12,
    win: true,
    items: [],
    goldEarned: 12000,
    totalDamage: 25000,
    csTotal: 200,
    csPerMin: 7.5,
    visionScore: 30,
    wardsPlaced: 10,
    wardsKilled: 5,
    controlWardsPurchased: 3,
    kp: 0.5,
    damageShare: 0.25,
    goldShare: 0.22,
    damageDealtPhysical: 15000,
    damageDealtMagic: 8000,
    damageDealtTrue: 2000,
    summoner1Id: 4,
    summoner2Id: 14,
    keystone: 8214,
    championLevel: 18,
    ...overrides,
  };
}

function detail(participants: ParticipantDetail[]): MatchDetail {
  return {
    matchId: "EUW1_42",
    queueId: 420,
    durationSec: 1834, // 30m 34s
    playedAt: "2026-05-16T12:00:00.000Z",
    teams: [],
    participants,
  };
}

function makeService(stubs: ServiceStubs = {}): OgService {
  // Each subset of methods used by the service under test is stubbed with a
  // safe default; callers override per-test via `stubs`.
  const lolImageDefault: Partial<LolImageService> = {
    champion: vi
      .fn()
      .mockResolvedValue({ urls: ["https://wiki.example/splash.jpg"], params: {} }),
  } as unknown as Partial<LolImageService>;
  const steamImageDefault: Partial<SteamImageService> = {
    heroLarge: vi
      .fn()
      .mockResolvedValue({ urls: ["https://cdn.example/hero.jpg"], params: {} }),
  } as unknown as Partial<SteamImageService>;
  return new OgService(
    (stubs.lol ?? {}) as unknown as LolService,
    (stubs.identity ?? {}) as unknown as IdentityService,
    (stubs.lolImage ?? lolImageDefault) as unknown as LolImageService,
    (stubs.steamImage ?? steamImageDefault) as unknown as SteamImageService,
    (stubs.prisma ?? {}) as unknown as PrismaService,
    (stubs.steamGameRecap ?? {}) as unknown as SteamGameRecapService,
    (stubs.championAnalytics ?? {}) as unknown as LolChampionAnalyticsService,
    (stubs.lifetimeTotals ?? {}) as unknown as HomeLifetimeTotalsService,
    // An OG card is never viewer-aware, so the service only ever asks for the
    // public overlay. Empty here, so existing card expectations stand.
    {
      getCuration: vi.fn().mockResolvedValue(NO_CURATION),
    } as unknown as SteamGameCurationService
  );
}

const ACCOUNT = {
  slug: "vyoh-ahri",
  gameName: "Vyoh",
  tagLine: "Ahri",
  region: "euw1",
};

describe("OgService.generateMatchCard", () => {
  it("throws NotFoundException when no account matches the slug", async () => {
    const service = makeService({
      identity: { findBySlug: vi.fn().mockReturnValue(undefined) },
    });
    await expect(service.generateMatchCard("nope", "EUW1_42")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("throws NotFoundException when the participant isn't in the match", async () => {
    const service = makeService({
      lol: {
        getMatchDetail: vi
          .fn()
          .mockResolvedValue(detail([participant({ riotIdGameName: "OtherPlayer" })])),
      },
      identity: { findBySlug: vi.fn().mockReturnValue(ACCOUNT) },
    });
    await expect(
      service.generateMatchCard("vyoh-ahri", "EUW1_42")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("matches on case-insensitive riotId and formats duration as Xm SSs", async () => {
    renderMatchCardMock.mockClear();
    const service = makeService({
      lol: {
        getMatchDetail: vi.fn().mockResolvedValue(
          detail([
            participant({
              riotIdGameName: "VYOH",
              riotIdTagline: "AHRI",
              championName: "Ahri",
              kills: 11,
              deaths: 4,
              assists: 7,
              win: true,
            }),
          ])
        ),
      },
      identity: { findBySlug: vi.fn().mockReturnValue(ACCOUNT) },
    });

    await service.generateMatchCard("vyoh-ahri", "EUW1_42");

    expect(renderMatchCardMock).toHaveBeenCalledWith({
      championName: "Ahri",
      splashUrls: ["https://wiki.example/splash.jpg"],
      kills: 11,
      deaths: 4,
      assists: 7,
      win: true,
      queueLabel: "Ranked Solo",
      durationLabel: "30m 34s",
      accountLabel: "Vyoh#Ahri",
      region: "EUW1",
    });
  });

  it("zero-pads seconds < 10 in the duration label", async () => {
    renderMatchCardMock.mockClear();
    const service = makeService({
      lol: {
        getMatchDetail: vi
          .fn()
          .mockResolvedValue({ ...detail([participant()]), durationSec: 65 }),
      },
      identity: { findBySlug: vi.fn().mockReturnValue(ACCOUNT) },
    });

    await service.generateMatchCard("vyoh-ahri", "EUW1_42");

    expect(renderMatchCardMock).toHaveBeenCalledWith(
      expect.objectContaining({ durationLabel: "1m 05s" })
    );
  });
});

describe("OgService.generateChampionCard", () => {
  it("throws NotFoundException when no champion row matches the alias", async () => {
    const service = makeService({
      prisma: {
        lolChampion: { findFirst: vi.fn().mockResolvedValue(null) },
      } as unknown as Partial<PrismaService>,
    });
    await expect(service.generateChampionCard("Nope")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("renders with modernClasses first, falls back to roles when empty", async () => {
    renderChampionCardMock.mockClear();
    const service = makeService({
      prisma: {
        lolChampion: {
          findFirst: vi.fn().mockResolvedValue({
            alias: "Jinx",
            name: "Jinx",
            modernClasses: ["Marksman"],
            roles: ["BOTTOM"],
          }),
        },
      } as unknown as Partial<PrismaService>,
    });
    await service.generateChampionCard("Jinx");
    expect(renderChampionCardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        championName: "Jinx",
        subLabel: "Marksman",
      })
    );
  });

  it("falls back to roles when modernClasses is empty (cold-start case)", async () => {
    renderChampionCardMock.mockClear();
    const service = makeService({
      prisma: {
        lolChampion: {
          findFirst: vi.fn().mockResolvedValue({
            alias: "NewChamp",
            name: "NewChamp",
            modernClasses: [],
            roles: ["TOP", "JUNGLE"],
          }),
        },
      } as unknown as Partial<PrismaService>,
    });
    await service.generateChampionCard("NewChamp");
    expect(renderChampionCardMock).toHaveBeenCalledWith(
      expect.objectContaining({ subLabel: "TOP · JUNGLE" })
    );
  });
});

describe("OgService.generateProfileCard", () => {
  it("throws NotFoundException when no account matches the slug", async () => {
    const service = makeService({
      identity: { findBySlug: vi.fn().mockReturnValue(undefined) },
    });
    await expect(service.generateProfileCard("nope")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("composes the rank line + KPIs from solo entry + cached matches", async () => {
    renderProfileCardMock.mockClear();
    const matchRow = (overrides: Partial<{ win: boolean; remake: boolean }> = {}) => ({
      matchId: "EUW1_1",
      champion: "Ahri",
      kills: 5,
      deaths: 2,
      assists: 7,
      win: true,
      remake: false,
      ...overrides,
    });
    const service = makeService({
      identity: { findBySlug: vi.fn().mockReturnValue(ACCOUNT) },
      lol: {
        getSummonerProfile: vi.fn().mockResolvedValue({
          profileIconId: 5384,
          summonerLevel: 432,
          rankEntries: [
            {
              queueId: "RANKED_SOLO_5x5",
              tier: "PLATINUM",
              rank: "III",
              leaguePoints: 47,
              wins: 12,
              losses: 8,
              hotStreak: false,
            },
          ],
        }),
        getCachedMatches: vi.fn().mockResolvedValue({
          matches: [
            matchRow({ win: true }),
            matchRow({ win: false }),
            matchRow({ win: true }),
            matchRow({ win: true, remake: true }),
          ],
          total: 4,
        }),
      },
    });

    await service.generateProfileCard("vyoh-ahri");

    expect(renderProfileCardMock).toHaveBeenCalledWith({
      accountLabel: "Vyoh#Ahri",
      rankLine: "Platinum III · 47 LP",
      // Three non-remake matches; 2 wins → 67%; KDA (15+21)/6 = 6.00.
      kpis: [
        { label: "Win rate", value: expect.stringMatching(/^\d{2}%$/) },
        { label: "KDA", value: expect.stringMatching(/^\d/) },
        { label: "Games", value: "3" },
      ],
      region: "EUW1",
      // Signature champion of the (3 non-remake) matches is the single
      // unique champion "Ahri" — the lolImage stub returns the wiki URL.
      splashUrls: ["https://wiki.example/splash.jpg"],
    });
  });

  it("yields empty splashUrls when the account has no non-remake matches", async () => {
    renderProfileCardMock.mockClear();
    const service = makeService({
      identity: { findBySlug: vi.fn().mockReturnValue(ACCOUNT) },
      lol: {
        getSummonerProfile: vi.fn().mockResolvedValue({
          profileIconId: null,
          summonerLevel: null,
          rankEntries: [],
        }),
        getCachedMatches: vi.fn().mockResolvedValue({ matches: [], total: 0 }),
      },
    });
    await service.generateProfileCard("vyoh-ahri");
    expect(renderProfileCardMock).toHaveBeenCalledWith(
      expect.objectContaining({ splashUrls: [] })
    );
  });

  it("drops the division for apex tiers", async () => {
    renderProfileCardMock.mockClear();
    const service = makeService({
      identity: { findBySlug: vi.fn().mockReturnValue(ACCOUNT) },
      lol: {
        getSummonerProfile: vi.fn().mockResolvedValue({
          profileIconId: null,
          summonerLevel: null,
          rankEntries: [
            {
              queueId: "RANKED_SOLO_5x5",
              tier: "CHALLENGER",
              rank: "I",
              leaguePoints: 1247,
              wins: null,
              losses: null,
              hotStreak: false,
            },
          ],
        }),
        getCachedMatches: vi.fn().mockResolvedValue({ matches: [], total: 0 }),
      },
    });

    await service.generateProfileCard("vyoh-ahri");

    expect(renderProfileCardMock).toHaveBeenCalledWith(
      expect.objectContaining({ rankLine: "Challenger · 1247 LP" })
    );
  });

  // The rank line walks the display order and takes the first ladder with
  // standing, so an account ranked only on premade-5s gets a rank line rather
  // than the null the hardcoded solo-then-flex lookup produced.
  it("falls through the display order to whichever ladder has standing", async () => {
    renderProfileCardMock.mockClear();
    const service = makeService({
      identity: { findBySlug: vi.fn().mockReturnValue(ACCOUNT) },
      lol: {
        getSummonerProfile: vi.fn().mockResolvedValue({
          profileIconId: null,
          summonerLevel: null,
          rankEntries: [
            {
              queueId: "RANKED_PREMADE_5x5",
              tier: "MASTER",
              rank: "I",
              leaguePoints: 12,
              wins: 8,
              losses: 4,
              hotStreak: false,
            },
          ],
        }),
        getCachedMatches: vi.fn().mockResolvedValue({ matches: [], total: 0 }),
      },
    });

    await service.generateProfileCard("vyoh-ahri");

    expect(renderProfileCardMock).toHaveBeenCalledWith(
      expect.objectContaining({ rankLine: "Master · 12 LP" })
    );
  });

  it("renders rankLine null when no rank entries exist", async () => {
    renderProfileCardMock.mockClear();
    const service = makeService({
      identity: { findBySlug: vi.fn().mockReturnValue(ACCOUNT) },
      lol: {
        getSummonerProfile: vi.fn().mockResolvedValue({
          profileIconId: null,
          summonerLevel: null,
          rankEntries: [],
        }),
        getCachedMatches: vi.fn().mockResolvedValue({ matches: [], total: 0 }),
      },
    });

    await service.generateProfileCard("vyoh-ahri");

    expect(renderProfileCardMock).toHaveBeenCalledWith(
      expect.objectContaining({ rankLine: null })
    );
  });
});

describe("OgService.generateHomeCard", () => {
  it("renders the home card synchronously without external calls", async () => {
    renderHomeCardMock.mockClear();
    const service = makeService();
    await service.generateHomeCard();
    expect(renderHomeCardMock).toHaveBeenCalledWith(
      expect.objectContaining({ tagline: expect.any(String) })
    );
  });
});

describe("OgService.generateSteamGameCard", () => {
  function recap(overrides: Partial<SteamGameRecap> = {}): SteamGameRecap {
    return {
      appid: 1145360,
      name: "Hades",
      assetTimestamp: 1700000000,
      hasLibraryHero: true,
      flipHero: false,
      subjectXPercent: null,
      subjectYPercent: null,
      hasLogo: true,
      dominantHex: "#7a3aff",
      shortDescription: "A rogue-like dungeon crawler from Supergiant.",
      playtimeForeverMinutes: 5040, // 84h
      playtime2WeeksMinutes: 120, // 2h
      lastPlayedAt: "2026-05-30T12:00:00.000Z",
      releaseDate: "2020-09-17",
      recentPlaytimeMinutes: [],
      achievementsTotal: 49,
      achievementsUnlocked: 30,
      completionPct: 0.612,
      recentUnlocks: [],
      unlocksPerWeek: [],
      medianAchievementRarity: null,
      daysToCompletion: null,
      ...overrides,
    } as SteamGameRecap;
  }

  it("propagates NotFoundException from the recap service", async () => {
    const service = makeService({
      steamGameRecap: {
        getGameRecap: vi.fn().mockRejectedValue(new NotFoundException("missing")),
      },
    });
    await expect(service.generateSteamGameCard(999999)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("composes hero URLs + KPIs from the recap", async () => {
    renderSteamGameCardMock.mockClear();
    const service = makeService({
      steamGameRecap: { getGameRecap: vi.fn().mockResolvedValue(recap()) },
    });
    await service.generateSteamGameCard(1145360);
    expect(renderSteamGameCardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        gameName: "Hades",
        heroUrls: ["https://cdn.example/hero.jpg"],
        shortDescription: "A rogue-like dungeon crawler from Supergiant.",
        kpis: expect.arrayContaining([
          expect.objectContaining({ label: "Playtime" }),
          expect.objectContaining({ label: "Completion" }),
          expect.objectContaining({ label: "Recent" }),
        ]),
      })
    );
  });

  it("renders Completion as em-dash when completionPct is null", async () => {
    renderSteamGameCardMock.mockClear();
    const service = makeService({
      steamGameRecap: {
        getGameRecap: vi.fn().mockResolvedValue(
          recap({
            achievementsTotal: null,
            completionPct: null,
            playtime2WeeksMinutes: null,
          })
        ),
      },
    });
    await service.generateSteamGameCard(1145360);
    const args = renderSteamGameCardMock.mock.calls[0]?.[0] as
      | { kpis: Array<{ label: string; value: string }> }
      | undefined;
    const completion = args?.kpis.find((k) => k.label === "Completion");
    expect(completion?.value).toBe("—");
  });
});

describe("OgService.generateRecapChapterCard", () => {
  const OWNER_ACCOUNT = { ...ACCOUNT, isOwner: true, isPrimary: true };

  // Deliberately newest-first (the cached endpoint's order) with a remake in
  // the middle — the service must exclude the remake and re-sort oldest-first
  // before seeding the ridge.
  const windowMatches = [
    {
      champion: "Jinx",
      win: false,
      kills: 2,
      remake: false,
      playedAt: "2026-07-01T12:00:00.000Z",
    },
    {
      champion: "Ahri",
      win: true,
      kills: 11,
      remake: true,
      playedAt: "2026-06-01T12:00:00.000Z",
    },
    {
      champion: "Ahri",
      win: true,
      kills: 9,
      remake: false,
      playedAt: "2026-05-01T12:00:00.000Z",
    },
  ];

  function recapStubs(overrides: ServiceStubs = {}): ServiceStubs {
    return {
      identity: { getLolAccounts: vi.fn().mockReturnValue([OWNER_ACCOUNT]) },
      lol: {
        getCachedMatches: vi.fn().mockResolvedValue({ matches: windowMatches }),
      } as unknown as Partial<LolService>,
      championAnalytics: {
        getChampionRecap: vi
          .fn()
          .mockResolvedValue({ totalGames: 226, winRate: 0.56, avgKda: 3.42 }),
      } as unknown as Partial<LolChampionAnalyticsService>,
      lifetimeTotals: {
        getLifetimeTotals: vi.fn().mockResolvedValue({
          lolMatchCount: 564,
          lolMinutes: 30_000,
          steamMinutes: 12_000,
        }),
      } as unknown as Partial<HomeLifetimeTotalsService>,
      ...overrides,
    };
  }

  function lastCardArgs(): {
    eyebrow: string;
    title: string;
    subtitle: string;
    accentHex: string;
    ridgeSvg: string;
    kpis: Array<{ label: string; value: string }>;
    threadLabel: string;
  } {
    const calls = renderRecapChapterCardMock.mock.calls;
    return calls[calls.length - 1]?.[0] as ReturnType<typeof lastCardArgs>;
  }

  it("throws NotFoundException when no primary owner account is configured", async () => {
    const service = makeService(
      recapStubs({ identity: { getLolAccounts: vi.fn().mockReturnValue([]) } })
    );
    await expect(service.generateRecapChapterCard("champion")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("seeds the ridge from the remake-filtered window, oldest first", async () => {
    const service = makeService(recapStubs());
    await service.generateRecapChapterCard("champion");
    const { ridgeSvg, threadLabel } = lastCardArgs();
    // 2 non-remake matches → 2 thread segments + 1 baseline.
    expect(ridgeSvg.match(/<line /g)).toHaveLength(3);
    // First thread segment carries the OLDEST match's champion (Ahri), not the
    // newest — pins the re-sort.
    const threadStrokes = [...ridgeSvg.matchAll(/stroke="(#[0-9a-f]{6})"/g)]
      .map((m) => m[1])
      .filter((hex) => hex !== "#ffffff");
    expect(threadStrokes[0]).toBe(championTheme("Ahri").dominantHex);
    expect(threadStrokes[1]).toBe(championTheme("Jinx").dominantHex);
    expect(threadLabel).toBe("2 games · May 2026 – Jul 2026");
  });

  it("composes the champion chapter from the Ahri recap", async () => {
    const service = makeService(recapStubs());
    await service.generateRecapChapterCard("champion");
    const args = lastCardArgs();
    expect(args.eyebrow).toBe("Vyoh's Ahri");
    expect(args.title).toBe("Ahri");
    expect(args.subtitle).toBe("the Nine-Tailed Fox");
    expect(args.accentHex).toBe(championTheme("Ahri").dominantHex);
    expect(args.kpis).toEqual([
      { label: "Games", value: "226" },
      { label: "Win rate", value: formatPercent(0.56) },
      { label: "Avg KDA", value: formatKda(3.42) },
    ]);
  });

  it("renders em-dashes when the champion recap window is empty", async () => {
    const service = makeService(
      recapStubs({
        championAnalytics: {
          getChampionRecap: vi
            .fn()
            .mockResolvedValue({ totalGames: 0, winRate: null, avgKda: null }),
        } as unknown as Partial<LolChampionAnalyticsService>,
      })
    );
    await service.generateRecapChapterCard("champion");
    expect(lastCardArgs().kpis).toEqual([
      { label: "Games", value: "0" },
      { label: "Win rate", value: "—" },
      { label: "Avg KDA", value: "—" },
    ]);
  });

  it("composes the conclusion chapter from lifetime totals", async () => {
    const service = makeService(recapStubs());
    await service.generateRecapChapterCard("conclusion");
    const args = lastCardArgs();
    expect(args.eyebrow).toBe("Vyoh's portrait");
    expect(args.title).toBe("Vyoh");
    expect(args.subtitle).toBe("the player");
    expect(args.accentHex).toBe("#f0c878");
    expect(args.kpis).toEqual([
      { label: "LoL matches", value: "564" },
      { label: "LoL time", value: formatPlaytimeFromSeconds(30_000 * 60) },
      { label: "Steam time", value: formatPlaytimeFromSeconds(12_000 * 60) },
    ]);
  });
});
