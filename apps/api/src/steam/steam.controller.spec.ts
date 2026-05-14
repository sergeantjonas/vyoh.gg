import { Test } from "@nestjs/testing";
import type { SteamSummary } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import { SteamController } from "./steam.controller";
import { SteamService } from "./steam.service";

describe("SteamController", () => {
  it("delegates to SteamService.getOwnerSummary", async () => {
    const summary: SteamSummary = {
      steamId: "76561198020053778",
      personaName: "Vyoh",
      profileUrl: "https://steamcommunity.com/id/vyoh/",
      avatarUrl: "https://example.com/avatar_full.jpg",
      personaState: "online",
      currentGame: null,
      privacyPrereqs: { profilePublic: true, gameDetailsPublic: "unknown" },
    };
    const stub = vi.fn().mockResolvedValue(summary);

    const moduleRef = await Test.createTestingModule({
      controllers: [SteamController],
      providers: [{ provide: SteamService, useValue: { getOwnerSummary: stub } }],
    }).compile();

    const controller = moduleRef.get(SteamController);
    await expect(controller.getSummary()).resolves.toBe(summary);
    expect(stub).toHaveBeenCalledOnce();
  });
});
