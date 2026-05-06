import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RateLimiterService } from "./rate-limiter.service";
import { RiotError } from "./riot.error";
import { RiotService } from "./riot.service";

const ORIGINAL_KEY = process.env.RIOT_API_KEY;

const passThroughLimiter: RateLimiterService = {
  schedule: <T>(_: unknown, fn: () => Promise<T>) => fn(),
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
      { headers: { "X-Riot-Token": "test-key" } }
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

  it("routes the call through the rate limiter for the regional cluster", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const schedule = vi.fn(<T>(_: unknown, fn: () => Promise<T>) => fn());
    const limiter = { schedule } as unknown as RateLimiterService;

    const service = new RiotService(limiter);
    await service.getAccountByRiotId("Vyoh", "EUW", "europe");

    expect(schedule).toHaveBeenCalledWith("europe", expect.any(Function));
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
