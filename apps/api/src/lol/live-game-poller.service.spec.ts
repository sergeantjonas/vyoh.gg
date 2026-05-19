import { describe, expect, it, vi } from "vitest";
import type { IdentityService } from "../identity/identity.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { RiotService } from "../riot/riot.service";
import type { RiotActiveGame } from "../riot/types";
import {
  LiveGamePollerService,
  keystoneFromPerks,
  parseRiotId,
} from "./live-game-poller.service";
import type { MatchEventsService } from "./match-events.service";

describe("parseRiotId", () => {
  it("returns empty pair for null / undefined / empty input (streamer-mode opponents)", () => {
    expect(parseRiotId(null)).toEqual({ gameName: "", tagLine: "" });
    expect(parseRiotId(undefined)).toEqual({ gameName: "", tagLine: "" });
    expect(parseRiotId("")).toEqual({ gameName: "", tagLine: "" });
  });

  it("splits on the last '#' so names containing '#' are preserved", () => {
    expect(parseRiotId("Vyoh#EUW")).toEqual({ gameName: "Vyoh", tagLine: "EUW" });
    expect(parseRiotId("Weird#Name#TAG")).toEqual({
      gameName: "Weird#Name",
      tagLine: "TAG",
    });
  });

  it("returns the whole string as gameName when no '#' is present", () => {
    expect(parseRiotId("Solo")).toEqual({ gameName: "Solo", tagLine: "" });
  });
});

describe("keystoneFromPerks", () => {
  it("returns perks.perkIds[0]", () => {
    expect(
      keystoneFromPerks({
        perkIds: [8214, 8226, 8210, 8237],
        perkStyle: 8200,
        perkSubStyle: 8300,
      })
    ).toBe(8214);
  });

  it("returns 0 when perkIds is empty", () => {
    expect(keystoneFromPerks({ perkIds: [], perkStyle: 0, perkSubStyle: 0 })).toBe(0);
  });
});

interface PrismaStubs {
  summoner: { findUnique: ReturnType<typeof vi.fn> };
  match: { findMany: ReturnType<typeof vi.fn> };
}

interface RiotStubs {
  getActiveGameByPuuid: ReturnType<typeof vi.fn>;
  getLeagueEntriesByPuuid: ReturnType<typeof vi.fn>;
  getChampionMasteryByChampion: ReturnType<typeof vi.fn>;
}

interface IdentityStubs {
  getLolAccounts: ReturnType<typeof vi.fn>;
}

interface EventsStubs {
  emitLiveGame: ReturnType<typeof vi.fn>;
}

function makeStubs(): {
  prisma: PrismaStubs;
  riot: RiotStubs;
  identity: IdentityStubs;
  events: EventsStubs;
} {
  return {
    prisma: {
      summoner: { findUnique: vi.fn() },
      match: { findMany: vi.fn().mockResolvedValue([]) },
    },
    riot: {
      getActiveGameByPuuid: vi.fn(),
      getLeagueEntriesByPuuid: vi.fn().mockResolvedValue([]),
      getChampionMasteryByChampion: vi.fn().mockResolvedValue(null),
    },
    identity: { getLolAccounts: vi.fn().mockReturnValue([]) },
    events: { emitLiveGame: vi.fn() },
  };
}

function makeService(stubs: ReturnType<typeof makeStubs>): LiveGamePollerService {
  return new LiveGamePollerService(
    stubs.prisma as unknown as PrismaService,
    stubs.riot as unknown as RiotService,
    stubs.identity as unknown as IdentityService,
    stubs.events as unknown as MatchEventsService
  );
}

const ACCOUNT = { slug: "vyoh-ahri", gameName: "Vyoh", tagLine: "Ahri", region: "euw1" };

function activeGame(overrides: Partial<RiotActiveGame> = {}): RiotActiveGame {
  return {
    gameId: 7_000_000,
    gameStartTime: 1_700_000_000_000,
    gameLength: 120,
    mapId: 11,
    gameMode: "CLASSIC",
    gameType: "MATCHED_GAME",
    gameQueueConfigId: 420,
    platformId: "EUW1",
    participants: [
      {
        teamId: 100,
        spell1Id: 4,
        spell2Id: 14,
        championId: 103,
        puuid: "puuid-vyoh",
        riotId: "Vyoh#Ahri",
        perks: { perkIds: [8214, 8226], perkStyle: 8200, perkSubStyle: 8300 },
      },
    ],
    bannedChampions: [],
    ...overrides,
  };
}

