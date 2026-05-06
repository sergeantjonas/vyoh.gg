import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { IdentityController } from "./identity.controller";
import { IdentityService } from "./identity.service";

describe("IdentityController", () => {
  it("returns the lol and steam lists from IdentityService", async () => {
    const lol = [{ gameName: "Vyoh", tagLine: "Ahri", region: "euw1" }];
    const moduleRef = await Test.createTestingModule({
      controllers: [IdentityController],
      providers: [
        {
          provide: IdentityService,
          useValue: {
            getLolAccounts: () => lol,
            getSteamIds: () => [],
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(IdentityController);
    expect(controller.getMe()).toEqual({ lol, steam: [] });
  });
});
