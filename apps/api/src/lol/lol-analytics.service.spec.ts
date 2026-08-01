import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { IdentityService } from "../identity/identity.service";
import type { PrismaService } from "../prisma/prisma.service";
import { LolAnalyticsService } from "./lol-analytics.service";

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
  opts: { isLolAccountAllowed?: ReturnType<typeof vi.fn> } = {}
): LolAnalyticsService {
  const identity = {
    isLolAccountAllowed: opts.isLolAccountAllowed ?? vi.fn().mockReturnValue(true),
  } as unknown as IdentityService;
  return new LolAnalyticsService(prisma as unknown as PrismaService, identity);
}

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

describe("LolAnalyticsService.getObjectiveParticipation", () => {
  function cacheRow(opts: {
    matchId: string;
    teamId: number;
    teamPosition?: string;
    dragonTakedowns?: number;
    baronTakedowns?: number;
    riftHeraldTakedowns?: number;
    dragonKills?: number;
    baronKills?: number;
    riftHeraldKills?: number;
  }) {
    const enemyTeam = opts.teamId === 100 ? 200 : 100;
    return {
      matchId: opts.matchId,
      detail: {
        info: {
          participants: [
            {
              puuid: "puuid-vyoh",
              teamId: opts.teamId,
              teamPosition: opts.teamPosition ?? "MIDDLE",
              challenges: {
                dragonTakedowns: opts.dragonTakedowns ?? 0,
                baronTakedowns: opts.baronTakedowns ?? 0,
                riftHeraldTakedowns: opts.riftHeraldTakedowns ?? 0,
              },
            },
            { puuid: "other", teamId: enemyTeam, teamPosition: "TOP", challenges: {} },
          ],
          teams: [
            {
              teamId: opts.teamId,
              objectives: {
                dragon: { kills: opts.dragonKills ?? 0 },
                baron: { kills: opts.baronKills ?? 0 },
                riftHerald: { kills: opts.riftHeraldKills ?? 0 },
              },
            },
            { teamId: enemyTeam, objectives: {} },
          ],
        },
      },
    };
  }

  it("tallies takedowns over team kills per objective type", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "m1", remake: false },
      { matchId: "m2", remake: false },
    ]);
    prisma.matchDetailCache.findMany.mockResolvedValue([
      cacheRow({
        matchId: "m1",
        teamId: 100,
        dragonTakedowns: 2,
        baronTakedowns: 1,
        riftHeraldTakedowns: 1,
        dragonKills: 3,
        baronKills: 1,
        riftHeraldKills: 1,
      }),
      cacheRow({
        matchId: "m2",
        teamId: 200,
        dragonTakedowns: 1,
        baronTakedowns: 0,
        riftHeraldTakedowns: 0,
        dragonKills: 2,
        baronKills: 0, // team never took baron in m2 → excluded from baron denominator
        riftHeraldKills: 1,
      }),
    ]);

    const result = await makeService(prisma).getObjectiveParticipation(
      "euw1",
      "Vyoh",
      "Ahri"
    );

    expect(result.games).toBe(2);
    // dragons: (2+1) takedowns over (3+2) kills across both games.
    expect(result.dragons).toEqual({ takedowns: 3, teamKills: 5, games: 2 });
    // barons: only m1 had a baron → 1 of 1 in 1 game.
    expect(result.barons).toEqual({ takedowns: 1, teamKills: 1, games: 1 });
    // heralds: m1 took it (participated), m2 took it (no takedown) → 1 of 2 in 2 games.
    expect(result.heralds).toEqual({ takedowns: 1, teamKills: 2, games: 2 });
  });

  it("clamps takedowns to team kills and skips non-SR games", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "m1", remake: false },
      { matchId: "m2", remake: false },
    ]);
    prisma.matchDetailCache.findMany.mockResolvedValue([
      // Bogus over-count clamps to the team kill total.
      cacheRow({ matchId: "m1", teamId: 100, dragonTakedowns: 9, dragonKills: 2 }),
      // ARAM/Arena: empty teamPosition → skipped entirely.
      cacheRow({ matchId: "m2", teamId: 100, teamPosition: "", dragonKills: 4 }),
    ]);

    const result = await makeService(prisma).getObjectiveParticipation(
      "euw1",
      "Vyoh",
      "Ahri"
    );

    expect(result.games).toBe(1);
    expect(result.dragons).toEqual({ takedowns: 2, teamKills: 2, games: 1 });
  });

  it("excludes remakes before reading caches", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([
      { matchId: "m1", remake: false },
      { matchId: "m2", remake: true },
    ]);
    prisma.matchDetailCache.findMany.mockResolvedValue([
      cacheRow({ matchId: "m1", teamId: 100, dragonTakedowns: 1, dragonKills: 1 }),
    ]);

    const result = await makeService(prisma).getObjectiveParticipation(
      "euw1",
      "Vyoh",
      "Ahri"
    );

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
      service.getObjectiveParticipation("euw1", "Vyoh", "Ahri")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("LolAnalyticsService.getAramProfile", () => {
  function cacheRow(opts: {
    matchId: string;
    win: boolean;
    championName: string;
    kills: number;
    deaths: number;
    assists: number;
    healAndShield?: number;
    damageTaken?: number;
    selfMitigated?: number;
    damageToChampions?: number;
  }) {
    return {
      matchId: opts.matchId,
      detail: {
        info: {
          participants: [
            {
              puuid: "puuid-vyoh",
              win: opts.win,
              championName: opts.championName,
              kills: opts.kills,
              deaths: opts.deaths,
              assists: opts.assists,
              totalDamageTaken: opts.damageTaken ?? 0,
              damageSelfMitigated: opts.selfMitigated ?? 0,
              totalDamageDealtToChampions: opts.damageToChampions ?? 0,
              challenges: { effectiveHealAndShielding: opts.healAndShield ?? 0 },
            },
            {
              puuid: "other",
              win: !opts.win,
              championName: "Zed",
              kills: 0,
              deaths: 0,
              assists: 0,
            },
          ],
        },
      },
    };
  }

  it("aggregates ARAM sums and ranks most-played champions", async () => {
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
        championName: "Jhin",
        kills: 10,
        deaths: 4,
        assists: 12,
        healAndShield: 5000,
        damageTaken: 20000,
        selfMitigated: 8000,
        damageToChampions: 30000,
      }),
      cacheRow({
        matchId: "m2",
        win: false,
        championName: "Jhin",
        kills: 6,
        deaths: 8,
        assists: 10,
        healAndShield: 3000,
        damageTaken: 25000,
        selfMitigated: 9000,
        damageToChampions: 22000,
      }),
      cacheRow({
        matchId: "m3",
        win: true,
        championName: "Lux",
        kills: 4,
        deaths: 3,
        assists: 20,
        healAndShield: 7000,
        damageTaken: 12000,
        selfMitigated: 4000,
        damageToChampions: 18000,
      }),
    ]);

    const result = await makeService(prisma).getAramProfile("euw1", "Vyoh", "Ahri");

    expect(result.games).toBe(3);
    expect(result.wins).toBe(2);
    expect(result).toMatchObject({
      kills: 20,
      deaths: 15,
      assists: 42,
      healAndShield: 15000,
      damageTaken: 57000,
      selfMitigated: 21000,
      damageToChampions: 70000,
    });
    // Jhin (2 games, 1 win) ranks above Lux (1 game, 1 win).
    expect(result.topChampions).toEqual([
      { championName: "Jhin", games: 2, wins: 1 },
      { championName: "Lux", games: 1, wins: 1 },
    ]);
  });

  it("filters Match rows to the ARAM queue", async () => {
    const prisma = makePrisma();
    prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    prisma.match.findMany.mockResolvedValue([{ matchId: "m1", remake: false }]);
    prisma.matchDetailCache.findMany.mockResolvedValue([
      cacheRow({
        matchId: "m1",
        win: true,
        championName: "Jhin",
        kills: 1,
        deaths: 1,
        assists: 1,
      }),
    ]);

    await makeService(prisma).getAramProfile("euw1", "Vyoh", "Ahri");

    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ queueId: 450 }),
      })
    );
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
        championName: "Jhin",
        kills: 1,
        deaths: 1,
        assists: 1,
      }),
    ]);

    const result = await makeService(prisma).getAramProfile("euw1", "Vyoh", "Ahri");

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
    await expect(service.getAramProfile("euw1", "Vyoh", "Ahri")).rejects.toBeInstanceOf(
      ForbiddenException
    );
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
  // two-game fixture readable: each teammate is `{ dmg, vision, minions, neutral }`
  // on the same teamId; enemies are dropped by the teamId filter. No damage-taken
  // field — the lean cache strips it from non-owners, so it's not a radar axis.
  function game(
    matchId: string,
    teamId: number,
    team: Array<{
      puuid?: string;
      dmg: number;
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
        { puuid: "puuid-vyoh", dmg: 1000, vision: 20, minions: 100 },
        { dmg: 1000, vision: 20, minions: 100 },
        { dmg: 1000, vision: 20, minions: 100 },
        { dmg: 1000, vision: 20, minions: 100 },
        { dmg: 1000, vision: 20, minions: 100 },
      ]),
      // Owner over-indexes on damage/vision (0.5), under on cs (0.25).
      game("EUW1_2", 200, [
        { puuid: "puuid-vyoh", dmg: 3000, vision: 40, minions: 150, neutral: 50 },
        { dmg: 1500, vision: 20, minions: 300 },
        { dmg: 1500, vision: 20, minions: 300 },
        { dmg: 0, vision: 0, minions: 0 },
        { dmg: 0, vision: 0, minions: 0 },
      ]),
    ]);

    const result = await makeService(prisma).getDamageProfile("euw1", "Vyoh", "EUW");
    expect(result.sampleSize).toBe(2);
    expect(result.damageShare).toBeCloseTo(0.35); // (0.2 + 0.5) / 2
    expect(result.visionShare).toBeCloseTo(0.35);
    expect(result.csShare).toBeCloseTo(0.225); // (0.2 + 0.25) / 2
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
        { puuid: "puuid-vyoh", dmg: 1000, vision: 20, minions: 100 },
        { dmg: 1000, vision: 20, minions: 100 },
      ]),
    ]);

    const result = await makeService(prisma).getDamageProfile("euw1", "Vyoh", "EUW");
    expect(result).toEqual({
      sampleSize: 0,
      damageShare: 0,
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
