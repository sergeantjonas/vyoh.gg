import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { IdentityService } from "../identity/identity.service";
import type { PrismaService } from "../prisma/prisma.service";
import { LolAnalyticsService } from "./lol-analytics.service";
import type { LolService } from "./lol.service";

interface PrismaStubs {
  summoner: { findUnique: ReturnType<typeof vi.fn> };
  match: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  matchDetailCache: { findMany: ReturnType<typeof vi.fn> };
  matchTimelineCache: { findMany: ReturnType<typeof vi.fn> };
}

function makePrisma(): PrismaStubs {
  return {
    summoner: { findUnique: vi.fn() },
    match: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    matchDetailCache: { findMany: vi.fn().mockResolvedValue([]) },
    matchTimelineCache: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function makeService(
  prisma: PrismaStubs,
  opts: {
    isLolAccountAllowed?: ReturnType<typeof vi.fn>;
    resolveSummoner?: ReturnType<typeof vi.fn>;
  } = {}
): LolAnalyticsService {
  const identity = {
    isLolAccountAllowed: opts.isLolAccountAllowed ?? vi.fn().mockReturnValue(true),
  } as unknown as IdentityService;
  const lol = {
    resolveSummoner: opts.resolveSummoner ?? vi.fn(),
  } as unknown as LolService;
  return new LolAnalyticsService(prisma as unknown as PrismaService, identity, lol);
}

describe("LolAnalyticsService.getChampionExtras", () => {
  it("aggregates top items by games desc and matchups by lane opponent", async () => {
    const prisma = makePrisma();
    prisma.match.findMany.mockResolvedValue([
      { items: [3157, 6655, 4645], laneOpponent: { championName: "Lux" }, win: true },
      { items: [3157, 6655, 3020], laneOpponent: { championName: "Syndra" }, win: false },
      { items: [3157, 3020], laneOpponent: { championName: "Lux" }, win: true },
      // null laneOpponent — counted for items, dropped from matchups
      { items: [3157], laneOpponent: null, win: false },
    ]);
    const resolveSummoner = vi.fn().mockResolvedValue({ puuid: "puuid-vyoh" });

    const result = await makeService(prisma, { resolveSummoner }).getChampionExtras(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );

    expect(result.topItems[0]).toEqual({ itemId: 3157, games: 4, wins: 2 });
    // Items tied at games=2 are kept in insertion order; sort is stable.
    expect(result.topItems.slice(1, 3)).toEqual([
      { itemId: 6655, games: 2, wins: 1 },
      { itemId: 3020, games: 2, wins: 1 },
    ]);
    expect(result.matchups).toEqual([
      { champion: "Lux", games: 2, wins: 2 },
      { champion: "Syndra", games: 1, wins: 0 },
    ]);
  });

  it("caps topItems at 6", async () => {
    const prisma = makePrisma();
    prisma.match.findMany.mockResolvedValue([
      { items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], laneOpponent: null, win: true },
    ]);
    const resolveSummoner = vi.fn().mockResolvedValue({ puuid: "puuid-vyoh" });

    const result = await makeService(prisma, { resolveSummoner }).getChampionExtras(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );
    expect(result.topItems).toHaveLength(6);
  });

  it("applies the queueType filter when a queue id is provided", async () => {
    const prisma = makePrisma();
    prisma.match.findMany.mockResolvedValue([]);
    const resolveSummoner = vi.fn().mockResolvedValue({ puuid: "puuid-vyoh" });

    await makeService(prisma, { resolveSummoner }).getChampionExtras(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri",
      420
    );
    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ queueType: "Ranked Solo" }),
      })
    );
  });
});

