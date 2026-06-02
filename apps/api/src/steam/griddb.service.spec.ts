import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SteamGridDbService } from "./griddb.service";

const ORIGINAL_KEY = process.env.STEAM_GRIDDB_API_KEY;

function mockJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  process.env.STEAM_GRIDDB_API_KEY = "sgdb-test-key";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.STEAM_GRIDDB_API_KEY = ORIGINAL_KEY;
});

describe("SteamGridDbService.findHero", () => {
  it("hits the heroes/steam/{appid} endpoint with the Bearer token", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockJson({
        success: true,
        data: [
          {
            id: 1,
            score: 10,
            width: 3840,
            height: 1240,
            nsfw: false,
            humor: false,
            epilepsy: false,
            url: "https://cdn2.steamgriddb.com/hero/abc.jpg",
          },
        ],
      })
    );

    const service = new SteamGridDbService();
    const hero = await service.findHero(220);

    expect(hero).toEqual({
      url: "https://cdn2.steamgriddb.com/hero/abc.jpg",
      width: 3840,
      height: 1240,
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v2/heroes/steam/220"),
      expect.objectContaining({
        headers: { Authorization: "Bearer sgdb-test-key" },
      })
    );
  });

  it("picks the highest-scored row, tiebreaking by width desc", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockJson({
        success: true,
        data: [
          {
            id: 1,
            score: 5,
            width: 1920,
            height: 620,
            nsfw: false,
            humor: false,
            epilepsy: false,
            url: "https://cdn2.steamgriddb.com/hero/low-score.jpg",
          },
          {
            id: 2,
            score: 10,
            width: 1920,
            height: 620,
            nsfw: false,
            humor: false,
            epilepsy: false,
            url: "https://cdn2.steamgriddb.com/hero/winner-narrow.jpg",
          },
          {
            id: 3,
            score: 10,
            width: 3840,
            height: 1240,
            nsfw: false,
            humor: false,
            epilepsy: false,
            url: "https://cdn2.steamgriddb.com/hero/winner-wide.jpg",
          },
        ],
      })
    );

    const service = new SteamGridDbService();
    const hero = await service.findHero(220);

    expect(hero?.url).toBe("https://cdn2.steamgriddb.com/hero/winner-wide.jpg");
  });

  it("rejects heroes below the 1920w minimum", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockJson({
        success: true,
        data: [
          {
            id: 1,
            score: 99,
            width: 1280,
            height: 414,
            nsfw: false,
            humor: false,
            epilepsy: false,
            url: "https://cdn2.steamgriddb.com/hero/too-small.jpg",
          },
        ],
      })
    );

    const service = new SteamGridDbService();
    const hero = await service.findHero(220);
    expect(hero).toBeNull();
  });

  it("filters NSFW/humor/epilepsy rows even if the API didn't", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockJson({
        success: true,
        data: [
          {
            id: 1,
            score: 99,
            width: 3840,
            height: 1240,
            nsfw: true,
            humor: false,
            epilepsy: false,
            url: "https://cdn2.steamgriddb.com/hero/nsfw.jpg",
          },
          {
            id: 2,
            score: 1,
            width: 1920,
            height: 620,
            nsfw: false,
            humor: false,
            epilepsy: false,
            url: "https://cdn2.steamgriddb.com/hero/clean.jpg",
          },
        ],
      })
    );

    const service = new SteamGridDbService();
    const hero = await service.findHero(220);
    expect(hero?.url).toBe("https://cdn2.steamgriddb.com/hero/clean.jpg");
  });

  it("returns null on 404 (unknown appid)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    const service = new SteamGridDbService();
    const hero = await service.findHero(99999999);
    expect(hero).toBeNull();
  });

  it("returns null on non-2xx HTTP errors (auth / rate limit / 5xx)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 429 }));
    const service = new SteamGridDbService();
    const hero = await service.findHero(220);
    expect(hero).toBeNull();
  });

  it("returns null on fetch rejection (network / abort)", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNRESET"));
    const service = new SteamGridDbService();
    const hero = await service.findHero(220);
    expect(hero).toBeNull();
  });

  it("returns null on a malformed JSON response body", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<html>not json</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );
    const service = new SteamGridDbService();
    const hero = await service.findHero(220);
    expect(hero).toBeNull();
  });

  it("returns null on success=false bodies", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockJson({ success: false, errors: ["rate limit"] })
    );
    const service = new SteamGridDbService();
    const hero = await service.findHero(220);
    expect(hero).toBeNull();
  });

  it("returns null when data array is empty", async () => {
    vi.mocked(fetch).mockResolvedValue(mockJson({ success: true, data: [] }));
    const service = new SteamGridDbService();
    const hero = await service.findHero(220);
    expect(hero).toBeNull();
  });

  it("short-circuits to null and never calls fetch when the API key is missing", async () => {
    process.env.STEAM_GRIDDB_API_KEY = "";
    const service = new SteamGridDbService();
    const hero = await service.findHero(220);
    expect(hero).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
