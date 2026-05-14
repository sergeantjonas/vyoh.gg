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
