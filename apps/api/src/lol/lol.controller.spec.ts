import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { LolController } from "./lol.controller";

describe("LolController", () => {
  it("returns a non-empty list of matches", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LolController],
    }).compile();

    const controller = moduleRef.get(LolController);
    const matches = controller.getMatches();

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toMatchObject({
      matchId: expect.any(String),
      champion: expect.any(String),
      win: expect.any(Boolean),
    });
  });
});
