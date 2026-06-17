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

  it("applies a queueType `in` filter when queue ids are provided", async () => {
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
          queueType: { in: ["Ranked Solo", "Ranked Flex"] },
        }),
      })
    );
  });

  it("omits the queueType filter when queue ids are empty or undefined", async () => {
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
    expect(call?.where).not.toHaveProperty("queueType");
  });
});

describe("LolAnalyticsService.getChampionRecap", () => {
  function matchRow(
    overrides: Partial<Record<string, unknown>> = {}
  ): Record<string, unknown> {
    return {
      matchId: "EUW_1",
      queueType: "RANKED_SOLO_5x5",
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
      // Owner stayed on Ahri; the duo ran Lux twice (1-1) then Sona once (1-0).
      // Ranked by games together, so the Lux pairing leads.
      championPairs: [
        { yourChamp: "Ahri", teammateChamp: "Lux", games: 2, wins: 1 },
        { yourChamp: "Ahri", teammateChamp: "Sona", games: 1, wins: 1 },
      ],
      // Newest-first, matching the playedAt-desc cache sort.
      matchIds: ["EUW1_1", "EUW1_2", "EUW1_3"],
    });
  });

  // Temporal-clustering gate: a teammate over the 3-game floor but whose shared
  // games are scattered across separate days (no same-session pair) reads as
  // random matchmaking recurrence, not a premade — excluded unless volume is high.
  const lukePair = [
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

  it("excludes a 3-game teammate whose games are scattered across separate days", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    // Three shared games, each days apart — no two within the 3h session window.
    prisma.match.findMany.mockResolvedValue([
      { matchId: "EUW1_1", playedAt: new Date("2026-05-15T20:00:00Z") },
      { matchId: "EUW1_2", playedAt: new Date("2026-05-12T20:00:00Z") },
      { matchId: "EUW1_3", playedAt: new Date("2026-05-09T20:00:00Z") },
    ]);
    prisma.matchDetailCache.findMany.mockResolvedValue([
      { matchId: "EUW1_1", detail: detail(lukePair) },
      { matchId: "EUW1_2", detail: detail(lukePair) },
      { matchId: "EUW1_3", detail: detail(lukePair) },
    ]);

    const duos = await makeService(prisma).getDuos("euw1", "Vyoh", "Ahri");
    expect(duos).toHaveLength(0);
  });

  it("keeps a scattered teammate once they clear the high-volume escape hatch", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    // Six shared games, all on separate days (still no same-session pair) — but
    // sheer volume is convincing on its own, so they qualify.
    const days = [15, 13, 11, 9, 7, 5];
    prisma.match.findMany.mockResolvedValue(
      days.map((d) => ({
        matchId: `EUW1_${d}`,
        playedAt: new Date(`2026-05-${d}T20:00:00Z`),
      }))
    );
    prisma.matchDetailCache.findMany.mockResolvedValue(
      days.map((d) => ({ matchId: `EUW1_${d}`, detail: detail(lukePair) }))
    );

    const duos = await makeService(prisma).getDuos("euw1", "Vyoh", "Ahri");
    expect(duos).toHaveLength(1);
    expect(duos[0]?.games).toBe(6);
  });

  it("splits champion pairings by the owner's own champion, ranked by games", async () => {
    // The owner is not always on Ahri — the pairing key includes the owner's
    // champ per match, so (Ahri+Lux) and (Syndra+Lux) are distinct combos even
    // though the duo stayed on Lux throughout.
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    // Four games in one evening session (within the 3h same-session window) so
    // the duo qualifies on temporal clustering.
    prisma.match.findMany.mockResolvedValue([
      { matchId: "EUW1_1", playedAt: new Date("2026-05-15T20:00:00Z") },
      { matchId: "EUW1_2", playedAt: new Date("2026-05-15T21:00:00Z") },
      { matchId: "EUW1_3", playedAt: new Date("2026-05-15T22:00:00Z") },
      { matchId: "EUW1_4", playedAt: new Date("2026-05-15T23:00:00Z") },
    ]);
    const row = (ownerChamp: string, win: boolean, lukeChamp = "Lux") => [
      {
        puuid: "puuid-vyoh",
        riotIdGameName: "Vyoh",
        riotIdTagline: "Ahri",
        championName: ownerChamp,
        teamId: 100,
        win,
      },
      {
        puuid: "puuid-luke",
        riotIdGameName: "DuoLuke",
        riotIdTagline: "EUW",
        championName: lukeChamp,
        teamId: 100,
        win,
      },
    ];
    prisma.matchDetailCache.findMany.mockResolvedValue([
      { matchId: "EUW1_1", detail: detail(row("Ahri", true)) },
      { matchId: "EUW1_2", detail: detail(row("Ahri", false)) },
      { matchId: "EUW1_3", detail: detail(row("Ahri", true)) },
      { matchId: "EUW1_4", detail: detail(row("Syndra", true)) },
    ]);

    const duos = await makeService(prisma).getDuos("euw1", "Vyoh", "Ahri");
    expect(duos).toHaveLength(1);
    expect(duos[0]?.championPairs).toEqual([
      { yourChamp: "Ahri", teammateChamp: "Lux", games: 3, wins: 2 },
      { yourChamp: "Syndra", teammateChamp: "Lux", games: 1, wins: 1 },
    ]);
  });
});

