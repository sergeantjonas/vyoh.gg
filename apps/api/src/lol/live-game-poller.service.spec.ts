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
