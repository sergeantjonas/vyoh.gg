import { NotFoundException } from "@nestjs/common";
import type { MatchDetail, ParticipantDetail, SteamGameRecap } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import type { IdentityService } from "../identity/identity.service";
import type { LolImageService } from "../img/lol-image.service";
import type { SteamImageService } from "../img/steam-image.service";
import type { LolService } from "../lol/lol.service";
import type { PrismaService } from "../prisma/prisma.service";
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
vi.mock("./og-card", () => ({
  renderMatchCard: (args: unknown) => renderMatchCardMock(args),
  renderChampionCard: (args: unknown) => renderChampionCardMock(args),
  renderProfileCard: (args: unknown) => renderProfileCardMock(args),
  renderHomeCard: (args: unknown) => renderHomeCardMock(args),
  renderSteamGameCard: (args: unknown) => renderSteamGameCardMock(args),
}));

interface ServiceStubs {
  lol?: Partial<LolService>;
  identity?: Partial<IdentityService>;
  lolImage?: Partial<LolImageService>;
  steamImage?: Partial<SteamImageService>;
  prisma?: Partial<PrismaService>;
  steamGameRecap?: Partial<SteamGameRecapService>;
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
    queueType: "Ranked Solo",
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
    (stubs.steamGameRecap ?? {}) as unknown as SteamGameRecapService
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
      queueType: "Ranked Solo",
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
      queueType: "Ranked Solo",
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
