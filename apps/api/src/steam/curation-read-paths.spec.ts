import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { SteamCurationSets } from "@vyoh/shared";
import { NO_CURATION } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "../auth/auth.service";
import type { PrismaService } from "../prisma/prisma.service";
import { SteamAchievementsService } from "./achievements.service";
import { SteamGameCurationService } from "./game-curation.service";
import { SteamGameRecapService } from "./game-recap.service";
import { SteamOwnedGamesService } from "./owned-games.service";
import { SteamPlayerStateService } from "./player-state.service";
import { SteamPortraitService } from "./portrait.service";
import { SteamChronotypeService } from "./steam-chronotype.service";
import { SteamController } from "./steam.controller";
import { SteamService } from "./steam.service";
import { SteamTagService } from "./tag.service";
import { SteamUpcomingService } from "./upcoming.service";
import { SteamWishlistHeroService } from "./wishlist-hero.service";

// One spec for the read paths a hidden game must not reach, rather than a
// scattering of additions across seven service specs. Each service's own spec
// still owns its behaviour; what is asserted here is the single invariant that
// cuts across all of them — a hidden appid never appears in a response, and the
// same call with `NO_CURATION` proves the test is exercising the filter rather
// than an empty fixture.

const HIDDEN = 1091500;
const VISIBLE = 570;

function curation(hidden: number[] = [HIDDEN]): SteamCurationSets {
  return { hidden: new Set(hidden), unfeatured: new Set() };
}

const SNAPSHOT_DATE = new Date("2026-08-20T00:00:00Z");

function snapshotRow(appid: number, name: string) {
  return {
    appid,
    playtimeForeverMinutes: 600,
    playtime2WeeksMinutes: 60,
    game: { name, rtimeLastPlayed: SNAPSHOT_DATE },
  };
}

describe("getOwnedGames", () => {
  function service(): {
    svc: SteamOwnedGamesService;
    enrichment: ReturnType<typeof vi.fn>;
  } {
    const enrichment = vi.fn().mockResolvedValue([]);
    const prisma = {
      steamPlaytimeSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ snapshotDate: SNAPSHOT_DATE }),
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            snapshotRow(HIDDEN, "Something Private"),
            snapshotRow(VISIBLE, "Dota 2"),
          ])
          .mockResolvedValue([]),
      },
      steamGameEnrichment: { findMany: enrichment },
    } as unknown as PrismaService;

    return {
      svc: new SteamOwnedGamesService(
        prisma,
        ...([{}, {}, {}, {}, {}] as never as [never, never, never, never, never])
      ),
      enrichment,
    };
  }

  it("omits a hidden game from the library", async () => {
    const { svc } = service();
    const { games } = await svc.getOwnedGames(curation());
    expect(games.map((g) => g.appid)).toEqual([VISIBLE]);
  });

  it("returns it when nothing is hidden, so the filter is what did the work", async () => {
    const { svc } = service();
    const { games } = await svc.getOwnedGames(NO_CURATION);
    expect(games.map((g) => g.appid)).toEqual([HIDDEN, VISIBLE]);
  });

  // The response carries art paths and a 30-day series per game. Filtering
  // before those queries is what keeps a hidden game out of them entirely,
  // rather than fetching its assets and then dropping the row.
  it("never queries enrichment for a hidden appid", async () => {
    const { svc, enrichment } = service();
    await svc.getOwnedGames(curation());
    expect(enrichment.mock.calls[0]?.[0]?.where?.appid?.in).toEqual([VISIBLE]);
  });
});

