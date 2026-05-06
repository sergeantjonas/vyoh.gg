import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { LolController } from "./lol.controller";
import { LolService } from "./lol.service";

describe("LolController", () => {
  it("delegates to LolService.getMatchesForSummoner", async () => {
    const stub = vi.fn().mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      controllers: [LolController],
      providers: [{ provide: LolService, useValue: { getMatchesForSummoner: stub } }],
    }).compile();

    const controller = moduleRef.get(LolController);
    await controller.getMatches("euw1", "Vyoh", "EUW");

    expect(stub).toHaveBeenCalledWith("euw1", "Vyoh", "EUW");
  });
});
