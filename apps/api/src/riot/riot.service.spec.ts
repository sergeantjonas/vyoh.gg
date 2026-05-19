import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RateLimiterService } from "./rate-limiter.service";
import { RiotError } from "./riot.error";
import { RiotService } from "./riot.service";

const ORIGINAL_KEY = process.env.RIOT_API_KEY;

const passThroughLimiter: RateLimiterService = {
  schedule: <T>(_: unknown, __: unknown, fn: () => Promise<T>) => fn(),
  syncFromHeaders: async () => undefined,
} as unknown as RateLimiterService;

beforeEach(() => {
  process.env.RIOT_API_KEY = "test-key";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.RIOT_API_KEY = ORIGINAL_KEY;
});

describe("RiotService.getAccountByRiotId", () => {
  it("calls the regional account endpoint with the API key", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ puuid: "p1", gameName: "Vyoh", tagLine: "EUW" }), {
        status: 200,
      })
    );

    const service = new RiotService(passThroughLimiter);
    const account = await service.getAccountByRiotId("Vyoh", "EUW", "europe");

    expect(account.puuid).toBe("p1");
    expect(fetch).toHaveBeenCalledWith(
      "https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Vyoh/EUW",
      expect.objectContaining({ headers: { "X-Riot-Token": "test-key" } })
    );
  });

  it("throws RiotError with the upstream status code on non-200", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 404, statusText: "Not Found" })
    );
    const service = new RiotService(passThroughLimiter);
    const error = await service
      .getAccountByRiotId("Foo", "Bar", "europe")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RiotError);
    expect((error as RiotError).status).toBe(404);
    expect((error as RiotError).path).toContain("/accounts/by-riot-id/Foo/Bar");
  });

  it("does not retry non-429 errors", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 404, statusText: "Not Found" })
    );
    const service = new RiotService(passThroughLimiter);
    await service.getAccountByRiotId("Foo", "Bar", "europe").catch(() => undefined);

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("routes the call through the rate limiter for the regional cluster and method family", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const schedule = vi.fn(<T>(_: unknown, __: unknown, fn: () => Promise<T>) => fn());
    const syncFromHeaders = vi.fn(async () => undefined);
    const limiter = { schedule, syncFromHeaders } as unknown as RateLimiterService;

    const service = new RiotService(limiter);
    await service.getAccountByRiotId("Vyoh", "EUW", "europe");

    expect(schedule).toHaveBeenCalledWith(
      "europe",
      "account-by-riot-id",
      expect.any(Function)
    );
  });
});

describe("RiotService.getMatchIdsByPuuid", () => {
  it("returns the array of match ids", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(["EUW1_1", "EUW1_2"]), { status: 200 })
    );
    const service = new RiotService(passThroughLimiter);
    const ids = await service.getMatchIdsByPuuid("puuid-1", "europe");
    expect(ids).toEqual(["EUW1_1", "EUW1_2"]);
  });

  it("appends start and count query params when given", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    const service = new RiotService(passThroughLimiter);
    await service.getMatchIdsByPuuid("puuid-1", "europe", {
      start: 0,
      count: 5,
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/puuid-1/ids?start=0&count=5",
      expect.anything()
    );
  });
});

describe("RiotService.getMatchById", () => {
  it("returns the match detail", async () => {
    const matchData = {
      metadata: { matchId: "EUW1_1", participants: [] },
      info: {
        gameDuration: 1000,
        gameStartTimestamp: 0,
        queueId: 420,
        participants: [],
      },
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(matchData), { status: 200 })
    );
    const service = new RiotService(passThroughLimiter);
    const match = await service.getMatchById("EUW1_1", "europe");
    expect(match).toEqual(matchData);
  });
});

describe("RiotService retry on 429", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries after Retry-After delay and resolves on success", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          statusText: "Too Many Requests",
          headers: { "Retry-After": "1" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ puuid: "p1" }), { status: 200 })
      );

    const service = new RiotService(passThroughLimiter);
    const promise = service.getAccountByRiotId("Vyoh", "EUW", "europe");

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.puuid).toBe("p1");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws RiotError 429 after exhausting retries", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, {
        status: 429,
        statusText: "Too Many Requests",
        headers: { "Retry-After": "1" },
      })
    );

    const service = new RiotService(passThroughLimiter);
    const settled = service
      .getAccountByRiotId("Vyoh", "EUW", "europe")
      .catch((e: unknown) => e);

    await vi.runAllTimersAsync();
    const error = await settled;

    expect(error).toBeInstanceOf(RiotError);
    expect((error as RiotError).status).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});