describe("LolAnalyticsService.getSquads", () => {
  // championName carries no signal for squad membership, so a single fixed champ
  // per player keeps the fixtures readable.
  function p(puuid: string, gameName: string, win: boolean, teamId = 100) {
    return {
      puuid,
      riotIdGameName: gameName,
      riotIdTagline: "EUW",
      championName: `${gameName}Champ`,
      teamId,
      win,
    };
  }
  function detail(participants: ReturnType<typeof p>[]) {
    return { info: { participants } };
  }
  const me = (win: boolean, teamId = 100) => ({
    puuid: "puuid-vyoh",
    riotIdGameName: "Vyoh",
    riotIdTagline: "Ahri",
    championName: "Ahri",
    teamId,
    win,
  });

  it("returns [] when the summoner has no matches", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([]);
    expect(await makeService(prisma).getSquads("euw1", "Vyoh", "Ahri")).toEqual([]);
    expect(prisma.matchDetailCache.findMany).not.toHaveBeenCalled();
  });

  it("detects a recurring trio played together in one session", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    // Three games back-to-back (within the 3h session window).
    prisma.match.findMany.mockResolvedValue([
      { matchId: "EUW1_1", playedAt: new Date("2026-05-15T22:00:00Z") },
      { matchId: "EUW1_2", playedAt: new Date("2026-05-15T21:00:00Z") },
      { matchId: "EUW1_3", playedAt: new Date("2026-05-15T20:00:00Z") },
    ]);
    const lineup = [me(true), p("puuid-a", "Bob", true), p("puuid-b", "Cara", true)];
    prisma.matchDetailCache.findMany.mockResolvedValue([
      { matchId: "EUW1_1", detail: detail(lineup) },
      { matchId: "EUW1_2", detail: detail(lineup) },
      {
        matchId: "EUW1_3",
        detail: detail([
          me(false),
          p("puuid-a", "Bob", false),
          p("puuid-b", "Cara", false),
        ]),
      },
    ]);

    const squads = await makeService(prisma).getSquads("euw1", "Vyoh", "Ahri");
    expect(squads).toHaveLength(1);
    expect(squads[0]?.size).toBe(3);
    expect(squads[0]?.games).toBe(3);
    expect(squads[0]?.wins).toBe(2);
    expect(squads[0]?.members.map((m) => m.gameName)).toEqual(["Bob", "Cara"]);
    expect(squads[0]?.members[0]?.topChampion).toBe("BobChamp");
  });

  it("excludes a trio whose games are scattered across separate days", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    // Three shared games, each days apart — no same-session pair, below volume.
    prisma.match.findMany.mockResolvedValue([
      { matchId: "EUW1_1", playedAt: new Date("2026-05-15T20:00:00Z") },
      { matchId: "EUW1_2", playedAt: new Date("2026-05-12T20:00:00Z") },
      { matchId: "EUW1_3", playedAt: new Date("2026-05-09T20:00:00Z") },
    ]);
    const lineup = [me(true), p("puuid-a", "Bob", true), p("puuid-b", "Cara", true)];
    prisma.matchDetailCache.findMany.mockResolvedValue([
      { matchId: "EUW1_1", detail: detail(lineup) },
      { matchId: "EUW1_2", detail: detail(lineup) },
      { matchId: "EUW1_3", detail: detail(lineup) },
    ]);

    expect(await makeService(prisma).getSquads("euw1", "Vyoh", "Ahri")).toEqual([]);
  });

  it("drops nested subgroups fully explained by a larger stack", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    // A full 4-stack (you + Bob + Cara + Dan) across four session games. The
    // three pairs each also recur 4× — but only inside the 4-stack, so they're
    // redundant and only the 4-stack should surface.
    const hours = [22, 21, 20, 19];
    prisma.match.findMany.mockResolvedValue(
      hours.map((h) => ({
        matchId: `EUW1_${h}`,
        playedAt: new Date(`2026-05-15T${h}:00:00Z`),
      }))
    );
    const lineup = [
      me(true),
      p("puuid-a", "Bob", true),
      p("puuid-b", "Cara", true),
      p("puuid-c", "Dan", true),
    ];
    prisma.matchDetailCache.findMany.mockResolvedValue(
      hours.map((h) => ({ matchId: `EUW1_${h}`, detail: detail(lineup) }))
    );

    const squads = await makeService(prisma).getSquads("euw1", "Vyoh", "Ahri");
    expect(squads).toHaveLength(1);
    expect(squads[0]?.size).toBe(4);
    expect(squads[0]?.members.map((m) => m.gameName)).toEqual(["Bob", "Cara", "Dan"]);
  });

  it("keeps a subgroup that recurs notably more often than the larger stack", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    // Trio {Bob,Cara,Dan} 3× one night; pair {Bob,Cara} another 4× a different
    // night. The pair (7 games total) played plenty without Dan, so it's a
    // distinct stack and survives dedup alongside the trio.
    prisma.match.findMany.mockResolvedValue([
      { matchId: "T1", playedAt: new Date("2026-05-15T22:00:00Z") },
      { matchId: "T2", playedAt: new Date("2026-05-15T21:00:00Z") },
      { matchId: "T3", playedAt: new Date("2026-05-15T20:00:00Z") },
      { matchId: "P1", playedAt: new Date("2026-05-10T22:00:00Z") },
      { matchId: "P2", playedAt: new Date("2026-05-10T21:00:00Z") },
      { matchId: "P3", playedAt: new Date("2026-05-10T20:00:00Z") },
      { matchId: "P4", playedAt: new Date("2026-05-10T19:00:00Z") },
    ]);
    const trio = [
      me(true),
      p("puuid-a", "Bob", true),
      p("puuid-b", "Cara", true),
      p("puuid-c", "Dan", true),
    ];
    const pair = [me(true), p("puuid-a", "Bob", true), p("puuid-b", "Cara", true)];
    prisma.matchDetailCache.findMany.mockResolvedValue([
      { matchId: "T1", detail: detail(trio) },
      { matchId: "T2", detail: detail(trio) },
      { matchId: "T3", detail: detail(trio) },
      { matchId: "P1", detail: detail(pair) },
      { matchId: "P2", detail: detail(pair) },
      { matchId: "P3", detail: detail(pair) },
      { matchId: "P4", detail: detail(pair) },
    ]);

    const squads = await makeService(prisma).getSquads("euw1", "Vyoh", "Ahri");
    // Most-played first: the {Bob,Cara} pair (7 games) then the {Bob,Cara,Dan}
    // trio (3 games).
    expect(squads).toHaveLength(2);
    expect(squads[0]?.size).toBe(3);
    expect(squads[0]?.games).toBe(7);
    expect(squads[0]?.members.map((m) => m.gameName)).toEqual(["Bob", "Cara"]);
    expect(squads[1]?.size).toBe(4);
    expect(squads[1]?.games).toBe(3);
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
      queueType: "Ranked Solo",
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
    expect(stats).toEqual({});
    expect(prisma.match.findFirst).not.toHaveBeenCalled();
  });

  it("returns an empty calibration when no matches exist for the queue set", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "p1" });
    prisma.match.findFirst.mockResolvedValue(null);
    const stats = await makeService(prisma).getPregameCalibration("euw1", "Vyoh", "Ahri");
    expect(stats).toEqual({});
    expect(prisma.match.findMany).not.toHaveBeenCalled();
  });

  it("partitions stats per queueType so Solo and Flex are reported separately", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "p1" });
    prisma.match.findFirst.mockResolvedValue({
      playedAt: new Date("2026-05-20T00:00:00Z"),
    });
    prisma.match.findMany.mockResolvedValue([
      fakeRow({
        matchId: "s",
        playedAt: new Date("2026-05-20T00:00:00Z"),
        queueType: "Ranked Solo",
      }),
      fakeRow({
        matchId: "f",
        playedAt: new Date("2026-05-19T00:00:00Z"),
        queueType: "Ranked Flex",
      }),
    ]);
    const stats = await makeService(prisma).getPregameCalibration("euw1", "Vyoh", "Ahri");
    // Structural contract: the response is keyed per queueType rather than
    // mashed into a single combined number. The partitioning math itself is
    // covered by computeCalibrationByQueue's unit tests in shared.
    expect(Object.keys(stats).sort()).toEqual(["Ranked Flex", "Ranked Solo"]);
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

