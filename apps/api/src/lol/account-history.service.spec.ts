import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { AccountHistoryService } from "./account-history.service";
import type { LolService } from "./lol.service";

function makeService(opts: { count?: number; first?: unknown } = {}) {
  const lol = { resolveSummoner: vi.fn().mockResolvedValue({ puuid: "P_owner" }) };
  const prisma = {
    match: {
      count: vi.fn().mockResolvedValue(opts.count ?? 569),
      findFirst: vi.fn().mockResolvedValue(
        opts.first === undefined
          ? {
              matchId: "EUW1_1",
              playedAt: new Date("2024-06-01T18:00:00Z"),
              champion: "Azir",
              queueId: 450,
              win: false,
            }
          : opts.first
      ),
    },
  };
  const service = new AccountHistoryService(
    prisma as unknown as PrismaService,
    lol as unknown as LolService
  );
  return { service, lol, prisma };
}

describe("AccountHistoryService.getAccountHistory", () => {
  it("counts the account's games and names its earliest one, remakes left out of both", async () => {
    const { service, prisma } = makeService();
    const history = await service.getAccountHistory("euw1", "Vyoh", "Ahri");
    expect(history).toEqual({
      totalGames: 569,
      firstGame: {
        matchId: "EUW1_1",
        playedAt: "2024-06-01T18:00:00.000Z",
        champion: "Azir",
        queueId: 450,
        win: false,
      },
    });
    const where = { puuid: "P_owner", remake: false };
    expect(prisma.match.count).toHaveBeenCalledWith({ where });
    expect(prisma.match.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where, orderBy: { playedAt: "asc" } })
    );
  });

  it("answers an account with no tracked games yet", async () => {
    const { service } = makeService({ count: 0, first: null });
    expect(await service.getAccountHistory("euw1", "Vyoh", "Ahri")).toEqual({
      totalGames: 0,
      firstGame: null,
    });
  });

  it("goes through the allowlist before reading anything", async () => {
    const { service, lol, prisma } = makeService();
    lol.resolveSummoner.mockRejectedValueOnce(
      new ForbiddenException("Account not in whitelist")
    );
    await expect(
      service.getAccountHistory("euw1", "Stranger", "EUW")
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.match.count).not.toHaveBeenCalled();
  });
});