// Lets fire-and-forget `enrichGame` microtasks settle before the test exits.
function drainMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("LiveGamePollerService.getForPuuid", () => {
  it("returns null when no entry exists for the puuid", () => {
    const stubs = makeStubs();
    expect(makeService(stubs).getForPuuid("ghost")).toBeNull();
  });
});

describe("LiveGamePollerService poll → getForPuuid", () => {
  it("skips polling when the summoner row hasn't been synced yet", async () => {
    const stubs = makeStubs();
    stubs.identity.getLolAccounts.mockReturnValue([ACCOUNT]);
    stubs.prisma.summoner.findUnique.mockResolvedValueOnce(null);

    const service = makeService(stubs);
    await (service as unknown as { poll(): Promise<void> }).poll();

    expect(stubs.riot.getActiveGameByPuuid).not.toHaveBeenCalled();
    expect(stubs.events.emitLiveGame).not.toHaveBeenCalled();
  });

  it("emits game-started and caches the active game on first detection", async () => {
    const stubs = makeStubs();
    stubs.identity.getLolAccounts.mockReturnValue([ACCOUNT]);
    stubs.prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    stubs.riot.getActiveGameByPuuid.mockResolvedValueOnce(activeGame());

    const service = makeService(stubs);
    await (service as unknown as { poll(): Promise<void> }).poll();
    await drainMicrotasks();

    expect(stubs.events.emitLiveGame).toHaveBeenCalledWith({
      type: "game-started",
      puuid: "puuid-vyoh",
    });
    const projection = service.getForPuuid("puuid-vyoh");
    expect(projection?.gameId).toBe(7_000_000);
    expect(projection?.queueId).toBe(420);
    expect(projection?.participants).toHaveLength(1);
  });

  it("doesn't emit game-started a second time when the same game is still active", async () => {
    const stubs = makeStubs();
    stubs.identity.getLolAccounts.mockReturnValue([ACCOUNT]);
    stubs.prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    stubs.riot.getActiveGameByPuuid
      .mockResolvedValueOnce(activeGame())
      .mockResolvedValueOnce(activeGame({ gameLength: 360 }));

    const service = makeService(stubs);
    const poll = (service as unknown as { poll(): Promise<void> }).poll.bind(service);
    await poll();
    await drainMicrotasks();
    stubs.events.emitLiveGame.mockClear();
    await poll();
    await drainMicrotasks();

    expect(stubs.events.emitLiveGame).not.toHaveBeenCalled();
    expect(service.getForPuuid("puuid-vyoh")?.gameLength).toBe(360);
  });

  it("emits game-ended and clears the projection when the game disappears", async () => {
    const stubs = makeStubs();
    stubs.identity.getLolAccounts.mockReturnValue([ACCOUNT]);
    stubs.prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    stubs.riot.getActiveGameByPuuid
      .mockResolvedValueOnce(activeGame())
      .mockResolvedValueOnce(null);

    const service = makeService(stubs);
    const poll = (service as unknown as { poll(): Promise<void> }).poll.bind(service);
    await poll();
    await drainMicrotasks();
    stubs.events.emitLiveGame.mockClear();
    await poll();
    await drainMicrotasks();

    expect(stubs.events.emitLiveGame).toHaveBeenCalledWith({
      type: "game-ended",
      puuid: "puuid-vyoh",
    });
    expect(service.getForPuuid("puuid-vyoh")).toBeNull();
  });

  it("picks RANKED_SOLO_5x5 entries for enrichment and skips flex/TT queues", async () => {
    // Real bug surface: Riot returns one league entry per queue. If the
    // implementation picked the first entry instead of filtering by queueType,
    // the live-game tile would silently surface flex rank for a player who's
    // primarily a solo-queue grinder.
    const stubs = makeStubs();
    stubs.identity.getLolAccounts.mockReturnValue([ACCOUNT]);
    stubs.prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    stubs.riot.getActiveGameByPuuid.mockResolvedValueOnce(activeGame());
    stubs.riot.getLeagueEntriesByPuuid.mockResolvedValue([
      {
        queueType: "RANKED_FLEX_SR",
        tier: "DIAMOND",
        rank: "I",
        leaguePoints: 80,
        wins: 50,
        losses: 40,
      },
      {
        queueType: "RANKED_SOLO_5x5",
        tier: "PLATINUM",
        rank: "III",
        leaguePoints: 22,
        wins: 30,
        losses: 28,
      },
    ]);

    const service = makeService(stubs);
    await (service as unknown as { poll(): Promise<void> }).poll();
    await drainMicrotasks();

    const projection = service.getForPuuid("puuid-vyoh");
    const me = projection?.participants.find((p) => p.puuid === "puuid-vyoh");
    expect(me?.rank).toEqual({
      tier: "PLATINUM",
      rank: "III",
      lp: 22,
      wins: 30,
      losses: 28,
    });
  });

  it("surfaces partial enrichment when one Riot enrichment call rejects", async () => {
    // Realistic Riot failure mode: rate-limited on league/mastery for one
    // participant while the other call still succeeds. The projection should
    // hold the successful side and null the rejected one — not omit the
    // participant entirely or throw out of the enrichment promise.
    const stubs = makeStubs();
    stubs.identity.getLolAccounts.mockReturnValue([ACCOUNT]);
    stubs.prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    stubs.riot.getActiveGameByPuuid.mockResolvedValueOnce(activeGame());
    stubs.riot.getLeagueEntriesByPuuid.mockRejectedValue(new Error("HTTP 429"));
    stubs.riot.getChampionMasteryByChampion.mockResolvedValue({
      championLevel: 7,
      championPoints: 421_337,
    });

    const service = makeService(stubs);
    await (service as unknown as { poll(): Promise<void> }).poll();
    await drainMicrotasks();

    const me = service
      .getForPuuid("puuid-vyoh")
      ?.participants.find((p) => p.puuid === "puuid-vyoh");
    expect(me?.rank).toBeNull();
    expect(me?.mastery).toEqual({ level: 7, points: 421_337 });
  });

  it("only attaches recentForm for whitelisted-owner participants, not random teammates", async () => {
    // Privacy + rate-limit concern: recentForm is the *owner's* win/loss
    // signal, surfaced when the live game contains another tracked account.
    // For random teammates, we must not query Match by their puuid.
    const stubs = makeStubs();
    stubs.identity.getLolAccounts.mockReturnValue([ACCOUNT]);
    stubs.prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    stubs.riot.getActiveGameByPuuid.mockResolvedValueOnce(
      activeGame({
        participants: [
          {
            teamId: 100,
            spell1Id: 4,
            spell2Id: 14,
            championId: 103,
            puuid: "puuid-vyoh",
            riotId: "Vyoh#Ahri",
            perks: { perkIds: [8214], perkStyle: 8200, perkSubStyle: 8300 },
          },
          {
            teamId: 200,
            spell1Id: 4,
            spell2Id: 14,
            championId: 99,
            puuid: "puuid-randomteammate",
            riotId: "Stranger#EUW",
            perks: { perkIds: [8005], perkStyle: 8000, perkSubStyle: 8100 },
          },
        ],
      })
    );
    stubs.prisma.match.findMany.mockResolvedValue([{ win: true }, { win: false }]);

    const service = makeService(stubs);
    await (service as unknown as { poll(): Promise<void> }).poll();
    await drainMicrotasks();

    const calls = stubs.prisma.match.findMany.mock.calls;
    // No match query should reference the random teammate's puuid.
    const queriedPuuids = calls
      .map(
        (c: unknown[]) =>
          (c[0] as { where?: { puuid?: string } } | undefined)?.where?.puuid
      )
      .filter(Boolean);
    expect(queriedPuuids).not.toContain("puuid-randomteammate");
  });

  it("discards enrichment writes when the game ends mid-enrichment", async () => {
    // Race condition: poll #1 detects an active game and kicks off enrichment.
    // The Riot league call is slow; meanwhile poll #2 sees the game has
    // ended. The resolved enrichment must NOT overwrite the now-cleared
    // entry — otherwise the player-state UI shows stale ranks attached to
    // a participant that is no longer in a game.
    const stubs = makeStubs();
    stubs.identity.getLolAccounts.mockReturnValue([ACCOUNT]);
    stubs.prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });

    // Defer the league-entries call so we can flip the cache before it lands.
    let resolveLeague: (v: unknown) => void = () => {};
    stubs.riot.getLeagueEntriesByPuuid.mockImplementation(
      () =>
        new Promise((res) => {
          resolveLeague = res;
        })
    );
    // Poll #1: game exists. Poll #2: game has ended.
    stubs.riot.getActiveGameByPuuid
      .mockResolvedValueOnce(activeGame({ gameId: 1 }))
      .mockResolvedValueOnce(null);

    const service = makeService(stubs);
    const poll = (service as unknown as { poll(): Promise<void> }).poll.bind(service);
    await poll();
    await poll();
    await drainMicrotasks();
    // Resolve the in-flight enrichment after the cache has been cleared.
    resolveLeague([
      {
        queueType: "RANKED_SOLO_5x5",
        tier: "MASTER",
        rank: "I",
        leaguePoints: 200,
        wins: 1,
        losses: 0,
      },
    ]);
    await drainMicrotasks();

    // Cache is cleared (game ended) — the stale enrichment must be dropped.
    expect(service.getForPuuid("puuid-vyoh")).toBeNull();
  });

  it("swallows per-account errors so one bad account doesn't break the loop", async () => {
    const stubs = makeStubs();
    stubs.identity.getLolAccounts.mockReturnValue([ACCOUNT]);
    stubs.prisma.summoner.findUnique.mockRejectedValueOnce(new Error("db down"));

    const service = makeService(stubs);
    await expect(
      (service as unknown as { poll(): Promise<void> }).poll()
    ).resolves.toBeUndefined();
    expect(stubs.events.emitLiveGame).not.toHaveBeenCalled();
  });
});