describe("LolAnalyticsService.getChampionRuneDiversity", () => {
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

describe("LolAnalyticsService.getChampionLanePhase", () => {
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

describe("LolAnalyticsService.getObjectiveFirsts", () => {
  function cacheRow(opts: {
    matchId: string;
    win: boolean;
    teamId: number;
    firstBlood: boolean;
    teamFirstTower: boolean;
  }) {
    const enemyTeam = opts.teamId === 100 ? 200 : 100;
    return {
      matchId: opts.matchId,
      detail: {
        info: {
          participants: [
            {
              puuid: "puuid-vyoh",
              win: opts.win,
              teamId: opts.teamId,
              firstBloodKill: opts.firstBlood,
            },
            { puuid: "other", win: !opts.win, teamId: enemyTeam, firstBloodKill: false },
          ],
          teams: [
            {
              teamId: opts.teamId,
              objectives: { tower: { first: opts.teamFirstTower } },
            },
            { teamId: enemyTeam, objectives: { tower: { first: !opts.teamFirstTower } } },
          ],
        },
      },
    };
  }

  it("tallies personal first blood and team first tower with win counts", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "m1", remake: false },
      { matchId: "m2", remake: false },
      { matchId: "m3", remake: false },
    ]);
    prisma.matchDetailCache.findMany.mockResolvedValue([
      cacheRow({
        matchId: "m1",
        win: true,
        teamId: 100,
        firstBlood: true,
        teamFirstTower: true,
      }),
      cacheRow({
        matchId: "m2",
        win: false,
        teamId: 200,
        firstBlood: true,
        teamFirstTower: false,
      }),
      cacheRow({
        matchId: "m3",
        win: true,
        teamId: 100,
        firstBlood: false,
        teamFirstTower: true,
      }),
    ]);

    const result = await makeService(prisma).getObjectiveFirsts("euw1", "Vyoh", "Ahri");

    expect(result.games).toBe(3);
    // first blood in m1 (win) + m2 (loss) → count 2, wins 1.
    expect(result.firstBlood).toEqual({ count: 2, wins: 1 });
    // team first tower in m1 (win) + m3 (win) → count 2, wins 2.
    expect(result.firstTower).toEqual({ count: 2, wins: 2 });
  });

  it("excludes remakes before reading caches", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "m1", remake: false },
      { matchId: "m2", remake: true },
    ]);
    prisma.matchDetailCache.findMany.mockResolvedValue([
      cacheRow({
        matchId: "m1",
        win: true,
        teamId: 100,
        firstBlood: true,
        teamFirstTower: false,
      }),
    ]);

    const result = await makeService(prisma).getObjectiveFirsts("euw1", "Vyoh", "Ahri");

    expect(result.games).toBe(1);
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
      service.getObjectiveFirsts("euw1", "Vyoh", "Ahri")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("LolAnalyticsService.getCarryProfile", () => {
  // Owner's team (100) is 5 players; ownerDmg sets the owner's damage, the other
  // four teammates' damage is given so we can place the owner's rank.
  function cacheRow(opts: {
    matchId: string;
    win: boolean;
    ownerDmg: number;
    teammateDmgs: number[];
    teamSize?: number;
  }) {
    const teamSize = opts.teamSize ?? 5;
    const team = [
      {
        puuid: "puuid-vyoh",
        win: opts.win,
        teamId: 100,
        totalDamageDealtToChampions: opts.ownerDmg,
      },
      ...opts.teammateDmgs.slice(0, teamSize - 1).map((d, i) => ({
        puuid: `mate-${i}`,
        win: opts.win,
        teamId: 100,
        totalDamageDealtToChampions: d,
      })),
    ];
    const enemies = Array.from({ length: 5 }, (_, i) => ({
      puuid: `enemy-${i}`,
      win: !opts.win,
      teamId: 200,
      totalDamageDealtToChampions: 10000,
    }));
    return {
      matchId: opts.matchId,
      detail: { info: { participants: [...team, ...enemies] } },
    };
  }

  it("buckets games by the owner's rank in team champion damage", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "m1", remake: false },
      { matchId: "m2", remake: false },
      { matchId: "m3", remake: false },
    ]);
    prisma.matchDetailCache.findMany.mockResolvedValue([
      // owner highest damage → rank 1 (top-3), win
      cacheRow({
        matchId: "m1",
        win: true,
        ownerDmg: 30000,
        teammateDmgs: [20000, 15000, 10000, 5000],
      }),
      // owner lowest damage → rank 5 (bottom-2), loss
      cacheRow({
        matchId: "m2",
        win: false,
        ownerDmg: 4000,
        teammateDmgs: [30000, 25000, 20000, 15000],
      }),
      // owner 4th of 5 → rank 4 (bottom-2), win
      cacheRow({
        matchId: "m3",
        win: true,
        ownerDmg: 12000,
        teammateDmgs: [30000, 25000, 20000, 8000],
      }),
    ]);

    const result = await makeService(prisma).getCarryProfile("euw1", "Vyoh", "Ahri");

    expect(result.games).toBe(3);
    expect(result.topThree).toEqual({ games: 1, wins: 1 });
    expect(result.bottomTwo).toEqual({ games: 2, wins: 1 });
  });

  it("skips teams without a full roster (Arena subteams / malformed rows)", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([{ matchId: "m1", remake: false }]);
    prisma.matchDetailCache.findMany.mockResolvedValue([
      cacheRow({
        matchId: "m1",
        win: true,
        ownerDmg: 9000,
        teammateDmgs: [8000],
        teamSize: 2,
      }),
    ]);

    const result = await makeService(prisma).getCarryProfile("euw1", "Vyoh", "Ahri");

    expect(result.games).toBe(0);
  });

  it("throws when the account is not whitelisted", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, {
      isLolAccountAllowed: vi.fn().mockReturnValue(false),
    });
    await expect(service.getCarryProfile("euw1", "Vyoh", "Ahri")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});

