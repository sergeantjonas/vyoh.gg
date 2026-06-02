import { describe, expect, it, vi } from "vitest";
import type { IdentityService } from "../identity/identity.service";
import type { PrismaService } from "../prisma/prisma.service";
import { HomeTodayService } from "./home-today.service";

interface MatchRow {
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
}

interface SessionRow {
  startedAt: Date;
  endedAt: Date | null;
}

function makeService(opts: {
  matches?: MatchRow[];
  sessions?: SessionRow[];
  unlockCount?: number;
  ownerPuuids?: string[];
}) {
  const prisma = {
    match: { findMany: vi.fn().mockResolvedValue(opts.matches ?? []) },
    steamPlaySession: {
      findMany: vi.fn().mockResolvedValue(opts.sessions ?? []),
    },
    steamPlayerUnlock: { count: vi.fn().mockResolvedValue(opts.unlockCount ?? 0) },
  } as unknown as PrismaService;
  const identity = {
    getOwnerPuuids: vi.fn().mockResolvedValue(opts.ownerPuuids ?? ["P_owner"]),
  } as unknown as IdentityService;
  return {
    service: new HomeTodayService(prisma, identity),
    prisma,
    identity,
  };
}

describe("HomeTodayService.getToday", () => {
  it("returns zero stats when nothing happened in the window", async () => {
    const { service } = makeService({});
    const result = await service.getToday();
    expect(result.lolMatches).toBe(0);
    expect(result.lolWins).toBe(0);
    expect(result.lolLosses).toBe(0);
    expect(result.kills).toBe(0);
    expect(result.deaths).toBe(0);
    expect(result.assists).toBe(0);
    expect(result.steamMinutes).toBe(0);
    expect(result.achievementUnlocks).toBe(0);
    expect(result.timeZone).toBe("Europe/Brussels");
  });

  it("aggregates KDA and win/loss across matches", async () => {
    const { service } = makeService({
      matches: [
        { kills: 6, deaths: 3, assists: 9, win: true },
        { kills: 2, deaths: 5, assists: 4, win: false },
        { kills: 8, deaths: 4, assists: 12, win: true },
      ],
      unlockCount: 4,
    });
    const result = await service.getToday();
    expect(result.lolMatches).toBe(3);
    expect(result.lolWins).toBe(2);
    expect(result.lolLosses).toBe(1);
    expect(result.kills).toBe(16);
    expect(result.deaths).toBe(12);
    expect(result.assists).toBe(25);
    expect(result.achievementUnlocks).toBe(4);
  });

  it("filters matches to owner-resolved puuids and the rolling-24h window", async () => {
    const { service, prisma } = makeService({ ownerPuuids: ["P_A", "P_B"] });
    await service.getToday();
    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          remake: false,
          puuid: { in: ["P_A", "P_B"] },
          playedAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    );
  });

  it("counts unlocks inside the rolling-24h window", async () => {
    const { service, prisma } = makeService({ unlockCount: 7 });
    const result = await service.getToday();
    expect(result.achievementUnlocks).toBe(7);
    expect(prisma.steamPlayerUnlock.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          unlockedAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    );
  });
});
