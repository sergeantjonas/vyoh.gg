import { ForbiddenException } from "@nestjs/common";
import { CHAMPION_DETAIL_WINDOW } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import type { IdentityService } from "../identity/identity.service";
import type { PrismaService } from "../prisma/prisma.service";
import { LolChampionAnalyticsService } from "./lol-champion-analytics.service";
import type { LolService } from "./lol.service";

interface PrismaStubs {
  summoner: { findUnique: ReturnType<typeof vi.fn> };
  match: { findMany: ReturnType<typeof vi.fn> };
  matchDetailCache: { findMany: ReturnType<typeof vi.fn> };
  matchTimelineCache: { findMany: ReturnType<typeof vi.fn> };
}

function makePrisma(): PrismaStubs {
  return {
    summoner: { findUnique: vi.fn() },
    match: { findMany: vi.fn().mockResolvedValue([]) },
    matchDetailCache: { findMany: vi.fn().mockResolvedValue([]) },
    matchTimelineCache: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function makeService(
  prisma: PrismaStubs,
  opts: {
    isLolAccountAllowed?: ReturnType<typeof vi.fn>;
    resolveSummoner?: ReturnType<typeof vi.fn>;
    getCachedMatches?: ReturnType<typeof vi.fn>;
  } = {}
): LolChampionAnalyticsService {
  const identity = {
    isLolAccountAllowed: opts.isLolAccountAllowed ?? vi.fn().mockReturnValue(true),
  } as unknown as IdentityService;
  const lol = {
    resolveSummoner: opts.resolveSummoner ?? vi.fn(),
    getCachedMatches:
      opts.getCachedMatches ?? vi.fn().mockResolvedValue({ matches: [], total: 0 }),
  } as unknown as LolService;
  return new LolChampionAnalyticsService(
    prisma as unknown as PrismaService,
    identity,
    lol
  );
}

describe("LolChampionAnalyticsService.getChampionExtras", () => {
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

  it("computes the detail and overall aggregates over the queue-scoped window", async () => {
    const prisma = makePrisma();
    const resolveSummoner = vi.fn().mockResolvedValue({ puuid: "puuid-vyoh" });
    const summary = (over: {
      matchId: string;
      champion: string;
      queueId: number;
      win: boolean;
    }) => ({
      kills: 5,
      deaths: 3,
      assists: 7,
      durationSec: 1800,
      playedAt: "2026-09-01T00:00:00.000Z",
      remake: false,
      teamPosition: "MIDDLE",
      gameVersion: "16.17",
      ...over,
    });
    const getCachedMatches = vi.fn().mockResolvedValue({
      total: 3,
      matches: [
        summary({ matchId: "1", champion: "Ahri", queueId: 420, win: true }),
        summary({ matchId: "2", champion: "Ahri", queueId: 450, win: false }),
        summary({ matchId: "3", champion: "Lux", queueId: 440, win: false }),
      ],
    });

    const result = await makeService(prisma, {
      resolveSummoner,
      getCachedMatches,
    }).getChampionExtras("euw1", "Vyoh", "Ahri", "Ahri", [420, 440]);

    expect(getCachedMatches).toHaveBeenCalledWith(
      "euw1",
      "Vyoh",
      "Ahri",
      0,
      CHAMPION_DETAIL_WINDOW
    );
    // The ARAM game is outside the requested queues on both aggregates.
    expect(result.detail).toMatchObject({ champion: "Ahri", games: 1, wins: 1 });
    expect(result.overall).toMatchObject({ games: 2, wins: 1, winRate: 0.5 });
  });

  it("answers a null detail for a champion with no matches in the window", async () => {
    const prisma = makePrisma();
    const resolveSummoner = vi.fn().mockResolvedValue({ puuid: "puuid-vyoh" });
    const result = await makeService(prisma, { resolveSummoner }).getChampionExtras(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );
    expect(result.detail).toBeNull();
    expect(result.overall.games).toBe(0);
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

  it("applies a queueId `in` filter when queue ids are provided", async () => {
    const prisma = makePrisma();
    prisma.match.findMany.mockResolvedValue([]);
    const resolveSummoner = vi.fn().mockResolvedValue({ puuid: "puuid-vyoh" });

    await makeService(prisma, { resolveSummoner }).getChampionExtras(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri",
      [420, 440]
    );
    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          queueId: { in: [420, 440] },
        }),
      })
    );
  });

  it("omits the queue filter when queue ids are empty or undefined", async () => {
    const prisma = makePrisma();
    prisma.match.findMany.mockResolvedValue([]);
    const resolveSummoner = vi.fn().mockResolvedValue({ puuid: "puuid-vyoh" });

    await makeService(prisma, { resolveSummoner }).getChampionExtras(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri",
      []
    );
    const call = prisma.match.findMany.mock.calls[0]?.[0];
    expect(call?.where).not.toHaveProperty("queueId");
  });

  // `items: { isEmpty: false }` in the where clause does not stand in for the
  // remake filter: a remake can run long enough for a first back, so it
  // arrives with items and a win flag. Before the 2026-07-26 fix these rows
  // counted toward both aggregations.
  it("excludes remakes from both item and matchup aggregation", async () => {
    const prisma = makePrisma();
    prisma.match.findMany.mockResolvedValue([
      { items: [3157], laneOpponent: { championName: "Lux" }, win: true, remake: false },
      { items: [3157], laneOpponent: { championName: "Lux" }, win: true, remake: true },
      { items: [3020], laneOpponent: { championName: "Zed" }, win: false, remake: true },
    ]);
    const resolveSummoner = vi.fn().mockResolvedValue({ puuid: "puuid-vyoh" });

    const result = await makeService(prisma, { resolveSummoner }).getChampionExtras(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );

    expect(result.topItems).toEqual([{ itemId: 3157, games: 1, wins: 1 }]);
    expect(result.matchups).toEqual([{ champion: "Lux", games: 1, wins: 1 }]);
  });

  it("selects the remake column so the filter has something to read", async () => {
    const prisma = makePrisma();
    prisma.match.findMany.mockResolvedValue([]);
    const resolveSummoner = vi.fn().mockResolvedValue({ puuid: "puuid-vyoh" });

    await makeService(prisma, { resolveSummoner }).getChampionExtras(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );

    expect(prisma.match.findMany.mock.calls[0]?.[0]?.select).toHaveProperty(
      "remake",
      true
    );
  });

  it("throws Forbidden when the account isn't whitelisted", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, {
      isLolAccountAllowed: vi.fn().mockReturnValue(false),
    });
    await expect(
      service.getChampionExtras("euw1", "Vyoh", "Ahri", "Ahri")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("LolChampionAnalyticsService.getChampionRecap", () => {
  it("throws Forbidden when the account isn't whitelisted", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, {
      isLolAccountAllowed: vi.fn().mockReturnValue(false),
    });
    await expect(
      service.getChampionRecap("euw1", "Vyoh", "Ahri", "Ahri")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  function matchRow(
    overrides: Partial<Record<string, unknown>> = {}
  ): Record<string, unknown> {
    return {
      matchId: "EUW_1",
      queueId: 420,
      champion: "Ahri",
      kills: 8,
      deaths: 4,
      assists: 7,
      win: true,
      durationSec: 1800,
      playedAt: new Date("2026-05-30T20:00:00Z"),
      remake: false,
      teamPosition: "MIDDLE",
      gameVersion: "26.9",
      visionScore: 22,
      damageShare: 0.27,
      firstBloodKill: false,
      hasTimeline: true,
      csAt10: 70,
      csAt15: 110,
      goldAt10: 4000,
      goldAt15: 6500,
      teamGoldDiffAt15: 500,
      teamGoldDiffSeries: [],
      deathTimings: [],
      deathXs: [],
      deathYs: [],
      killTimings: [],
      killXs: [],
      killYs: [],
      laneOpponent: null,
      ...overrides,
    };
  }

  it("queries the champion alias case-insensitively and applies the 365-day window", async () => {
    const prisma = makePrisma();
    prisma.match.findMany.mockResolvedValue([]);
    const resolveSummoner = vi.fn().mockResolvedValue({ puuid: "puuid-vyoh" });

    await makeService(prisma, { resolveSummoner }).getChampionRecap(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );

    expect(prisma.match.findMany).toHaveBeenCalledTimes(1);
    const call = prisma.match.findMany.mock.calls[0]?.[0];
    expect(call.where).toMatchObject({
      puuid: "puuid-vyoh",
      champion: { equals: "Ahri", mode: "insensitive" },
    });
    // Cutoff is `playedAt: { gte: Date }` — exact value is wall-clock-dependent,
    // assert shape + that it is ~365 days back from now.
    expect(call.where.playedAt.gte).toBeInstanceOf(Date);
    const ageMs = Date.now() - (call.where.playedAt.gte as Date).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    expect(ageDays).toBeGreaterThan(364);
    expect(ageDays).toBeLessThan(366);
  });

  it("maps prisma rows to the shared deriver and returns the recap shape", async () => {
    const prisma = makePrisma();
    prisma.match.findMany.mockResolvedValue([
      matchRow({
        matchId: "best",
        kills: 17,
        deaths: 2,
        assists: 9,
        win: true,
        laneOpponent: { championName: "Sylas", puuid: "x", gameName: "g", tagLine: "t" },
      }),
      matchRow({ matchId: "second", kills: 8, win: false }),
      matchRow({ matchId: "remake", kills: 99, remake: true }),
    ]);
    const resolveSummoner = vi.fn().mockResolvedValue({ puuid: "puuid-vyoh" });

    const recap = await makeService(prisma, { resolveSummoner }).getChampionRecap(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );

    // Remake excluded — total = 2, not 3.
    expect(recap.alias).toBe("Ahri");
    expect(recap.totalGames).toBe(2);
    expect(recap.signatureGame?.matchId).toBe("best");
    expect(recap.signatureGame?.opponentChampion).toBe("Sylas");
    expect(recap.peaks.highestKills).toBe(17);
    // Recent strip carries the non-remake matches (newest first by playedAt).
    expect(recap.recentMatches.map((m) => m.matchId)).toEqual(["best", "second"]);
  });

  it("returns the zero-state when the player has no stored matches on the champion", async () => {
    const prisma = makePrisma();
    prisma.match.findMany.mockResolvedValue([]);
    const resolveSummoner = vi.fn().mockResolvedValue({ puuid: "puuid-vyoh" });

    const recap = await makeService(prisma, { resolveSummoner }).getChampionRecap(
      "euw1",
      "Vyoh",
      "Yone",
      "Yone"
    );

    expect(recap.alias).toBe("Yone");
    expect(recap.totalGames).toBe(0);
    expect(recap.signatureGame).toBeNull();
    expect(recap.winRate).toBeNull();
  });
});

describe("LolChampionAnalyticsService.getChampionBuildFlow", () => {
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

describe("LolChampionAnalyticsService.getChampionRuneDiversity", () => {
  function cacheRow(matchId: string, puuid: string, perk: number, win: boolean) {
    return {
      matchId,
      detail: {
        info: {
          participants: [
            // a teammate whose keystone must be ignored
            {
              puuid: "other",
              win,
              perks: { styles: [{ selections: [{ perk: 9999 }] }] },
            },
            { puuid, win, perks: { styles: [{ selections: [{ perk }] }] } },
          ],
        },
      },
    };
  }

  it("tallies the owner's keystone per match, sorted by games desc", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "m1", remake: false },
      { matchId: "m2", remake: false },
      { matchId: "m3", remake: false },
    ]);
    prisma.matchDetailCache.findMany.mockResolvedValue([
      cacheRow("m1", "puuid-vyoh", 8005, true),
      cacheRow("m2", "puuid-vyoh", 8005, false),
      cacheRow("m3", "puuid-vyoh", 9923, true),
    ]);

    const result = await makeService(prisma).getChampionRuneDiversity(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );

    expect(result).toEqual([
      { keystoneId: 8005, games: 2, wins: 1 },
      { keystoneId: 9923, games: 1, wins: 1 },
    ]);
    // Match query is scoped to the champion (case-insensitive).
    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          puuid: "puuid-vyoh",
          champion: { equals: "Ahri", mode: "insensitive" },
        }),
      })
    );
  });

  it("excludes remakes and skips matches with no resolvable keystone", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "m1", remake: false },
      { matchId: "m2", remake: true },
    ]);
    // Only the non-remake match has a cache row; its keystone is missing (perk 0).
    prisma.matchDetailCache.findMany.mockResolvedValue([
      {
        matchId: "m1",
        detail: {
          info: { participants: [{ puuid: "puuid-vyoh", win: true, perks: {} }] },
        },
      },
    ]);

    const result = await makeService(prisma).getChampionRuneDiversity(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );

    expect(result).toEqual([]);
    // Remake match id is not queried in the cache lookup.
    expect(prisma.matchDetailCache.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { matchId: { in: ["m1"] } } })
    );
  });

  it("throws when the account is not whitelisted", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, {
      isLolAccountAllowed: vi.fn().mockReturnValue(false),
    });
    await expect(
      service.getChampionRuneDiversity("euw1", "Vyoh", "Ahri", "Ahri")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("LolChampionAnalyticsService.getChampionLanePhase", () => {
  const pf = (participantId: number, cs: number, gold: number) => ({
    participantId,
    minionsKilled: cs,
    jungleMinionsKilled: 0,
    totalGold: gold,
  });

  // Owner = participantId 1 (puuid-vyoh), lane opponent = participantId 6 (opp-1).
  function timeline(opts: {
    owner10: [number, number];
    opp10: [number, number];
    owner15?: [number, number];
    opp15?: [number, number];
  }) {
    const frames: Array<{
      timestamp: number;
      participantFrames: Record<string, ReturnType<typeof pf>>;
    }> = [
      { timestamp: 0, participantFrames: {} },
      {
        timestamp: 600_000,
        participantFrames: {
          "1": pf(1, opts.owner10[0], opts.owner10[1]),
          "6": pf(6, opts.opp10[0], opts.opp10[1]),
        },
      },
    ];
    if (opts.owner15 && opts.opp15) {
      frames.push({
        timestamp: 900_000,
        participantFrames: {
          "1": pf(1, opts.owner15[0], opts.owner15[1]),
          "6": pf(6, opts.opp15[0], opts.opp15[1]),
        },
      });
    }
    return {
      metadata: {
        participants: [
          "puuid-vyoh",
          "p2",
          "p3",
          "p4",
          "p5",
          "opp-1",
          "p7",
          "p8",
          "p9",
          "p10",
        ],
      },
      info: {
        participants: [
          { participantId: 1, puuid: "puuid-vyoh" },
          { participantId: 6, puuid: "opp-1" },
        ],
        frames,
      },
    };
  }

  it("averages owner-minus-opponent diffs and ahead rates, per-metric sample", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "m1", remake: false, laneOpponent: { puuid: "opp-1" } },
      { matchId: "m2", remake: false, laneOpponent: { puuid: "opp-1" } },
    ]);
    prisma.matchTimelineCache.findMany.mockResolvedValue([
      {
        matchId: "m1",
        timeline: timeline({
          owner10: [80, 5000],
          opp10: [60, 4500],
          owner15: [130, 8000],
          opp15: [110, 7600],
        }),
      },
      // m2 ends before 15 min — contributes to cs10/gold10 only.
      { matchId: "m2", timeline: timeline({ owner10: [50, 4000], opp10: [70, 4300] }) },
    ]);

    const result = await makeService(prisma).getChampionLanePhase(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );

    expect(result.sampleSize).toBe(2);
    // cs@10 diffs: +20, -20 → avg 0, ahead 1/2.
    expect(result.csAt10).toEqual({ diff: 0, aheadRate: 0.5 });
    // gold@10 diffs: +500, -300 → avg 100, ahead 1/2.
    expect(result.goldAt10).toEqual({ diff: 100, aheadRate: 0.5 });
    // cs@15 only m1 had a 15-min frame: +20, ahead 1/1.
    expect(result.csAt15).toEqual({ diff: 20, aheadRate: 1 });
  });

  it("drops remakes and matches without a lane opponent before touching timelines", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "m1", remake: false, laneOpponent: null },
      { matchId: "m2", remake: true, laneOpponent: { puuid: "opp-1" } },
    ]);

    const result = await makeService(prisma).getChampionLanePhase(
      "euw1",
      "Vyoh",
      "Ahri",
      "Ahri"
    );

    expect(result.sampleSize).toBe(0);
    expect(result.csAt10).toEqual({ diff: 0, aheadRate: 0 });
    // No surviving match → no timeline query.
    expect(prisma.matchTimelineCache.findMany).not.toHaveBeenCalled();
  });

  it("throws when the account is not whitelisted", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, {
      isLolAccountAllowed: vi.fn().mockReturnValue(false),
    });
    await expect(
      service.getChampionLanePhase("euw1", "Vyoh", "Ahri", "Ahri")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
