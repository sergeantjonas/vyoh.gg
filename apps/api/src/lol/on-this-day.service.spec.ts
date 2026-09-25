import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { LolService } from "./lol.service";
import {
  type OnThisDayRow,
  OnThisDayService,
  buildOnThisDay,
  onThisDayTargets,
} from "./on-this-day.service";

// Midday in Brussels on 25 September 2026.
const NOW = new Date("2026-09-25T10:00:00Z");

let seq = 0;
function game(playedAt: string, over: Partial<OnThisDayRow> = {}): OnThisDayRow {
  seq += 1;
  return {
    matchId: `EUW1_${seq}`,
    playedAt: new Date(playedAt),
    remake: false,
    win: true,
    champion: "Ahri",
    kills: 5,
    deaths: 5,
    assists: 5,
    ...over,
  };
}

describe("buildOnThisDay", () => {
  it("summarises the games played on the same date a year ago", () => {
    const { years } = buildOnThisDay(
      [
        game("2025-09-25T18:00:00Z", { kills: 12, deaths: 2, assists: 9 }),
        game("2025-09-25T19:00:00Z", { win: false }),
        // A better line in a loss: the headline is still the day's best win.
        game("2025-09-25T21:00:00Z", { win: false, kills: 20, deaths: 0, assists: 10 }),
        game("2025-09-25T20:00:00Z", {
          champion: "Vex",
          kills: 2,
          deaths: 1,
          assists: 1,
        }),
      ],
      NOW
    );
    expect(years).toHaveLength(1);
    expect(years[0]).toMatchObject({
      yearsAgo: 1,
      date: "2025-09-25",
      exact: true,
      games: 4,
      wins: 2,
      topChampion: "Ahri",
      headline: { champion: "Ahri", win: true, kills: 12, deaths: 2, assists: 9 },
    });
  });

  it("stands in the nearest day within the window when the date itself was empty", () => {
    const { years } = buildOnThisDay(
      [
        game("2025-09-23T18:00:00Z"),
        // Busier, and at the window's edge: inside it, but the nearer day wins.
        game("2025-09-28T17:00:00Z"),
        game("2025-09-28T18:00:00Z"),
      ],
      NOW
    );
    expect(years[0]).toMatchObject({ date: "2025-09-23", exact: false, games: 1 });
  });

  it("takes the window's edge day and nothing past it", () => {
    const edge = buildOnThisDay([game("2025-09-28T18:00:00Z")], NOW);
    expect(edge.years[0]).toMatchObject({ date: "2025-09-28" });
    const past = buildOnThisDay([game("2025-09-29T18:00:00Z")], NOW);
    expect(past.years).toEqual([]);
  });

  it("gives a tie on distance to the busier day", () => {
    const { years } = buildOnThisDay(
      [
        game("2025-09-24T18:00:00Z"),
        game("2025-09-26T17:00:00Z"),
        game("2025-09-26T18:00:00Z"),
      ],
      NOW
    );
    expect(years[0]).toMatchObject({ date: "2025-09-26", games: 2 });
  });

  it("reads the date in Brussels, not UTC", () => {
    // 22:30 UTC on the 24th is 00:30 on the 25th in Brussels summer time.
    const { years } = buildOnThisDay([game("2025-09-24T22:30:00Z")], NOW);
    expect(years[0]).toMatchObject({ date: "2025-09-25", exact: true });
  });

  it("leaves remakes out of the count, and out of the card when that is all there was", () => {
    const both = buildOnThisDay(
      [game("2025-09-25T18:00:00Z"), game("2025-09-25T19:00:00Z", { remake: true })],
      NOW
    );
    expect(both.years[0]?.games).toBe(1);
    const onlyRemake = buildOnThisDay(
      [game("2025-09-25T19:00:00Z", { remake: true })],
      NOW
    );
    expect(onlyRemake.years).toEqual([]);
  });

  it("falls back to the best KDA when the day had no wins", () => {
    const { years } = buildOnThisDay(
      [
        game("2025-09-25T18:00:00Z", { win: false, kills: 1, deaths: 8, assists: 2 }),
        game("2025-09-25T19:00:00Z", { win: false, kills: 7, deaths: 3, assists: 6 }),
      ],
      NOW
    );
    expect(years[0]?.headline).toMatchObject({ win: false, kills: 7 });
  });

  it("lists each earlier year with games, most recent first", () => {
    const { years } = buildOnThisDay(
      [game("2024-09-25T18:00:00Z"), game("2025-09-25T18:00:00Z")],
      NOW
    );
    expect(years.map((y) => [y.yearsAgo, y.date])).toEqual([
      [1, "2025-09-25"],
      [2, "2024-09-25"],
    ]);
  });
});

describe("onThisDayTargets", () => {
  it("takes today from the Brussels clock, not UTC", () => {
    // 22:30 UTC on the 24th is already the 25th in Brussels.
    const [lastYear] = onThisDayTargets(new Date("2026-09-24T22:30:00Z"));
    expect(lastYear?.date).toBe("2025-09-25");
  });

  it("maps 29 February to the 28th in a year without it", () => {
    const [lastYear] = onThisDayTargets(new Date("2028-02-29T12:00:00Z"));
    expect(lastYear).toEqual({ yearsAgo: 1, date: "2027-02-28" });
  });
});

describe("buildOnThisDay across New Year", () => {
  it("finds a nearby day in the previous calendar year", () => {
    const { years } = buildOnThisDay(
      [game("2024-12-30T18:00:00Z")],
      new Date("2026-01-01T12:00:00Z")
    );
    expect(years[0]).toMatchObject({ yearsAgo: 1, date: "2024-12-30", exact: false });
  });
});

describe("OnThisDayService.getOnThisDay", () => {
  function makeService() {
    const lol = { resolveSummoner: vi.fn().mockResolvedValue({ puuid: "P_owner" }) };
    const prisma = {
      match: { findMany: vi.fn().mockResolvedValue([game("2025-09-25T18:00:00Z")]) },
    };
    const service = new OnThisDayService(
      prisma as unknown as PrismaService,
      lol as unknown as LolService
    );
    return { service, lol, prisma };
  }

  it("reads only the account's games around each earlier year's date", async () => {
    const { service, prisma } = makeService();
    const result = await service.getOnThisDay("euw1", "Vyoh", "EUW", NOW);
    expect(result.years).toHaveLength(1);
    const where = prisma.match.findMany.mock.calls[0]?.[0]?.where;
    expect(where.puuid).toBe("P_owner");
    expect(where.OR[0]).toEqual({
      playedAt: {
        gte: new Date("2025-09-21T00:00:00Z"),
        lt: new Date("2025-09-30T00:00:00Z"),
      },
    });
  });

  it("goes through the allowlist before reading anything", async () => {
    const { service, lol, prisma } = makeService();
    lol.resolveSummoner.mockRejectedValueOnce(
      new ForbiddenException("Account not in whitelist")
    );
    await expect(
      service.getOnThisDay("euw1", "Stranger", "EUW", NOW)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.match.findMany).not.toHaveBeenCalled();
  });
});
