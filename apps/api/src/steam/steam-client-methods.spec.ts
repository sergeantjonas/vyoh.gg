import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SteamRateLimiterService } from "./rate-limiter.service";
import { SteamClientService } from "./steam-client.service";

const ORIGINAL_KEY = process.env.STEAM_API_KEY;

const passThroughLimiter: SteamRateLimiterService = {
  schedule: <T>(_: string, fn: () => Promise<T>) => fn(),
} as unknown as SteamRateLimiterService;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

beforeEach(() => {
  process.env.STEAM_API_KEY = "test-key";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.STEAM_API_KEY = ORIGINAL_KEY;
});

describe("SteamClientService.getProfileItemsEquipped", () => {
  it("returns the raw response object (no normalization)", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ response: { avatar_frame: {} } }));
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getProfileItemsEquipped("76561198020053778");
    expect(result).toEqual({ avatar_frame: {} });
  });

  it("returns an empty object when Steam responds with `{ response: {} }`", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ response: {} }));
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getProfileItemsEquipped("76561198020053778");
    expect(result).toEqual({});
  });
});

describe("SteamClientService.getWishlist", () => {
  it("returns the items array", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ response: { items: [{ appid: 42 }] } })
    );
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getWishlist("76561198020053778");
    expect(result).toEqual([{ appid: 42 }]);
  });

  it("normalizes a missing `items` to an empty array", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ response: {} }));
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getWishlist("76561198020053778");
    expect(result).toEqual([]);
  });
});

describe("SteamClientService.getOwnedGames", () => {
  it("returns the games array", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ response: { games: [{ appid: 42, name: "Half-Life" }] } })
    );
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getOwnedGames("76561198020053778");
    expect(result).toHaveLength(1);
    expect(result[0]?.appid).toBe(42);
  });

  it("normalizes a private library to []", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ response: {} }));
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getOwnedGames("76561198020053778");
    expect(result).toEqual([]);
  });
});

describe("SteamClientService.getRecentlyPlayedGames", () => {
  it("returns the games array", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ response: { games: [{ appid: 42, playtime_2weeks: 12 }] } })
    );
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getRecentlyPlayedGames("76561198020053778");
    expect(result).toHaveLength(1);
  });

  it("normalizes missing `games` to []", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ response: {} }));
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getRecentlyPlayedGames("76561198020053778");
    expect(result).toEqual([]);
  });
});

describe("SteamClientService.getStoreItems", () => {
  it("returns [] without calling fetch when appids is empty", async () => {
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getStoreItems([]);
    expect(result).toEqual([]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("returns the store_items array when populated", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ response: { store_items: [{ appid: 42 }] } })
    );
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getStoreItems([42]);
    expect(result).toHaveLength(1);
  });

  it("normalizes missing store_items to []", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ response: {} }));
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getStoreItems([42]);
    expect(result).toEqual([]);
  });
});

describe("SteamClientService.getStoreItemsFull", () => {
  it("returns [] without calling fetch when appids is empty", async () => {
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getStoreItemsFull([]);
    expect(result).toEqual([]);
  });

  it("returns store_items with the full data_request set", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ response: { store_items: [{ appid: 42, assets: {} }] } })
    );
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getStoreItemsFull([42]);
    expect(result).toHaveLength(1);
  });
});

describe("SteamClientService.getTagList", () => {
  it("returns the tags array", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ response: { tags: [{ tagid: 1, name: "Action" }] } })
    );
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getTagList();
    expect(result).toHaveLength(1);
  });

  it("normalizes a missing tags array to []", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ response: {} }));
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getTagList();
    expect(result).toEqual([]);
  });
});

describe("SteamClientService.getGameAchievementSchema", () => {
  it("composes iconUrl / iconGrayUrl from the appid + icon filename", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        response: {
          achievements: [
            {
              internal_name: "FIRST_KILL",
              localized_name: "First Kill",
              localized_desc: "You killed something.",
              icon: "first.jpg",
              icon_gray: "first_gray.jpg",
              hidden: 0,
            },
          ],
        },
      })
    );
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getGameAchievementSchema(42);
    expect(result).toHaveLength(1);
    expect(result[0]?.iconUrl).toBe(
      "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/42/first.jpg"
    );
    expect(result[0]?.iconGrayUrl).toBe(
      "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/42/first_gray.jpg"
    );
  });

  it("returns [] when the schema has no achievements", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ response: {} }));
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getGameAchievementSchema(42);
    expect(result).toEqual([]);
  });
});

describe("SteamClientService.getPlayerAchievements", () => {
  it("returns null when playerstats.success is false", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ playerstats: { success: false } }));
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getPlayerAchievements("76561198020053778", 42);
    expect(result).toBeNull();
  });

  it("returns the unlock rows when playerstats.success is true", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        playerstats: {
          success: true,
          achievements: [{ apiname: "FIRST_KILL", achieved: 1, unlocktime: 1700000000 }],
        },
      })
    );
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getPlayerAchievements("76561198020053778", 42);
    expect(result).toHaveLength(1);
  });

  it("normalizes missing achievements array to []", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ playerstats: { success: true } }));
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getPlayerAchievements("76561198020053778", 42);
    expect(result).toEqual([]);
  });
});

describe("SteamClientService.getGlobalAchievementPercentages", () => {
  it("coerces percent strings to numbers at the boundary", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        achievementpercentages: {
          achievements: [
            { name: "FIRST_KILL", percent: "70.4" },
            { name: "BOSS_DOWN", percent: 3.2 },
          ],
        },
      })
    );
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getGlobalAchievementPercentages(42);
    expect(result[0]?.percent).toBe(70.4);
    expect(result[1]?.percent).toBe(3.2);
  });

  it("normalizes missing achievements to []", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ achievementpercentages: {} }));
    const service = new SteamClientService(passThroughLimiter);
    const result = await service.getGlobalAchievementPercentages(42);
    expect(result).toEqual([]);
  });
});
