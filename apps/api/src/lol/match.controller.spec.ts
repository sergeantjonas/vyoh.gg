import { Test } from "@nestjs/testing";
import { validate } from "class-validator";
import { describe, expect, it, vi } from "vitest";
import { LolService } from "./lol.service";
import { MatchIdParamDto } from "./match-id-param.dto";
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

    await controller.getMatch({ matchId: "EUW1_42" } as MatchIdParamDto);
    expect(stub).toHaveBeenCalledWith("EUW1_42");
  });

  it("delegates getTimeline to LolService.getMatchTimeline", async () => {
    const stub = vi.fn().mockResolvedValue({ matchId: "EUW1_42", frames: [] });
    const controller = await build({
      getMatchTimeline: stub,
    } as unknown as Partial<LolService>);

    await controller.getTimeline({ matchId: "EUW1_42" } as MatchIdParamDto);
    expect(stub).toHaveBeenCalledWith("EUW1_42");
  });
});

describe("MatchIdParamDto", () => {
  function make(matchId: string): MatchIdParamDto {
    return Object.assign(new MatchIdParamDto(), { matchId });
  }

  it("passes for EUW1_42", async () => {
    expect(await validate(make("EUW1_42"))).toHaveLength(0);
  });

  it("passes for other platform prefixes", async () => {
    expect(await validate(make("NA1_99999"))).toHaveLength(0);
  });

  it("rejects a matchId without underscore separator", async () => {
    const errors = await validate(make("12345"));
    expect(errors.some((e) => e.property === "matchId")).toBe(true);
  });

  it("rejects a lowercase platform prefix", async () => {
    const errors = await validate(make("euw1_42"));
    expect(errors.some((e) => e.property === "matchId")).toBe(true);
  });
});
