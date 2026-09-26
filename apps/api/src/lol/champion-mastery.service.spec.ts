import { ForbiddenException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { RiotService } from "../riot/riot.service";
import { ChampionMasteryService, MASTERY_CACHE_MS } from "./champion-mastery.service";
import type { LolService } from "./lol.service";

const AHRI = {
  championId: 103,
  championLevel: 105,
  championPoints: 1_124_191,
  lastPlayTime: Date.parse("2026-09-10T20:00:00Z"),
};

function makeService(opts: { championId?: number | null; masteries?: unknown } = {}) {
  const lol = {
    resolveSummoner: vi.fn().mockResolvedValue({ puuid: "P_owner" }),
  };
  const riot = {
    getChampionMasteries: vi.fn().mockResolvedValue(opts.masteries ?? [AHRI]),
  };
  const championId = opts.championId === undefined ? 103 : opts.championId;
  const prisma = {
    lolChampion: {
      findFirst: vi
        .fn()
        .mockResolvedValue(championId === null ? null : { id: championId }),
      findMany: vi.fn().mockResolvedValue([
        { id: 103, alias: "Ahri" },
        { id: 62, alias: "MonkeyKing" },
      ]),
    },
  };
  const service = new ChampionMasteryService(
    prisma as unknown as PrismaService,
    riot as unknown as RiotService,
    lol as unknown as LolService
  );
  return { service, lol, riot, prisma };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ChampionMasteryService.getChampionMastery", () => {
  it("answers the champion's level, points and last game from Riot's list", async () => {
    const { service, riot } = makeService();
    const result = await service.getChampionMastery("EUW1", "Vyoh", "EUW", "ahri");
    expect(result).toEqual({
      mastery: {
        level: 105,
        points: 1_124_191,
        lastPlayedAt: "2026-09-10T20:00:00.000Z",
      },
    });
    expect(riot.getChampionMasteries).toHaveBeenCalledWith("P_owner", "euw1");
  });

  it("matches the route's lowercase key to the stored alias without regard to case", async () => {
    const { service, prisma } = makeService();
    await service.getChampionMastery("euw1", "Vyoh", "EUW", "monkeyking");
    expect(prisma.lolChampion.findFirst).toHaveBeenCalledWith({
      where: { alias: { equals: "monkeyking", mode: "insensitive" } },
      select: { id: true },
    });
  });

  it("answers null for a champion the account has never played", async () => {
    const { service } = makeService({ championId: 7 });
    expect(await service.getChampionMastery("euw1", "Vyoh", "EUW", "leblanc")).toEqual({
      mastery: null,
    });
  });

  it("answers null for a champion the static sync has not stored", async () => {
    const { service } = makeService({ championId: null });
    expect(await service.getChampionMastery("euw1", "Vyoh", "EUW", "newchamp")).toEqual({
      mastery: null,
    });
  });

  it("asks Riot once per account per window, then again once it lapses", async () => {
    vi.useFakeTimers();
    const { service, riot } = makeService();
    await service.getChampionMastery("euw1", "Vyoh", "EUW", "ahri");
    await service.getChampionMastery("euw1", "Vyoh", "EUW", "ahri");
    expect(riot.getChampionMasteries).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(MASTERY_CACHE_MS);
    await service.getChampionMastery("euw1", "Vyoh", "EUW", "ahri");
    expect(riot.getChampionMasteries).toHaveBeenCalledTimes(2);
  });

  it("shares one Riot call between panels opened at the same moment", async () => {
    const { service, riot } = makeService();
    await Promise.all([
      service.getChampionMastery("euw1", "Vyoh", "EUW", "ahri"),
      service.getChampionMastery("euw1", "Vyoh", "EUW", "ahri"),
    ]);
    expect(riot.getChampionMasteries).toHaveBeenCalledTimes(1);
  });

  it("lets a slow failure from a lapsed window leave the newer entry alone", async () => {
    vi.useFakeTimers();
    const { service, riot } = makeService();
    let rejectFirst: (err: Error) => void = () => undefined;
    riot.getChampionMasteries.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectFirst = reject;
      })
    );
    const first = service.getChampionMastery("euw1", "Vyoh", "EUW", "ahri");
    await vi.advanceTimersByTimeAsync(MASTERY_CACHE_MS);
    await service.getChampionMastery("euw1", "Vyoh", "EUW", "ahri");
    rejectFirst(new Error("Riot 503"));
    await expect(first).rejects.toThrow(/Riot 503/);

    await service.getChampionMastery("euw1", "Vyoh", "EUW", "ahri");
    expect(riot.getChampionMasteries).toHaveBeenCalledTimes(2);
  });

  it("does not keep a failed Riot call for the rest of the window", async () => {
    const { service, riot } = makeService();
    riot.getChampionMasteries.mockRejectedValueOnce(new Error("Riot 503"));
    await expect(
      service.getChampionMastery("euw1", "Vyoh", "EUW", "ahri")
    ).rejects.toThrow(/Riot 503/);
    await expect(
      service.getChampionMastery("euw1", "Vyoh", "EUW", "ahri")
    ).resolves.toMatchObject({ mastery: { level: 105 } });
  });

  it("goes through the allowlist before spending any Riot budget", async () => {
    const { service, lol, riot } = makeService();
    lol.resolveSummoner.mockRejectedValueOnce(
      new ForbiddenException("Account not in whitelist")
    );
    await expect(
      service.getChampionMastery("euw1", "Stranger", "EUW", "ahri")
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(riot.getChampionMasteries).not.toHaveBeenCalled();
  });
});

describe("ChampionMasteryService.getMasteryList", () => {
  const WUKONG = {
    championId: 62,
    championLevel: 19,
    championPoints: 228_511,
    lastPlayTime: Date.parse("2026-09-04T20:00:00Z"),
  };
  const UNSYNCED = { ...WUKONG, championId: 999, championPoints: 5_000_000 };

  it("lists every champion by points, named by alias, leaving out ones with none stored", async () => {
    const { service, prisma } = makeService({ masteries: [WUKONG, UNSYNCED, AHRI] });
    const { champions } = await service.getMasteryList("euw1", "Vyoh", "EUW");
    expect(prisma.lolChampion.findMany).toHaveBeenCalledWith({
      where: { id: { in: [62, 999, 103] } },
      select: { id: true, alias: true },
    });
    expect(champions.map((c) => [c.alias, c.level, c.points])).toEqual([
      ["Ahri", 105, 1_124_191],
      ["MonkeyKing", 19, 228_511],
    ]);
  });

  it("shares the cached Riot answer with the per-champion read", async () => {
    const { service, riot } = makeService();
    await service.getMasteryList("euw1", "Vyoh", "EUW");
    await service.getChampionMastery("euw1", "Vyoh", "EUW", "ahri");
    expect(riot.getChampionMasteries).toHaveBeenCalledTimes(1);
  });
});
