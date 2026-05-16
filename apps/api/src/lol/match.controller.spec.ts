import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { LolService } from "./lol.service";
import { MatchController } from "./match.controller";

describe("MatchController", () => {
  async function build(stubs: Partial<LolService>): Promise<MatchController> {
    const moduleRef = await Test.createTestingModule({
      controllers: [MatchController],
      providers: [{ provide: LolService, useValue: stubs }],
    }).compile();
    return moduleRef.get(MatchController);
  }

  it("delegates getMatch to LolService.getMatchDetail", async () => {
    const stub = vi.fn().mockResolvedValue({ matchId: "EUW1_42" });
    const controller = await build({
      getMatchDetail: stub,
    } as unknown as Partial<LolService>);

    await controller.getMatch("EUW1_42");
    expect(stub).toHaveBeenCalledWith("EUW1_42");
  });

  it("delegates getTimeline to LolService.getMatchTimeline", async () => {
    const stub = vi.fn().mockResolvedValue({ matchId: "EUW1_42", frames: [] });
    const controller = await build({
      getMatchTimeline: stub,
    } as unknown as Partial<LolService>);

    await controller.getTimeline("EUW1_42");
    expect(stub).toHaveBeenCalledWith("EUW1_42");
  });
});
