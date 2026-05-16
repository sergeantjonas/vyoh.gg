import { Test } from "@nestjs/testing";
import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";
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
    await controller.matchCard("vyoh-ahri", "EUW1_42", { send } as unknown as Response);

    expect(generateMatchCard).toHaveBeenCalledWith("vyoh-ahri", "EUW1_42");
    expect(send).toHaveBeenCalledWith(png);
  });
});
