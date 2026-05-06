import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { PrismaService } from "../prisma/prisma.service";
import { LolController } from "./lol.controller";

describe("LolController", () => {
  it("returns matches mapped from prisma rows", async () => {
    const playedAt = new Date("2026-05-01T12:00:00Z");
    const findMany = vi.fn().mockResolvedValue([
      {
        matchId: "EUW1_test",
        queueType: "Ranked Solo",
        champion: "Ahri",
        kills: 8,
        deaths: 3,
        assists: 12,
        win: true,
        durationSec: 1834,
        playedAt,
      },
    ]);

    const moduleRef = await Test.createTestingModule({
      controllers: [LolController],
      providers: [{ provide: PrismaService, useValue: { match: { findMany } } }],
    }).compile();

    const controller = moduleRef.get(LolController);
    const matches = await controller.getMatches();

    expect(findMany).toHaveBeenCalledWith({ orderBy: { playedAt: "desc" } });
    expect(matches).toEqual([
      {
        matchId: "EUW1_test",
        queueType: "Ranked Solo",
        champion: "Ahri",
        kills: 8,
        deaths: 3,
        assists: 12,
        win: true,
        durationSec: 1834,
        playedAt: playedAt.toISOString(),
      },
    ]);
  });
});
