import { describe, expect, it, vi } from "vitest";
import { SteamClientService } from "./steam-client.service";
import { SteamService } from "./steam.service";
import type { SteamPlayerRaw } from "./types";

function makeService(player: SteamPlayerRaw | null): SteamService {
  const client = {
    getPlayerSummary: vi.fn().mockResolvedValue(player),
  } as unknown as SteamClientService;
  return new SteamService(client);
}

const basePlayer: SteamPlayerRaw = {
  steamid: "76561198020053778",
  communityvisibilitystate: 3,
  profilestate: 1,
  personaname: "Vyoh",
  profileurl: "https://steamcommunity.com/id/vyoh/",
  avatarfull: "https://example.com/avatar_full.jpg",
  personastate: 1,
};

describe("SteamService.getOwnerSummary", () => {
  it("maps a public profile to a SteamSummary with privacyPrereqs.profilePublic=true", async () => {
    const summary = await makeService(basePlayer).getOwnerSummary();
    expect(summary).toMatchObject({
      steamId: "76561198020053778",
      personaName: "Vyoh",
      personaState: "online",
      currentGame: null,
      privacyPrereqs: { profilePublic: true, gameDetailsPublic: "unknown" },
    });
  });

  it("surfaces profilePublic=false when communityvisibilitystate < 3", async () => {
    const summary = await makeService({
      ...basePlayer,
      communityvisibilitystate: 1,
    }).getOwnerSummary();
    expect(summary.privacyPrereqs.profilePublic).toBe(false);
    expect(summary.privacyPrereqs.gameDetailsPublic).toBe("unknown");
  });

  it("populates currentGame when the player is in-game", async () => {
    const summary = await makeService({
      ...basePlayer,
      gameid: "440",
      gameextrainfo: "Team Fortress 2",
    }).getOwnerSummary();
    expect(summary.currentGame).toEqual({ appid: 440, name: "Team Fortress 2" });
  });

  it("throws when GetPlayerSummaries returns no players for the owner id", async () => {
    await expect(makeService(null).getOwnerSummary()).rejects.toThrow(
      /Steam profile not found/
    );
  });
});