describe("getOwnerWishlist", () => {
  function service() {
    const client = {
      getWishlist: vi.fn().mockResolvedValue([
        { appid: HIDDEN, date_added: 1, priority: 0 },
        { appid: VISIBLE, date_added: 2, priority: 0 },
      ]),
      getStoreItems: vi.fn().mockResolvedValue([]),
      getStoreItemsFull: vi.fn().mockResolvedValue([]),
    };
    const prisma = {
      steamGameEnrichment: { findMany: vi.fn().mockResolvedValue([]) },
      steamOwnedGame: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    return new SteamService(client as never, prisma);
  }

  it("omits a hidden appid", async () => {
    const { items } = await service().getOwnerWishlist(curation());
    expect(items.map((i) => i.appid)).toEqual([VISIBLE]);
  });

  it("includes it with no curation", async () => {
    const { items } = await service().getOwnerWishlist(NO_CURATION);
    expect(items.map((i) => i.appid)).toEqual([HIDDEN, VISIBLE]);
  });
});

describe("upcoming", () => {
  function service(hidden: number[]) {
    const steam = {
      getOwnerWishlist: vi.fn().mockImplementation(async () => ({
        steamId: "1",
        items: [],
        fetchedAt: 0,
      })),
      isWishlisted: vi.fn().mockResolvedValue(true),
    } as unknown as SteamService;
    const prisma = {
      steamGameEnrichment: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ appid: HIDDEN, releaseDate: SNAPSHOT_DATE }]),
        findFirst: vi.fn().mockResolvedValue({ appid: HIDDEN }),
      },
      steamOwnedGame: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { appid: HIDDEN, name: "Something Private", firstSeenAt: SNAPSHOT_DATE },
          ]),
        findFirst: vi.fn().mockResolvedValue({ appid: HIDDEN }),
      },
    } as unknown as PrismaService;
    return { svc: new SteamUpcomingService(steam, prisma), hidden };
  }

  it("omits a hidden pre-order from the calendar", async () => {
    const { svc } = service([HIDDEN]);
    const { items } = await svc.getUpcoming(curation());
    expect(items).toEqual([]);
  });

  it("lists that same pre-order when it isn't hidden", async () => {
    const { svc } = service([]);
    const { items } = await svc.getUpcoming(NO_CURATION);
    expect(items.map((i) => i.appid)).toEqual([HIDDEN]);
  });

  // The membership guard is what stands in front of the per-appid hero-meta
  // route, so a hidden appid has to read as "not in the set" — the same answer
  // an appid the owner never tracked gets.
  it("reports a hidden appid as outside the upcoming set", async () => {
    const { svc } = service([HIDDEN]);
    expect(await svc.membershipOf(HIDDEN, curation())).toBeNull();
    expect(await svc.membershipOf(HIDDEN, NO_CURATION)).toBe("owned");
  });
});

describe("achievements feeds", () => {
  function service() {
    const unlockFindMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      steamPlayerUnlock: {
        findMany: unlockFindMany,
        groupBy: vi.fn().mockResolvedValue([
          {
            appid: HIDDEN,
            _count: { apiName: 3 },
            _max: { unlockedAt: SNAPSHOT_DATE },
          },
        ]),
      },
      steamGameAchievement: {
        groupBy: vi.fn().mockResolvedValue([
          { appid: HIDDEN, _count: { apiName: 10 } },
          { appid: VISIBLE, _count: { apiName: 5 } },
        ]),
      },
    } as unknown as PrismaService;
    return { svc: new SteamAchievementsService(prisma), unlockFindMany };
  }

  // The cap has to apply to visible rows, not to rows-then-filtered — a feed
  // asked for ten and handed back eight leaks that two were withheld.
  it("excludes hidden appids in the query, so the limit still fills", async () => {
    const { svc, unlockFindMany } = service();
    await svc.getRecentUnlocks(10, curation());
    expect(unlockFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { appid: { notIn: [HIDDEN] } },
      take: 10,
    });
  });

  it("does the same for the rarest feed, keeping its own rarity filter", async () => {
    const { svc, unlockFindMany } = service();
    await svc.getCrossGameRarest(5, curation());
    expect(unlockFindMany.mock.calls[0]?.[0]?.where).toMatchObject({
      appid: { notIn: [HIDDEN] },
      achievement: { rarity: { isNot: null } },
    });
  });

  it("passes an empty exclusion list when nothing is hidden", async () => {
    const { svc, unlockFindMany } = service();
    await svc.getRecentUnlocks(10, NO_CURATION);
    expect(unlockFindMany.mock.calls[0]?.[0]?.where?.appid?.notIn).toEqual([]);
  });

  // An appid with no name beside it is still identity: it resolves to a store
  // page.
  it("drops a hidden appid from library completion", async () => {
    const { svc } = service();
    const { stats } = await svc.getLibraryCompletion(curation());
    expect(stats.map((s) => s.appid)).toEqual([VISIBLE]);

    const all = await svc.getLibraryCompletion(NO_CURATION);
    expect(all.stats.map((s) => s.appid)).toEqual([HIDDEN, VISIBLE]);
  });
});