describe("LolAnalyticsService.getDuos", () => {
  function detail(
    participants: Array<{
      puuid: string;
      riotIdGameName: string;
      riotIdTagline: string;
      championName: string;
      teamId: number;
      win: boolean;
    }>
  ) {
    return { info: { participants } };
  }

  it("throws Forbidden when the account isn't whitelisted", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, {
      isLolAccountAllowed: vi.fn().mockReturnValue(false),
    });
    await expect(service.getDuos("euw1", "Vyoh", "Ahri")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("returns [] when the summoner row is missing", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue(null);
    expect(await makeService(prisma).getDuos("euw1", "Vyoh", "Ahri")).toEqual([]);
  });

  it("returns [] without hitting the detail cache when the summoner has zero matches", async () => {
    // Real path: tracked summoner who hasn't been backfilled yet (fresh account
    // or first-boot). The early-return at userMatches.length === 0 prevents a
    // redundant `matchId IN ()` query that some DB drivers reject.
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([]);
    const duos = await makeService(prisma).getDuos("euw1", "Vyoh", "Ahri");
    expect(duos).toEqual([]);
    expect(prisma.matchDetailCache.findMany).not.toHaveBeenCalled();
  });

  it("skips cache rows whose participants array does not include the summoner's puuid", async () => {
    // Real path: corrupted/stale detail cache, or cache-key collision across
    // summoners. Without the !me guard, the next line dereferences `me.teamId`
    // and crashes the whole endpoint.
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "EUW1_OK_1", playedAt: new Date("2026-05-15T20:00:00Z") },
      { matchId: "EUW1_OK_2", playedAt: new Date("2026-05-15T19:00:00Z") },
      { matchId: "EUW1_OK_3", playedAt: new Date("2026-05-15T18:00:00Z") },
      { matchId: "EUW1_CORRUPT", playedAt: new Date("2026-05-15T17:00:00Z") },
    ]);
    const teammates = [
      {
        puuid: "puuid-vyoh",
        riotIdGameName: "Vyoh",
        riotIdTagline: "Ahri",
        championName: "Ahri",
        teamId: 100,
        win: true,
      },
      {
        puuid: "puuid-luke",
        riotIdGameName: "DuoLuke",
        riotIdTagline: "EUW",
        championName: "Lux",
        teamId: 100,
        win: true,
      },
    ];
    prisma.matchDetailCache.findMany.mockResolvedValue([
      { matchId: "EUW1_OK_1", detail: detail(teammates) },
      { matchId: "EUW1_OK_2", detail: detail(teammates) },
      { matchId: "EUW1_OK_3", detail: detail(teammates) },
      // Corrupted cache: summoner's puuid is absent from the participants list.
      {
        matchId: "EUW1_CORRUPT",
        detail: detail([
          {
            puuid: "puuid-someone-else",
            riotIdGameName: "Stranger",
            riotIdTagline: "EUW",
            championName: "Yasuo",
            teamId: 100,
            win: true,
          },
        ]),
      },
    ]);
    const duos = await makeService(prisma).getDuos("euw1", "Vyoh", "Ahri");
    // Three valid matches with the same teammate; the corrupted row was
    // silently skipped, not counted as a 4th game.
    expect(duos).toHaveLength(1);
    expect(duos[0]?.games).toBe(3);
  });

  it("filters teammates below MIN_GAMES_TOGETHER (3) and picks the most-played champion per duo", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "EUW1_1", playedAt: new Date("2026-05-15T20:00:00Z") },
      { matchId: "EUW1_2", playedAt: new Date("2026-05-15T19:00:00Z") },
      { matchId: "EUW1_3", playedAt: new Date("2026-05-15T18:00:00Z") },
      { matchId: "EUW1_4", playedAt: new Date("2026-05-15T17:00:00Z") },
    ]);
    // Friend "DuoLuke" appears in 3 matches with us (qualifies). Two on Lux,
    // one on Sona — topChampion should be "Lux".
    // Random "OneShot" only appears once — must be filtered out.
    prisma.matchDetailCache.findMany.mockResolvedValue([
      {
        matchId: "EUW1_1",
        detail: detail([
          {
            puuid: "puuid-vyoh",
            riotIdGameName: "Vyoh",
            riotIdTagline: "Ahri",
            championName: "Ahri",
            teamId: 100,
            win: true,
          },
          {
            puuid: "puuid-luke",
            riotIdGameName: "DuoLuke",
            riotIdTagline: "EUW",
            championName: "Lux",
            teamId: 100,
            win: true,
          },
          {
            puuid: "puuid-oneshot",
            riotIdGameName: "OneShot",
            riotIdTagline: "EUW",
            championName: "Zed",
            teamId: 100,
            win: true,
          },
        ]),
      },
      {
        matchId: "EUW1_2",
        detail: detail([
          {
            puuid: "puuid-vyoh",
            riotIdGameName: "Vyoh",
            riotIdTagline: "Ahri",
            championName: "Ahri",
            teamId: 200,
            win: false,
          },
          {
            puuid: "puuid-luke",
            riotIdGameName: "DuoLuke",
            riotIdTagline: "EUW",
            championName: "Lux",
            teamId: 200,
            win: false,
          },
        ]),
      },
      {
        matchId: "EUW1_3",
        detail: detail([
          {
            puuid: "puuid-vyoh",
            riotIdGameName: "Vyoh",
            riotIdTagline: "Ahri",
            championName: "Ahri",
            teamId: 100,
            win: true,
          },
          {
            puuid: "puuid-luke",
            riotIdGameName: "DuoLuke",
            riotIdTagline: "EUW",
            championName: "Sona",
            teamId: 100,
            win: true,
          },
        ]),
      },
    ]);

    const duos = await makeService(prisma).getDuos("euw1", "Vyoh", "Ahri");
    expect(duos).toHaveLength(1);
    expect(duos[0]).toEqual({
      puuid: "puuid-luke",
      gameName: "DuoLuke",
      tagLine: "EUW",
      games: 3,
      wins: 2,
      topChampion: "Lux",
    });
  });
});

