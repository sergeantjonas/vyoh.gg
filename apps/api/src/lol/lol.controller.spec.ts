import { Test } from "@nestjs/testing";
import { validate } from "class-validator";
import { describe, expect, it, vi } from "vitest";
import { AccountParamsDto } from "./account-params.dto";
import { LolAnalyticsService } from "./lol-analytics.service";
import { LolController } from "./lol.controller";
import { LolService } from "./lol.service";

describe("LolController", () => {
  it("delegates to LolService.getMatchesForSummoner", async () => {
    const stub = vi.fn().mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      controllers: [LolController],
      providers: [
        { provide: LolService, useValue: { getMatchesForSummoner: stub } },
        { provide: LolAnalyticsService, useValue: {} },
      ],
    }).compile();

    const controller = moduleRef.get(LolController);
    await controller.getMatches(
      { region: "euw1", gameName: "Vyoh", tagLine: "EUW" } as AccountParamsDto,
      0,
      20
    );

    expect(stub).toHaveBeenCalledWith("euw1", "Vyoh", "EUW", 0, 20, undefined);
  });
});

describe("AccountParamsDto", () => {
  function make(overrides: Partial<AccountParamsDto>): AccountParamsDto {
    return Object.assign(new AccountParamsDto(), {
      region: "euw1",
      gameName: "Vyoh",
      tagLine: "EUW",
      ...overrides,
    });
  }

  it("passes for valid inputs", async () => {
    expect(await validate(make({}))).toHaveLength(0);
  });

  it("passes for a gameName with spaces and dots", async () => {
    expect(await validate(make({ gameName: "twtv tifa lol" }))).toHaveLength(0);
  });

  it("rejects an unknown region", async () => {
    const errors = await validate(make({ region: "invalid" }));
    expect(errors.some((e) => e.property === "region")).toBe(true);
  });

  it("rejects a gameName shorter than 3 chars", async () => {
    const errors = await validate(make({ gameName: "Ab" }));
    expect(errors.some((e) => e.property === "gameName")).toBe(true);
  });

  it("rejects a gameName exceeding 16 chars", async () => {
    const errors = await validate(make({ gameName: "A".repeat(17) }));
    expect(errors.some((e) => e.property === "gameName")).toBe(true);
  });

  it("rejects a tagLine shorter than 3 chars", async () => {
    const errors = await validate(make({ tagLine: "AB" }));
    expect(errors.some((e) => e.property === "tagLine")).toBe(true);
  });

  it("rejects a tagLine longer than 5 chars", async () => {
    const errors = await validate(make({ tagLine: "TOOLONG" }));
    expect(errors.some((e) => e.property === "tagLine")).toBe(true);
  });
});