describe("per-app routes", () => {
  async function controller(hidden: number[]) {
    const called = vi.fn().mockResolvedValue({ ok: true });
    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [
        { provide: SteamService, useValue: {} },
        {
          provide: SteamOwnedGamesService,
          useValue: { getGameDescription: called, getGameScreenshots: called },
        },
        { provide: SteamTagService, useValue: {} },
        {
          provide: SteamAchievementsService,
          useValue: { getGameAchievements: called, getUnlockTimeline: called },
        },
        { provide: SteamGameRecapService, useValue: {} },
        { provide: SteamPlayerStateService, useValue: {} },
        { provide: SteamChronotypeService, useValue: {} },
        { provide: SteamWishlistHeroService, useValue: {} },
        { provide: SteamUpcomingService, useValue: {} },
        { provide: SteamPortraitService, useValue: {} },
        {
          provide: SteamGameCurationService,
          useValue: {
            getCurationFor: vi.fn(async (isOwner: boolean) =>
              isOwner ? NO_CURATION : curation(hidden)
            ),
          },
        },
        { provide: AuthService, useValue: {} },
      ],
    }).compile();
    return { controller: moduleRef.get(SteamController), called };
  }

  // NotFound rather than an empty payload: "this game has no achievements" is
  // both false and a tell, while a 404 is the same answer an untracked appid
  // already gets.
  it("404s each per-app route for a visitor asking about a hidden appid", async () => {
    const { controller: c, called } = await controller([HIDDEN]);
    for (const call of [
      () => c.getGameAchievements(HIDDEN, false),
      () => c.getGameDescription(HIDDEN, false),
      () => c.getGameScreenshots(HIDDEN, false),
      () => c.getUnlockTimeline(HIDDEN, false),
    ]) {
      await expect(call()).rejects.toBeInstanceOf(NotFoundException);
    }
    expect(called).not.toHaveBeenCalled();
  });

  it("serves the owner the same routes", async () => {
    const { controller: c, called } = await controller([HIDDEN]);
    await expect(c.getGameAchievements(HIDDEN, true)).resolves.toEqual({ ok: true });
    expect(called).toHaveBeenCalledWith(HIDDEN);
  });

  it("leaves a visible appid alone for everyone", async () => {
    const { controller: c } = await controller([HIDDEN]);
    await expect(c.getGameDescription(VISIBLE, false)).resolves.toEqual({ ok: true });
  });
});

describe("the live now-playing surfaces", () => {
  function stateService(currentAppid: number | null) {
    const prisma = {
      steamPlayerState: {
        findUnique: vi.fn().mockResolvedValue({
          steamId: "76561198020053778",
          personaName: "Vyoh",
          avatarUrl: "https://avatar",
          personaState: "online",
          profileVisibility: 3,
          currentAppid,
          currentGameName: "Something Private",
          lastPolledAt: SNAPSHOT_DATE,
        }),
      },
      steamPlaytimeSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ playtimeForeverMinutes: 4_000 }),
      },
    } as unknown as PrismaService;
    return new SteamPlayerStateService(prisma, ...([{}, {}] as never as [never, never]));
  }

  // "Playing something private" would announce, at the exact moment it is
  // happening, that there is something to hide — a worse tell than the title.
  // So the session reads as no session, and the owner reads as merely online.
  it("reports no current game while the owner plays a hidden one", async () => {
    const state = await stateService(HIDDEN).getPlayerState(curation());
    expect(state?.currentGame).toBeNull();
    expect(state?.personaState).toBe("online");
  });

  it("does not leak the hidden game's playtime either", async () => {
    const state = await stateService(HIDDEN).getPlayerState(curation());
    expect(state?.currentGamePlaytimeForeverMinutes).toBeNull();
  });

  it("shows it to the owner", async () => {
    const state = await stateService(HIDDEN).getPlayerState(NO_CURATION);
    expect(state?.currentGame).toEqual({ appid: HIDDEN, name: "Something Private" });
    expect(state?.currentGamePlaytimeForeverMinutes).toBe(4_000);
  });

  it("leaves a visible session alone", async () => {
    const state = await stateService(VISIBLE).getPlayerState(curation());
    expect(state?.currentGame?.appid).toBe(VISIBLE);
  });

  // `/summary` calls Steam per request rather than reading the poller's row, so
  // it is a second, independent copy of the same leak. Both have to suppress or
  // the two surfaces disagree about the same moment.
  it("suppresses the live summary's currentGame as well", async () => {
    const client = {
      getPlayerSummary: vi.fn().mockResolvedValue({
        steamid: "76561198020053778",
        personaname: "Vyoh",
        avatarfull: "https://avatar",
        personastate: 1,
        communityvisibilitystate: 3,
        profileurl: "https://profile",
        gameid: String(HIDDEN),
        gameextrainfo: "Something Private",
      }),
      getProfileItemsEquipped: vi.fn().mockResolvedValue(null),
      getSteamLevel: vi.fn().mockResolvedValue(null),
      getSteamLevelDistribution: vi.fn().mockResolvedValue(null),
    };
    const svc = new SteamService(client as never, {} as PrismaService);

    expect((await svc.getOwnerSummary(curation())).currentGame).toBeNull();
    expect((await svc.getOwnerSummary(NO_CURATION)).currentGame).toEqual({
      appid: HIDDEN,
      name: "Something Private",
    });
  });
});