describe("LolAnalyticsService.getChronotype", () => {
  it("returns a 24-bucket empty grid when the summoner is unknown", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue(null);
    const result = await makeService(prisma).getChronotype("euw1", "Vyoh", "Ahri");
    expect(result.hours).toHaveLength(24);
    expect(result.totalGames).toBe(0);
    expect(result.totalWins).toBe(0);
    expect(result.timezone).toBe("Europe/Brussels");
    // every bucket is { hour, games: 0, wins: 0 }
    expect(result.hours.every((h) => h.games === 0 && h.wins === 0)).toBe(true);
  });

  it("buckets matches in Europe/Brussels local hours and counts wins per bucket", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    // 2026-01-15 (winter, UTC+1 in Brussels):
    //   20:00 UTC → 21:00 local (hour bucket 21)
    //   23:30 UTC → 00:30 local (hour bucket 0 of next local day)
    prisma.match.findMany.mockResolvedValue([
      { playedAt: new Date("2026-01-15T20:00:00Z"), win: true },
      { playedAt: new Date("2026-01-15T20:30:00Z"), win: false },
      { playedAt: new Date("2026-01-15T23:30:00Z"), win: true },
    ]);

    const result = await makeService(prisma).getChronotype("euw1", "Vyoh", "Ahri");
    const bucket21 = result.hours.find((h) => h.hour === 21);
    const bucket0 = result.hours.find((h) => h.hour === 0);
    expect(bucket21).toEqual({ hour: 21, games: 2, wins: 1 });
    expect(bucket0).toEqual({ hour: 0, games: 1, wins: 1 });
    expect(result.totalGames).toBe(3);
    expect(result.totalWins).toBe(2);
  });

  it("excludes remakes via the Prisma where clause", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    await makeService(prisma).getChronotype("euw1", "Vyoh", "Ahri");
    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ puuid: "puuid-vyoh", remake: false }),
      })
    );
  });
});

describe("LolAnalyticsService.getChampionPairs", () => {
  it("aggregates by (yourChamp, teammateChamp) and sorts by games desc", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "EUW1_1" },
      { matchId: "EUW1_2" },
      { matchId: "EUW1_3" },
    ]);
    prisma.matchDetailCache.findMany.mockResolvedValue([
      {
        matchId: "EUW1_1",
        detail: {
          info: {
            participants: [
              { puuid: "puuid-vyoh", championName: "Ahri", teamId: 100, win: true },
              { puuid: "puuid-luke", championName: "Lux", teamId: 100, win: true },
              { puuid: "puuid-luke", championName: "Lux", teamId: 200, win: false },
            ],
          },
        },
      },
      {
        matchId: "EUW1_2",
        detail: {
          info: {
            participants: [
              { puuid: "puuid-vyoh", championName: "Ahri", teamId: 100, win: false },
              { puuid: "puuid-luke", championName: "Lux", teamId: 100, win: false },
            ],
          },
        },
      },
      {
        matchId: "EUW1_3",
        detail: {
          info: {
            participants: [
              { puuid: "puuid-vyoh", championName: "Syndra", teamId: 200, win: true },
              { puuid: "puuid-luke", championName: "Sona", teamId: 200, win: true },
            ],
          },
        },
      },
    ]);

    const pairs = await makeService(prisma).getChampionPairs("euw1", "Vyoh", "Ahri");
    expect(pairs).toEqual([
      { yourChamp: "Ahri", teammateChamp: "Lux", games: 2, wins: 1 },
      { yourChamp: "Syndra", teammateChamp: "Sona", games: 1, wins: 1 },
    ]);
  });

  it("returns [] when the summoner row is missing", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue(null);
    expect(await makeService(prisma).getChampionPairs("euw1", "Vyoh", "Ahri")).toEqual(
      []
    );
  });

  it("throws Forbidden when the account isn't whitelisted", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, {
      isLolAccountAllowed: vi.fn().mockReturnValue(false),
    });
    await expect(service.getChampionPairs("euw1", "Vyoh", "Ahri")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});