describe("LiveGamePollerService projection (via cleanActiveGame + projectLiveMatch)", () => {
  it("drops anonymous duplicate participants sharing (teamId, championId)", async () => {
    const stubs = makeStubs();
    stubs.identity.getLolAccounts.mockReturnValue([ACCOUNT]);
    stubs.prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    stubs.riot.getActiveGameByPuuid.mockResolvedValueOnce(
      activeGame({
        participants: [
          {
            teamId: 100,
            spell1Id: 4,
            spell2Id: 14,
            championId: 103,
            puuid: "puuid-vyoh",
            riotId: "Vyoh#Ahri",
            perks: { perkIds: [8214], perkStyle: 8200, perkSubStyle: 8300 },
          },
          // anonymous ghost A
          {
            teamId: 200,
            spell1Id: 4,
            spell2Id: 14,
            championId: 99,
            puuid: "",
            riotId: "",
            perks: { perkIds: [8005], perkStyle: 8000, perkSubStyle: 8100 },
          },
          // duplicate of ghost A — same (teamId, championId) — must be dropped
          {
            teamId: 200,
            spell1Id: 4,
            spell2Id: 14,
            championId: 99,
            puuid: "",
            riotId: "",
            perks: { perkIds: [8005], perkStyle: 8000, perkSubStyle: 8100 },
          },
        ],
      })
    );

    const service = makeService(stubs);
    await (service as unknown as { poll(): Promise<void> }).poll();
    await drainMicrotasks();

    const projection = service.getForPuuid("puuid-vyoh");
    expect(projection?.participants).toHaveLength(2);
  });

  it("projects anonymous participants with synthetic puuid + blank riot fields", async () => {
    const stubs = makeStubs();
    stubs.identity.getLolAccounts.mockReturnValue([ACCOUNT]);
    stubs.prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    stubs.riot.getActiveGameByPuuid.mockResolvedValueOnce(
      activeGame({
        participants: [
          {
            teamId: 100,
            spell1Id: 4,
            spell2Id: 14,
            championId: 103,
            puuid: "",
            // Riot puts the champion name here in streamer mode — discarded
            riotId: "Ahri",
            perks: { perkIds: [8005], perkStyle: 8000, perkSubStyle: 8100 },
          },
        ],
      })
    );

    const service = makeService(stubs);
    await (service as unknown as { poll(): Promise<void> }).poll();
    await drainMicrotasks();

    const [p] = service.getForPuuid("puuid-vyoh")?.participants ?? [];
    expect(p).toEqual({
      puuid: "anon-100-103",
      anonymous: true,
      teamId: 100,
      championId: 103,
      spell1Id: 4,
      spell2Id: 14,
      keystone: 8005,
      riotIdGameName: "",
      riotIdTagLine: "",
      rank: null,
      mastery: null,
      recentForm: null,
    });
  });

  it("maps bans straight through with teamId / championId / pickTurn", async () => {
    const stubs = makeStubs();
    stubs.identity.getLolAccounts.mockReturnValue([ACCOUNT]);
    stubs.prisma.summoner.findUnique.mockResolvedValue({ puuid: "puuid-vyoh" });
    stubs.riot.getActiveGameByPuuid.mockResolvedValueOnce(
      activeGame({
        bannedChampions: [
          { teamId: 100, championId: 84, pickTurn: 1 },
          { teamId: 200, championId: 157, pickTurn: 2 },
        ],
      })
    );

    const service = makeService(stubs);
    await (service as unknown as { poll(): Promise<void> }).poll();
    await drainMicrotasks();

    expect(service.getForPuuid("puuid-vyoh")?.bans).toEqual([
      { teamId: 100, championId: 84, pickTurn: 1 },
      { teamId: 200, championId: 157, pickTurn: 2 },
    ]);
  });
});
