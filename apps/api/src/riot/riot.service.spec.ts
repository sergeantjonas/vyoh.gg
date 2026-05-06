import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RiotError } from "./riot.error";
import { RiotService } from "./riot.service";

const ORIGINAL_KEY = process.env.RIOT_API_KEY;

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

    const service = new RiotService();
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
    const service = new RiotService();
    const error = await service
      .getAccountByRiotId("Foo", "Bar", "europe")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RiotError);
    expect((error as RiotError).status).toBe(404);
    expect((error as RiotError).path).toContain("/accounts/by-riot-id/Foo/Bar");
  });
});

describe("RiotService.getMatchIdsByPuuid", () => {
  it("returns the array of match ids", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(["EUW1_1", "EUW1_2"]), { status: 200 })
    );
    const service = new RiotService();
    const ids = await service.getMatchIdsByPuuid("puuid-1", "europe");
    expect(ids).toEqual(["EUW1_1", "EUW1_2"]);
  });

  it("appends start and count query params when given", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    const service = new RiotService();
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
    const service = new RiotService();
    const match = await service.getMatchById("EUW1_1", "europe");
    expect(match).toEqual(matchData);
  });

  it("throws RiotError with status 429 when rate limited", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 429, statusText: "Too Many Requests" })
    );
    const service = new RiotService();
    const error = await service.getMatchById("EUW1_1", "europe").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RiotError);
    expect((error as RiotError).status).toBe(429);
  });
});
