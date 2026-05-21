import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { LolService } from "./lol.service";
import { MatchBaselineService, winsorizedMedian } from "./match-baseline.service";

const PUUID = "test-puuid";

function makeDetailRows(matchIds: string[], timeDeadPerMatch: number[]): unknown[] {
  return matchIds.map((matchId, i) => ({
    matchId,
    detail: {
      info: {
        participants: [{ puuid: PUUID, totalTimeSpentDead: timeDeadPerMatch[i] ?? 0 }],
      },
    },
  }));
}

function makeService(matchRows: unknown[], detailRows?: unknown[]): MatchBaselineService {
  const prisma = {
    match: {
      findMany: vi.fn().mockResolvedValue(matchRows),
    },
    matchDetailCache: {
      findMany: vi.fn().mockResolvedValue(detailRows ?? []),
    },
  } as unknown as PrismaService;
  const lol = {
    resolveSummoner: vi.fn().mockResolvedValue({ puuid: PUUID }),
  } as unknown as LolService;
  return new MatchBaselineService(prisma, lol);
}

function makeRow(
  overrides: Partial<{
    matchId: string;
    kills: number;
    deaths: number;
    assists: number;
    damageShare: number;
    csAt10: number;
    visionScore: number;
    teamPosition: string;
  }> = {}
) {
  return {
    matchId: "EUW1_1",
    kills: 5,
    deaths: 2,
    assists: 8,
    damageShare: 0.25,
    csAt10: 70,
    visionScore: 30,
    teamPosition: "MIDDLE",
    ...overrides,
  };
}

describe("winsorizedMedian", () => {
  it("returns 0 for empty input", () => {
    expect(winsorizedMedian([])).toBe(0);
  });

  it("returns the single value unchanged", () => {
    expect(winsorizedMedian([5])).toBe(5);
  });

  it("returns median of odd-length array without clipping when too small", () => {
    // 3 values: no 10% clip rounds to 0 so no clip applied
    expect(winsorizedMedian([1, 3, 5])).toBe(3);
  });

  it("clips 10% from each end before computing median", () => {
    // 10 values, clip=1 from each end → [2,3,4,5,6,7,8,9]
    expect(winsorizedMedian([1, 2, 3, 4, 5, 6, 7, 8, 9, 100])).toBe(5.5);
  });

  it("handles even-length clipped arrays via midpoint average", () => {
    expect(winsorizedMedian([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("MatchBaselineService.getBaseline", () => {
  const ARGS = ["euw1", "TestUser", "EUW", "Syndra", "MIDDLE"] as const;

  it("returns first-game when no matches found", async () => {
    const svc = makeService([]);
    const result = await svc.getBaseline(...ARGS);
    expect(result.state).toBe("first-game");
    expect(result.sampleSize).toBe(0);
    expect(result.kda).toBeUndefined();
  });

  it("returns first-game when fewer than 5 total games on champion", async () => {
    const svc = makeService([makeRow(), makeRow(), makeRow()]);
    const result = await svc.getBaseline(...ARGS);
    expect(result.state).toBe("first-game");
    expect(result.kda).toBeUndefined();
  });

  it("returns champion-only when 5+ total games but fewer than 5 in role", async () => {
    const rows = [
      makeRow({ teamPosition: "MIDDLE" }),
      makeRow({ teamPosition: "MIDDLE" }),
      makeRow({ teamPosition: "MIDDLE" }),
      makeRow({ teamPosition: "TOP" }),
      makeRow({ teamPosition: "TOP" }),
      makeRow({ teamPosition: "TOP" }),
    ];
    const svc = makeService(rows);
    const result = await svc.getBaseline(...ARGS);
    expect(result.state).toBe("champion-only");
    expect(result.sampleSize).toBe(6);
    expect(result.kda).toBeDefined();
    expect(result.damageShare).toBeDefined();
  });

  it("returns full when 5+ games on same champion+role", async () => {
    const rows = Array.from({ length: 7 }, () => makeRow({ teamPosition: "MIDDLE" }));
    const svc = makeService(rows);
    const result = await svc.getBaseline(...ARGS);
    expect(result.state).toBe("full");
    expect(result.sampleSize).toBe(7);
  });

  it("computes KDA correctly from kills/deaths/assists", async () => {
    // All rows: 5k 2d 8a → (5+8)/max(1,2) = 6.5
    const rows = Array.from({ length: 5 }, () =>
      makeRow({ kills: 5, deaths: 2, assists: 8, teamPosition: "MIDDLE" })
    );
    const svc = makeService(rows);
    const result = await svc.getBaseline(...ARGS);
    expect(result.kda).toBeCloseTo(6.5, 5);
  });

  it("avoids division by zero when deaths is 0", async () => {
    const rows = Array.from({ length: 5 }, () =>
      makeRow({ kills: 3, deaths: 0, assists: 2, teamPosition: "MIDDLE" })
    );
    const svc = makeService(rows);
    const result = await svc.getBaseline(...ARGS);
    expect(result.kda).toBeCloseTo(5, 5);
  });

  it("prefers role-specific rows over all-champion rows for full state", async () => {
    // 5 MIDDLE rows with damageShare 0.3, plus 5 TOP rows with damageShare 0.1
    const rows = [
      ...Array.from({ length: 5 }, () =>
        makeRow({ teamPosition: "MIDDLE", damageShare: 0.3 })
      ),
      ...Array.from({ length: 5 }, () =>
        makeRow({ teamPosition: "TOP", damageShare: 0.1 })
      ),
    ];
    const svc = makeService(rows);
    const result = await svc.getBaseline(...ARGS);
    expect(result.state).toBe("full");
    // Median of 5× 0.3 = 0.3
    expect(result.damageShare).toBeCloseTo(0.3, 5);
  });

  it("includes timeDead from detail cache when available", async () => {
    const matchIds = Array.from({ length: 5 }, (_, i) => `EUW1_${i + 1}`);
    const rows = matchIds.map((matchId) => makeRow({ matchId, teamPosition: "MIDDLE" }));
    const detailRows = makeDetailRows(matchIds, [60, 90, 120, 90, 60]);
    const svc = makeService(rows, detailRows);
    const result = await svc.getBaseline(...ARGS);
    // Median of [60, 60, 90, 90, 120] = 90
    expect(result.timeDead).toBeCloseTo(90, 5);
  });

  it("omits timeDead when detail cache has no matching rows", async () => {
    const rows = Array.from({ length: 5 }, () => makeRow({ teamPosition: "MIDDLE" }));
    const svc = makeService(rows, []);
    const result = await svc.getBaseline(...ARGS);
    expect(result.timeDead).toBeUndefined();
  });
});