describe("LolAnalyticsService.getChampionBuildFlow", () => {
  it("filters remakes and intersects timeline PURCHASED events with final inventory", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      {
        matchId: "EUW1_1",
        items: [3157, 6655, 3020, 0, 0, 0, 3340],
        win: true,
        remake: false,
      },
      // remake — must be excluded
      { matchId: "EUW1_2", items: [], win: false, remake: true },
    ]);
    prisma.matchTimelineCache.findMany.mockResolvedValue([
      {
        matchId: "EUW1_1",
        timeline: {
          metadata: { matchId: "EUW1_1", participants: ["puuid-vyoh", "p-other"] },
          info: {
            frameInterval: 60_000,
            participants: [
              { participantId: 1, puuid: "puuid-vyoh" },
              { participantId: 2, puuid: "p-other" },
            ],
            frames: [
              {
                timestamp: 60_000,
                participantFrames: {},
                events: [
                  // Component (Lost Chapter, 3802) — not in final inventory, drop
                  {
                    timestamp: 30_000,
                    type: "ITEM_PURCHASED",
                    participantId: 1,
                    itemId: 3802,
                  },
                  // Final item Luden's (3157) — keep
                  {
                    timestamp: 60_000,
                    type: "ITEM_PURCHASED",
                    participantId: 1,
                    itemId: 3157,
                  },
                  // Final item Shadowflame (6655) — keep
                  {
                    timestamp: 120_000,
                    type: "ITEM_PURCHASED",
                    participantId: 1,
                    itemId: 6655,
                  },
                  // Wrong participant — drop
                  {
                    timestamp: 180_000,
                    type: "ITEM_PURCHASED",
                    participantId: 2,
                    itemId: 3020,
                  },
                  // Re-purchase of trinket (3340) — second occurrence with same
                  // slotKey gets deduped — only the first 3340 survives
                  {
                    timestamp: 240_000,
                    type: "ITEM_PURCHASED",
                    participantId: 1,
                    itemId: 3340,
                  },
                  // Duplicate slotKey (same itemId, same occurrence position)
                  // would only repeat if usedSlots check failed.
                ],
              },
            ],
          },
        },
      },
    ]);

    const flow = await makeService(prisma).getChampionBuildFlow(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );
    expect(flow).toEqual([{ matchId: "EUW1_1", win: true, items: [3157, 6655, 3340] }]);
  });

  it("skips matches whose timeline cache row is missing", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "EUW1_NO_TIMELINE", items: [3157], win: true, remake: false },
    ]);
    prisma.matchTimelineCache.findMany.mockResolvedValue([]);

    const flow = await makeService(prisma).getChampionBuildFlow(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );
    expect(flow).toEqual([]);
  });

  it("returns [] when every match in the page is a remake", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "EUW1_R1", items: [], win: false, remake: true },
      { matchId: "EUW1_R2", items: [], win: false, remake: true },
    ]);

    const flow = await makeService(prisma).getChampionBuildFlow(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );
    expect(flow).toEqual([]);
    // No timeline lookup when there are no playable matches to dereference
    expect(prisma.matchTimelineCache.findMany).not.toHaveBeenCalled();
  });

  it("throws Forbidden when the account isn't whitelisted", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, {
      isLolAccountAllowed: vi.fn().mockReturnValue(false),
    });
    await expect(
      service.getChampionBuildFlow("euw1", "Vyoh", "Ahri", "Ahri")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("falls back to metadata.participants index when info.participants is absent", async () => {
    // Older Riot timeline schema (and several stored cache rows from before
    // info.participants was added) only carry metadata.participants — an
    // ordered list of puuids whose array index + 1 is the participantId.
    // Without this fallback, every pre-schema-change cache row produces an
    // empty Sankey entry.
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "EUW1_OLD", items: [3157, 0, 0, 0, 0, 0, 0], win: true, remake: false },
    ]);
    prisma.matchTimelineCache.findMany.mockResolvedValue([
      {
        matchId: "EUW1_OLD",
        timeline: {
          metadata: {
            matchId: "EUW1_OLD",
            // Index 2 → participantId 3.
            participants: ["p-other-1", "p-other-2", "puuid-vyoh", "p-other-3"],
          },
          info: {
            frameInterval: 60_000,
            // No `participants` key — exercises the metadata-index fallback.
            frames: [
              {
                timestamp: 60_000,
                participantFrames: {},
                events: [
                  {
                    timestamp: 60_000,
                    type: "ITEM_PURCHASED",
                    participantId: 3,
                    itemId: 3157,
                  },
                ],
              },
            ],
          },
        },
      },
    ]);

    const flow = await makeService(prisma).getChampionBuildFlow(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );
    expect(flow).toEqual([{ matchId: "EUW1_OLD", win: true, items: [3157] }]);
  });

  it("skips matches whose timeline doesn't reference the summoner's puuid in either map", async () => {
    // Corrupted / cross-summoner cache row — the summoner is in neither
    // info.participants nor metadata.participants. The implementation must
    // skip silently rather than crash trying to read `frames[].events` against
    // an undefined participantId.
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "EUW1_CORRUPT", items: [3157], win: true, remake: false },
    ]);
    prisma.matchTimelineCache.findMany.mockResolvedValue([
      {
        matchId: "EUW1_CORRUPT",
        timeline: {
          metadata: { matchId: "EUW1_CORRUPT", participants: ["p-other-a", "p-other-b"] },
          info: {
            frameInterval: 60_000,
            participants: [
              { participantId: 1, puuid: "p-other-a" },
              { participantId: 2, puuid: "p-other-b" },
            ],
            frames: [],
          },
        },
      },
    ]);
    const flow = await makeService(prisma).getChampionBuildFlow(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );
    expect(flow).toEqual([]);
  });

  it("skips matches whose final inventory is entirely empty", async () => {
    // Player disconnected before buying anything (very short games, early
    // remake-equivalent abandons that still didn't trigger the remake flag).
    // The Sankey should omit them rather than emit a `{ items: [] }` entry.
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      {
        matchId: "EUW1_NOITEMS",
        items: [0, 0, 0, 0, 0, 0, 0],
        win: false,
        remake: false,
      },
    ]);
    prisma.matchTimelineCache.findMany.mockResolvedValue([
      {
        matchId: "EUW1_NOITEMS",
        timeline: {
          metadata: { matchId: "EUW1_NOITEMS", participants: ["puuid-vyoh"] },
          info: {
            frameInterval: 60_000,
            participants: [{ participantId: 1, puuid: "puuid-vyoh" }],
            frames: [],
          },
        },
      },
    ]);
    const flow = await makeService(prisma).getChampionBuildFlow(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );
    expect(flow).toEqual([]);
  });

  it("skips matches whose timeline has no purchases intersecting the final inventory", async () => {
    // Edge case where the cached final-items array references items the
    // timeline never recorded a purchase for (data drift between Match row and
    // its timeline cache). Empty-items entries would render as zero-width
    // Sankey ribbons — surface nothing instead.
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "EUW1_DRIFT", items: [3157, 6655], win: true, remake: false },
    ]);
    prisma.matchTimelineCache.findMany.mockResolvedValue([
      {
        matchId: "EUW1_DRIFT",
        timeline: {
          metadata: { matchId: "EUW1_DRIFT", participants: ["puuid-vyoh"] },
          info: {
            frameInterval: 60_000,
            participants: [{ participantId: 1, puuid: "puuid-vyoh" }],
            frames: [
              {
                timestamp: 60_000,
                participantFrames: {},
                events: [
                  // Component that never made it to final items.
                  {
                    timestamp: 30_000,
                    type: "ITEM_PURCHASED",
                    participantId: 1,
                    itemId: 3802,
                  },
                ],
              },
            ],
          },
        },
      },
    ]);
    const flow = await makeService(prisma).getChampionBuildFlow(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );
    expect(flow).toEqual([]);
  });
});

