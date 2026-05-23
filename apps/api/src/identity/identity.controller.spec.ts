import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { IdentityController } from "./identity.controller";
import { IdentityService } from "./identity.service";

describe("IdentityController", () => {
  it("returns the lol-with-summary and steam lists from IdentityService", async () => {
    const lol = [
      {
        slug: "ahri",
        gameName: "Vyoh",
        tagLine: "Ahri",
        region: "euw1",
        summary: null,
      },
    ];
    const moduleRef = await Test.createTestingModule({
      controllers: [IdentityController],
      providers: [
        {
          provide: IdentityService,
          useValue: {
            getLolAccountsWithSummary: async () => lol,
            getSteamIds: () => [],
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(IdentityController);
    expect(await controller.getMe()).toEqual({ lol, steam: [] });
  });
});