describe("RiotService fetch timeout", () => {
  it("throws RiotError(504) when the fetch is aborted by AbortSignal.timeout", async () => {
    const timeoutError = new Error("The operation was aborted due to timeout");
    timeoutError.name = "TimeoutError";
    vi.mocked(fetch).mockRejectedValue(timeoutError);

    const service = new RiotService(passThroughLimiter);
    const error = await service.getMatchById("EUW1_1", "europe").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RiotError);
    expect((error as RiotError).status).toBe(504);
    expect((error as RiotError).path).toContain("/lol/match/v5/matches/EUW1_1");
  });

  it("re-throws non-abort errors unchanged", async () => {
    const networkError = new Error("ECONNREFUSED");
    vi.mocked(fetch).mockRejectedValue(networkError);

    const service = new RiotService(passThroughLimiter);
    const error = await service.getMatchById("EUW1_1", "europe").catch((e: unknown) => e);

    expect(error).toBe(networkError);
  });

  it("re-throws a non-Error value unchanged (formatError string branch)", async () => {
    vi.mocked(fetch).mockRejectedValue("plain-string-failure");

    const service = new RiotService(passThroughLimiter);
    const error = await service.getMatchById("EUW1_1", "europe").catch((e: unknown) => e);

    expect(error).toBe("plain-string-failure");
  });

  it("fires hardTimeout when fetch hangs and aborts with RiotError(504)", async () => {
    vi.useFakeTimers();
    try {
      let abortReason: unknown;
      vi.mocked(fetch).mockImplementation(
        (_url, init) =>
          new Promise<Response>((_, reject) => {
            const signal = (init as { signal?: AbortSignal }).signal;
            signal?.addEventListener("abort", () => {
              abortReason = signal.reason;
              reject(signal.reason);
            });
          })
      );

      const service = new RiotService(passThroughLimiter);
      const settled = service.getMatchById("EUW1_1", "europe").catch((e: unknown) => e);
      await vi.runAllTimersAsync();
      const error = await settled;

      expect(error).toBeInstanceOf(RiotError);
      expect((error as RiotError).status).toBe(504);
      expect((abortReason as Error).name).toBe("TimeoutError");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("RiotService.getMatchTimelineById", () => {
  it("returns the timeline payload", async () => {
    const timeline = { metadata: { matchId: "EUW1_1" }, info: { frames: [] } };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(timeline), { status: 200 })
    );
    const service = new RiotService(passThroughLimiter);
    const result = await service.getMatchTimelineById("EUW1_1", "europe");
    expect(result).toEqual(timeline);
    expect(fetch).toHaveBeenCalledWith(
      "https://europe.api.riotgames.com/lol/match/v5/matches/EUW1_1/timeline",
      expect.anything()
    );
  });
});

describe("RiotService.getLeagueEntriesByPuuid", () => {
  it("routes the call through the platform→regional limiter and returns entries", async () => {
    const entries = [{ queueType: "RANKED_SOLO_5x5", tier: "GOLD", rank: "I" }];
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(entries), { status: 200 })
    );
    const schedule = vi.fn(<T>(_: unknown, __: unknown, fn: () => Promise<T>) => fn());
    const limiter = {
      schedule,
      syncFromHeaders: async () => undefined,
    } as unknown as RateLimiterService;
    const service = new RiotService(limiter);

    const result = await service.getLeagueEntriesByPuuid("p1", "euw1");

    expect(result).toEqual(entries);
    expect(schedule).toHaveBeenCalledWith(
      "europe",
      "league-entries-by-puuid",
      expect.any(Function)
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/p1",
      expect.anything()
    );
  });
});

describe("RiotService.getSummonerByPuuid", () => {
  it("returns the summoner payload routed through the platform host", async () => {
    const summoner = { puuid: "p1", summonerLevel: 250, profileIconId: 1 };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(summoner), { status: 200 })
    );
    const service = new RiotService(passThroughLimiter);
    const result = await service.getSummonerByPuuid("p1", "euw1");
    expect(result).toEqual(summoner);
    expect(fetch).toHaveBeenCalledWith(
      "https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/p1",
      expect.anything()
    );
  });
});

describe("RiotService.getActiveGameByPuuid", () => {
  it("returns the active game when the player is in one", async () => {
    const game = { gameId: 1, gameMode: "CLASSIC", participants: [] };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(game), { status: 200 })
    );
    const service = new RiotService(passThroughLimiter);
    const result = await service.getActiveGameByPuuid("p1", "euw1");
    expect(result).toEqual(game);
  });

  it("returns null on 404 (player is not in an active game)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 404, statusText: "Not Found" })
    );
    const service = new RiotService(passThroughLimiter);
    const result = await service.getActiveGameByPuuid("p1", "euw1");
    expect(result).toBeNull();
  });

  it("re-throws non-404 RiotErrors", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 500, statusText: "Internal Server Error" })
    );
    const service = new RiotService(passThroughLimiter);
    const error = await service
      .getActiveGameByPuuid("p1", "euw1")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RiotError);
    expect((error as RiotError).status).toBe(500);
  });
});

describe("RiotService.getChampionMasteryByChampion", () => {
  it("returns mastery payload when present", async () => {
    const mastery = { championId: 1, championPoints: 100000, championLevel: 7 };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mastery), { status: 200 })
    );
    const service = new RiotService(passThroughLimiter);
    const result = await service.getChampionMasteryByChampion("p1", "euw1", 1);
    expect(result).toEqual(mastery);
    expect(fetch).toHaveBeenCalledWith(
      "https://euw1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/p1/by-champion/1",
      expect.anything()
    );
  });

  it("returns null on 404 (player has never played that champion)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 404, statusText: "Not Found" })
    );
    const service = new RiotService(passThroughLimiter);
    const result = await service.getChampionMasteryByChampion("p1", "euw1", 1);
    expect(result).toBeNull();
  });

  it("re-throws non-404 RiotErrors", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 500, statusText: "Internal Server Error" })
    );
    const service = new RiotService(passThroughLimiter);
    const error = await service
      .getChampionMasteryByChampion("p1", "euw1", 1)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RiotError);
    expect((error as RiotError).status).toBe(500);
  });
});