describe("LolAnalyticsService.getDamageProfile", () => {
  // Full-roster team where the owner contributes a known share. Helper keeps the
  // two-game fixture readable: each teammate is `{ dmg, taken, vision, minions,
  // neutral }` on the same teamId; enemies are dropped by the teamId filter.
  function game(
    matchId: string,
    teamId: number,
    team: Array<{
      puuid?: string;
      dmg: number;
      taken: number;
      vision: number;
      minions: number;
      neutral?: number;
    }>
  ) {
    return {
      matchId,
      detail: {
        info: {
          participants: team.map((p, i) => ({
            puuid: p.puuid ?? `filler-${matchId}-${i}`,
            teamId,
            totalDamageDealtToChampions: p.dmg,
            totalDamageTaken: p.taken,
            visionScore: p.vision,
            totalMinionsKilled: p.minions,
            neutralMinionsKilled: p.neutral ?? 0,
          })),
        },
      },
    };
  }

  it("averages the owner's share of team totals across games", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "EUW1_1", remake: false },
      { matchId: "EUW1_2", remake: false },
    ]);
    prisma.matchDetailCache.findMany.mockResolvedValue([
      // Even five-way split → owner share 0.2 on every axis.
      game("EUW1_1", 100, [
        { puuid: "puuid-vyoh", dmg: 1000, taken: 500, vision: 20, minions: 100 },
        { dmg: 1000, taken: 500, vision: 20, minions: 100 },
        { dmg: 1000, taken: 500, vision: 20, minions: 100 },
        { dmg: 1000, taken: 500, vision: 20, minions: 100 },
        { dmg: 1000, taken: 500, vision: 20, minions: 100 },
      ]),
      // Owner over-indexes on damage/vision (0.5), under on taken/cs (0.25).
      game("EUW1_2", 200, [
        {
          puuid: "puuid-vyoh",
          dmg: 3000,
          taken: 1000,
          vision: 40,
          minions: 150,
          neutral: 50,
        },
        { dmg: 1500, taken: 1500, vision: 20, minions: 300 },
        { dmg: 1500, taken: 1500, vision: 20, minions: 300 },
        { dmg: 0, taken: 0, vision: 0, minions: 0 },
        { dmg: 0, taken: 0, vision: 0, minions: 0 },
      ]),
    ]);

    const result = await makeService(prisma).getDamageProfile("euw1", "Vyoh", "EUW");
    expect(result.sampleSize).toBe(2);
    expect(result.damageShare).toBeCloseTo(0.35); // (0.2 + 0.5) / 2
    expect(result.damageTakenShare).toBeCloseTo(0.225); // (0.2 + 0.25) / 2
    expect(result.visionShare).toBeCloseTo(0.35);
    expect(result.csShare).toBeCloseTo(0.225);
  });

  it("scopes to a champion and excludes non-positional games via the where clause", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    await makeService(prisma).getDamageProfile("euw1", "Vyoh", "EUW", "Ahri");
    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          puuid: "puuid-vyoh",
          teamPosition: { not: "" },
          champion: { equals: "Ahri", mode: "insensitive" },
        }),
      })
    );
  });

  it("skips teams without a full roster (Arena subteams / malformed rows)", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([{ matchId: "EUW1_1", remake: false }]);
    prisma.matchDetailCache.findMany.mockResolvedValue([
      game("EUW1_1", 100, [
        { puuid: "puuid-vyoh", dmg: 1000, taken: 500, vision: 20, minions: 100 },
        { dmg: 1000, taken: 500, vision: 20, minions: 100 },
      ]),
    ]);

    const result = await makeService(prisma).getDamageProfile("euw1", "Vyoh", "EUW");
    expect(result).toEqual({
      sampleSize: 0,
      damageShare: 0,
      damageTakenShare: 0,
      visionShare: 0,
      csShare: 0,
    });
  });

  it("throws Forbidden when the account isn't whitelisted", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, {
      isLolAccountAllowed: vi.fn().mockReturnValue(false),
    });
    await expect(service.getDamageProfile("euw1", "Vyoh", "EUW")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});