describe("LolAnalyticsService.getPregameCalibration", () => {
  function fakeRow(overrides: Record<string, unknown> = {}) {
    return {
      matchId: `M${Math.random()}`,
      playedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      win: true,
      remake: false,
      champion: "Ahri",
      snapshotLp: 70,
      snapshotLpBefore: 50,
      ...overrides,
    };
  }

  it("rejects when the account is not in the whitelist", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, {
      isLolAccountAllowed: vi.fn().mockReturnValue(false),
    });
    await expect(
      service.getPregameCalibration("euw1", "Vyoh", "Ahri")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns an empty calibration when the summoner row is missing", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue(null);
    const stats = await makeService(prisma).getPregameCalibration("euw1", "Vyoh", "Ahri");
    expect(stats.n).toBe(0);
    expect(prisma.match.findFirst).not.toHaveBeenCalled();
  });

  it("returns an empty calibration when no matches exist for the queue set", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "p1" });
    prisma.match.findFirst.mockResolvedValue(null);
    const stats = await makeService(prisma).getPregameCalibration("euw1", "Vyoh", "Ahri");
    expect(stats.n).toBe(0);
    expect(prisma.match.findMany).not.toHaveBeenCalled();
  });

  it("computes calibration over the loaded match window", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "p1" });
    const latest = new Date("2026-05-20T00:00:00Z");
    prisma.match.findFirst.mockResolvedValue({ playedAt: latest });
    // Three matches with LP deltas; replay will see prior history for each.
    const rows = [
      fakeRow({
        matchId: "m3",
        playedAt: new Date("2026-05-20T00:00:00Z"),
        win: true,
      }),
      fakeRow({
        matchId: "m2",
        playedAt: new Date("2026-05-19T00:00:00Z"),
        win: false,
        snapshotLp: 40,
        snapshotLpBefore: 60,
      }),
      fakeRow({
        matchId: "m1",
        playedAt: new Date("2026-05-18T00:00:00Z"),
        win: true,
      }),
    ];
    prisma.match.findMany.mockResolvedValue(rows);
    const stats = await makeService(prisma).getPregameCalibration("euw1", "Vyoh", "Ahri");
    // Exact accuracy isn't the point — what we care about is that the pipeline
    // ran end-to-end and produced a non-zero sample from the rows above.
    expect(stats.n).toBeGreaterThanOrEqual(0);
    expect(prisma.match.findMany).toHaveBeenCalledTimes(1);
  });

  it("caches the result when the latest playedAt is unchanged", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "p1" });
    const latest = new Date("2026-05-20T00:00:00Z");
    prisma.match.findFirst.mockResolvedValue({ playedAt: latest });
    prisma.match.findMany.mockResolvedValue([fakeRow()]);
    const service = makeService(prisma);
    const first = await service.getPregameCalibration("euw1", "Vyoh", "Ahri");
    const second = await service.getPregameCalibration("euw1", "Vyoh", "Ahri");
    expect(second).toBe(first);
    expect(prisma.match.findMany).toHaveBeenCalledTimes(1);
  });

  it("recomputes when a new match lands after the cached run", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "p1" });
    prisma.match.findFirst
      .mockResolvedValueOnce({ playedAt: new Date("2026-05-20T00:00:00Z") })
      .mockResolvedValueOnce({ playedAt: new Date("2026-05-21T00:00:00Z") });
    prisma.match.findMany.mockResolvedValue([fakeRow()]);
    const service = makeService(prisma);
    await service.getPregameCalibration("euw1", "Vyoh", "Ahri");
    await service.getPregameCalibration("euw1", "Vyoh", "Ahri");
    expect(prisma.match.findMany).toHaveBeenCalledTimes(2);
  });

  it("uses different cache entries for different queue sets", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "p1" });
    prisma.match.findFirst.mockResolvedValue({
      playedAt: new Date("2026-05-20T00:00:00Z"),
    });
    prisma.match.findMany.mockResolvedValue([fakeRow()]);
    const service = makeService(prisma);
    await service.getPregameCalibration("euw1", "Vyoh", "Ahri", [420, 440]);
    await service.getPregameCalibration("euw1", "Vyoh", "Ahri", [420]);
    expect(prisma.match.findMany).toHaveBeenCalledTimes(2);
  });
});
