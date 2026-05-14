import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SteamRateLimiterService } from "./rate-limiter.service";
import { SteamClientError, SteamClientService } from "./steam-client.service";

const ORIGINAL_KEY = process.env.STEAM_API_KEY;

const passThroughLimiter: SteamRateLimiterService = {
  schedule: <T>(_: string, fn: () => Promise<T>) => fn(),
} as unknown as SteamRateLimiterService;

beforeEach(() => {
  process.env.STEAM_API_KEY = "test-key";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.STEAM_API_KEY = ORIGINAL_KEY;
});

describe("SteamClientService.getPlayerSummary", () => {
  it("calls GetPlayerSummaries with the api key and steamid", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            players: [
              {
                steamid: "76561198020053778",
                communityvisibilitystate: 3,
                profilestate: 1,
                personaname: "Vyoh",
                profileurl: "https://steamcommunity.com/id/vyoh/",
                avatarfull: "https://example.com/avatar_full.jpg",
                personastate: 1,
              },
            ],
          },
        }),
        { status: 200 }
      )
    );

    const service = new SteamClientService(passThroughLimiter);
    const player = await service.getPlayerSummary("76561198020053778");

    expect(player?.personaname).toBe("Vyoh");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=test-key&steamids=76561198020053778",
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  it("returns null when the players array is empty", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ response: { players: [] } }), { status: 200 })
    );
    const service = new SteamClientService(passThroughLimiter);
    expect(await service.getPlayerSummary("76561198020053778")).toBeNull();
  });

  it("throws SteamClientError with the upstream status on non-200", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 403, statusText: "Forbidden" })
    );
    const service = new SteamClientService(passThroughLimiter);
    const error = await service
      .getPlayerSummary("76561198020053778")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SteamClientError);
    expect((error as SteamClientError).status).toBe(403);
  });
});

describe("SteamClientService.getWishlist", () => {
  it("calls GetWishlist and returns the items array", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            items: [
              { appid: 214490, priority: 2, date_added: 1466884835 },
              { appid: 383870, priority: 0, date_added: 1455053806 },
            ],
          },
        }),
        { status: 200 }
      )
    );
    const service = new SteamClientService(passThroughLimiter);
    const items = await service.getWishlist("76561198020053778");

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ appid: 214490, priority: 2 });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.steampowered.com/IWishlistService/GetWishlist/v1/?key=test-key&steamid=76561198020053778",
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  it("returns [] when the response omits the items field", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ response: {} }), { status: 200 })
    );
    const service = new SteamClientService(passThroughLimiter);
    expect(await service.getWishlist("76561198020053778")).toEqual([]);
  });
});

describe("SteamClientService.getStoreItems", () => {
  it("skips the fetch entirely when the appid list is empty", async () => {
    const service = new SteamClientService(passThroughLimiter);
    expect(await service.getStoreItems([])).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls GetItems with the requested appids", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            store_items: [
              {
                appid: 214490,
                success: 1,
                name: "Alien: Isolation",
                store_url_path: "app/214490/Alien_Isolation",
              },
            ],
          },
        }),
        { status: 200 }
      )
    );
    const service = new SteamClientService(passThroughLimiter);
    const items = await service.getStoreItems([214490]);

    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe("Alien: Isolation");
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain("/IStoreBrowseService/GetItems/v1/");
    expect(url).toContain(encodeURIComponent('"appid":214490'));
  });
});
