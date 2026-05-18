import { Test } from "@nestjs/testing";
import { validate } from "class-validator";
import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { OgParamsDto } from "./og-params.dto";
import { OgController } from "./og.controller";
import { OgService } from "./og.service";

describe("OgController.matchCard", () => {
  it("delegates to OgService.generateMatchCard and sends the PNG buffer", async () => {
    const png = Buffer.from("fake-png");
    const generateMatchCard = vi.fn().mockResolvedValue(png);
    const moduleRef = await Test.createTestingModule({
      controllers: [OgController],
      providers: [{ provide: OgService, useValue: { generateMatchCard } }],
    }).compile();
    const controller = moduleRef.get(OgController);

    const send = vi.fn();
    await controller.matchCard(
      { slug: "vyoh-ahri", matchId: "EUW1_42" } as OgParamsDto,
      { send } as unknown as Response
    );

    expect(generateMatchCard).toHaveBeenCalledWith("vyoh-ahri", "EUW1_42");
    expect(send).toHaveBeenCalledWith(png);
  });
});

describe("OgParamsDto", () => {
  function make(overrides: Partial<OgParamsDto>): OgParamsDto {
    return Object.assign(new OgParamsDto(), {
      slug: "vyoh-ahri",
      matchId: "EUW1_42",
      ...overrides,
    });
  }

  it("passes for valid inputs", async () => {
    expect(await validate(make({}))).toHaveLength(0);
  });

  it("rejects an empty slug", async () => {
    const errors = await validate(make({ slug: "" }));
    expect(errors.some((e) => e.property === "slug")).toBe(true);
  });

  it("rejects a matchId without platform prefix", async () => {
    const errors = await validate(make({ matchId: "42" }));
    expect(errors.some((e) => e.property === "matchId")).toBe(true);
  });
});
