import { describe, expect, it, vi } from "vitest";

import type { IdentityService } from "../identity/identity.service";
import type { PrismaService } from "../prisma/prisma.service";
import { LolMomentsService } from "./lol-moments.service";

const NOW = new Date("2026-06-02T12:00:00Z");

interface ChampionCountRow {
  champion: string;
  _count: { _all: number };
}

interface MatchRow {
  matchId: string;
  champion: string;
  playedAt: Date;
}

interface SnapshotMatchRow extends MatchRow {
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  durationSec: number;
  queueType: string;
  snapshotTier: string | null;
  snapshotRank: string | null;
  snapshotLp: number | null;
  snapshotTierBefore: string | null;
  snapshotRankBefore: string | null;
  snapshotLpBefore: number | null;
}

interface KdaMatchRow extends MatchRow {
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  durationSec: number;
  queueType: string;
}

function makeService(opts: {
  ownerPuuids?: string[];
  championCounts?: ChampionCountRow[];
  offMetaMatch?: MatchRow | null;
  rankUpRows?: SnapshotMatchRow[];
  kdaRows?: KdaMatchRow[];
}) {
  const identity = {
    getOwnerPuuids: vi.fn().mockResolvedValue(opts.ownerPuuids ?? ["P_owner"]),
  } as unknown as IdentityService;
  // `findMany` is called by BOTH detectRankUps and detectKdaOutliers. They
  // differ by `where.snapshotTier` (only rank-up filters on it), so the
  // mock discriminates by argument shape instead of forcing tests to choose
  // one detector at a time.
  const findManyImpl = vi
    .fn()
    .mockImplementation((args: { where: { snapshotTier?: { not: null } | null } }) => {
      const isRankUpCall = args.where?.snapshotTier !== undefined;
      return Promise.resolve(
        isRankUpCall ? (opts.rankUpRows ?? []) : (opts.kdaRows ?? [])
      );
    });
  const prisma = {
    match: {
      groupBy: vi.fn().mockResolvedValue(opts.championCounts ?? []),
      findFirst: vi.fn().mockResolvedValue(opts.offMetaMatch ?? null),
      findMany: findManyImpl,
    },
  } as unknown as PrismaService;
  return {
    service: new LolMomentsService(prisma, identity),
    prisma,
    identity,
  };
}

describe("LolMomentsService.detectOffMetaPicks", () => {
  it("returns no candidates when there are no owner puuids", async () => {
    const { service, prisma } = makeService({ ownerPuuids: [] });
    const result = await service.detectOffMetaPicks(NOW);
    expect(result).toEqual([]);
    // Short-circuit before any DB call.
    expect(prisma.match.groupBy).not.toHaveBeenCalled();
  });

  it("returns no candidates when the owner has no main-pool history", async () => {
    // Main pool empty → every champion would be "off-meta" by exclusion,
    // which is the wrong framing. The detector bails instead of producing
    // a misleading chapter.
    const { service, prisma } = makeService({
      championCounts: [],
      offMetaMatch: {
        matchId: "EUW_99",
        champion: "Renekton",
        playedAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
    });
    const result = await service.detectOffMetaPicks(NOW);
    expect(result).toEqual([]);
    expect(prisma.match.findFirst).not.toHaveBeenCalled();
  });

  it("returns no candidates when every recent match is inside the main pool", async () => {
    const { service } = makeService({
      championCounts: [
        { champion: "Ahri", _count: { _all: 40 } },
        { champion: "Lux", _count: { _all: 10 } },
      ],
      offMetaMatch: null,
    });
    const result = await service.detectOffMetaPicks(NOW);
    expect(result).toEqual([]);
  });

  it("emits a candidate for the freshest off-meta pick when the main pool is established", async () => {
    const playedAt = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000);
    const { service, prisma } = makeService({
      championCounts: [
        { champion: "Ahri", _count: { _all: 60 } },
        { champion: "Lux", _count: { _all: 8 } },
        { champion: "Syndra", _count: { _all: 4 } },
        { champion: "Orianna", _count: { _all: 3 } },
        { champion: "Akali", _count: { _all: 3 } },
      ],
      offMetaMatch: { matchId: "EUW_42", champion: "Renekton", playedAt },
    });
    const result = await service.detectOffMetaPicks(NOW);
    expect(result).toHaveLength(1);
    const candidate = result[0];
    if (!candidate || candidate.kind !== "lol-moment") {
      throw new Error("expected a lol-moment candidate");
    }
    expect(candidate.momentType).toBe("OFF_META_PICK");
    expect(candidate.matchId).toBe("EUW_42");
    expect(candidate.championAlias).toBe("Renekton");
    expect(candidate.daysSince).toBe(3);
    expect(candidate.offMeta).toBe(true);
    expect(candidate.slug).toBe("lol-moment-off-meta-EUW_42");

    // `findFirst` is constrained to champions outside the main pool — pass
    // the resolved set through so a regression that drops the filter (e.g.
    // someone refactors `notIn`) is caught here.
    const findArgs = vi.mocked(prisma.match.findFirst).mock.calls[0]?.[0] as {
      where: { champion: { notIn: string[] } };
    };
    expect(new Set(findArgs.where.champion.notIn)).toEqual(
      new Set(["Ahri", "Lux", "Syndra", "Orianna", "Akali"])
    );
  });

  it("caps the main pool at the top-5 most-played champions, ignoring deeper rotation", async () => {
    // Champion #6 should NOT be in the pool — so a recent #6 game qualifies
    // as off-meta. Verifies the slice math, not just the sort order.
    const { service, prisma } = makeService({
      championCounts: [
        { champion: "Ahri", _count: { _all: 80 } },
        { champion: "Lux", _count: { _all: 12 } },
        { champion: "Syndra", _count: { _all: 8 } },
        { champion: "Orianna", _count: { _all: 6 } },
        { champion: "Akali", _count: { _all: 4 } },
        { champion: "Annie", _count: { _all: 3 } },
      ],
      offMetaMatch: { matchId: "EUW_7", champion: "Annie", playedAt: NOW },
    });
    await service.detectOffMetaPicks(NOW);
    const findArgs = vi.mocked(prisma.match.findFirst).mock.calls[0]?.[0] as {
      where: { champion: { notIn: string[] } };
    };
    expect(findArgs.where.champion.notIn).not.toContain("Annie");
  });

  it("constrains both the main-pool groupBy and the off-meta findFirst to ranked queues only", async () => {
    // ARAM rolls champions; Normal Draft is practice. A "stepping off Ahri"
    // moment must be a deliberate pick under stakes — ranked queues only.
    const { service, prisma } = makeService({
      championCounts: [{ champion: "Ahri", _count: { _all: 50 } }],
      offMetaMatch: {
        matchId: "EUW_1",
        champion: "Renekton",
        playedAt: NOW,
      },
    });
    await service.detectOffMetaPicks(NOW);

    const groupByArgs = vi.mocked(prisma.match.groupBy).mock.calls[0]?.[0] as {
      where: { queueType: { in: string[] } };
    };
    expect(new Set(groupByArgs.where.queueType.in)).toEqual(
      new Set(["Ranked Solo", "Ranked Flex"])
    );

    const findArgs = vi.mocked(prisma.match.findFirst).mock.calls[0]?.[0] as {
      where: { queueType: { in: string[] } };
    };
    expect(new Set(findArgs.where.queueType.in)).toEqual(
      new Set(["Ranked Solo", "Ranked Flex"])
    );
  });

  it("clamps daysSince to 0 when the match's playedAt is in the future (clock skew)", async () => {
    const { service } = makeService({
      championCounts: [{ champion: "Ahri", _count: { _all: 50 } }],
      offMetaMatch: {
        matchId: "EUW_skew",
        champion: "Renekton",
        playedAt: new Date(NOW.getTime() + 60 * 1000),
      },
    });
    const result = await service.detectOffMetaPicks(NOW);
    expect(result[0]?.daysSince).toBe(0);
  });
});

function makeSnapshotRow(opts: {
  matchId?: string;
  champion?: string;
  playedAt?: Date;
  toTier: string;
  toRank: string;
  toLp: number;
  fromTier: string;
  fromRank: string;
  fromLp: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  win?: boolean;
  durationSec?: number;
  queueType?: string;
}): SnapshotMatchRow {
  return {
    matchId: opts.matchId ?? "EUW_RU_1",
    champion: opts.champion ?? "Ahri",
    playedAt: opts.playedAt ?? new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
    kills: opts.kills ?? 6,
    deaths: opts.deaths ?? 3,
    assists: opts.assists ?? 9,
    win: opts.win ?? true,
    durationSec: opts.durationSec ?? 1820,
    queueType: opts.queueType ?? "Ranked Solo",
    snapshotTier: opts.toTier,
    snapshotRank: opts.toRank,
    snapshotLp: opts.toLp,
    snapshotTierBefore: opts.fromTier,
    snapshotRankBefore: opts.fromRank,
    snapshotLpBefore: opts.fromLp,
  };
}

describe("LolMomentsService.detectRankUps", () => {
  it("returns no candidates when there are no owner puuids", async () => {
    const { service, prisma } = makeService({ ownerPuuids: [] });
    const result = await service.detectRankUps(NOW);
    expect(result).toEqual([]);
    expect(prisma.match.findMany).not.toHaveBeenCalled();
  });

  it("returns no candidates when no ranked matches have populated snapshots", async () => {
    const { service } = makeService({ rankUpRows: [] });
    const result = await service.detectRankUps(NOW);
    expect(result).toEqual([]);
  });

  it("skips matches where only LP changed (same tier and division)", async () => {
    const { service } = makeService({
      rankUpRows: [
        makeSnapshotRow({
          toTier: "SILVER",
          toRank: "II",
          toLp: 80,
          fromTier: "SILVER",
          fromRank: "II",
          fromLp: 60,
        }),
      ],
    });
    const result = await service.detectRankUps(NOW);
    expect(result).toEqual([]);
  });

  it("skips matches where the rank dropped (demotion)", async () => {
    const { service } = makeService({
      rankUpRows: [
        makeSnapshotRow({
          toTier: "SILVER",
          toRank: "III",
          toLp: 75,
          fromTier: "SILVER",
          fromRank: "II",
          fromLp: 20,
        }),
      ],
    });
    const result = await service.detectRankUps(NOW);
    expect(result).toEqual([]);
  });

  it("emits a division-up candidate with the lower base signal", async () => {
    const playedAt = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
    const { service } = makeService({
      rankUpRows: [
        makeSnapshotRow({
          matchId: "EUW_DIV",
          champion: "Ahri",
          playedAt,
          toTier: "GOLD",
          toRank: "III",
          toLp: 10,
          fromTier: "GOLD",
          fromRank: "IV",
          fromLp: 92,
        }),
      ],
    });
    const result = await service.detectRankUps(NOW);
    expect(result).toHaveLength(1);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") {
      throw new Error("expected a lol-moment candidate");
    }
    expect(c.momentType).toBe("RANK_UP");
    expect(c.matchId).toBe("EUW_DIV");
    expect(c.championAlias).toBe("Ahri");
    expect(c.slug).toBe("lol-moment-rank-up-EUW_DIV");
    expect(c.daysSince).toBe(2);
    expect(c.rankUp).toEqual({
      fromTier: "GOLD",
      fromRank: "IV",
      fromLp: 92,
      toTier: "GOLD",
      toRank: "III",
      toLp: 10,
    });
    expect(c.baseSignal).toBe(22);
    // RANK_UP carries matchStats too — the climbing game's KDA/W/L is part of
    // the chapter receipt strip, mirroring OFF_META_PICK's shape.
    expect(c.matchStats).toEqual({
      kills: 6,
      deaths: 3,
      assists: 9,
      win: true,
      durationSec: 1820,
      queueType: "Ranked Solo",
    });
  });

  it("emits a tier-up candidate with the higher base signal", async () => {
    const { service } = makeService({
      rankUpRows: [
        makeSnapshotRow({
          matchId: "EUW_TIER",
          toTier: "GOLD",
          toRank: "IV",
          toLp: 15,
          fromTier: "SILVER",
          fromRank: "I",
          fromLp: 96,
        }),
      ],
    });
    const result = await service.detectRankUps(NOW);
    expect(result).toHaveLength(1);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") {
      throw new Error("expected a lol-moment candidate");
    }
    expect(c.baseSignal).toBe(35);
    expect(c.rankUp?.toTier).toBe("GOLD");
    expect(c.rankUp?.fromTier).toBe("SILVER");
  });

  it("picks the freshest qualifying climb when newer matches are LP-only", async () => {
    const newer = makeSnapshotRow({
      matchId: "EUW_LPONLY",
      playedAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
      toTier: "PLATINUM",
      toRank: "II",
      toLp: 60,
      fromTier: "PLATINUM",
      fromRank: "II",
      fromLp: 40,
    });
    const older = makeSnapshotRow({
      matchId: "EUW_DIVPROMO",
      playedAt: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000),
      toTier: "PLATINUM",
      toRank: "II",
      toLp: 12,
      fromTier: "PLATINUM",
      fromRank: "III",
      fromLp: 95,
    });
    const { service } = makeService({ rankUpRows: [newer, older] });
    const result = await service.detectRankUps(NOW);
    expect(result).toHaveLength(1);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.matchId).toBe("EUW_DIVPROMO");
  });

  it("constrains the findMany scan to ranked queues with both snapshots populated", async () => {
    const { service, prisma } = makeService({
      rankUpRows: [],
    });
    await service.detectRankUps(NOW);
    const args = vi.mocked(prisma.match.findMany).mock.calls[0]?.[0] as {
      where: {
        queueType: { in: string[] };
        snapshotTier: { not: null };
        snapshotTierBefore: { not: null };
      };
      orderBy: { playedAt: "asc" | "desc" };
    };
    expect(new Set(args.where.queueType.in)).toEqual(
      new Set(["Ranked Solo", "Ranked Flex"])
    );
    expect(args.where.snapshotTier).toEqual({ not: null });
    expect(args.where.snapshotTierBefore).toEqual({ not: null });
    expect(args.orderBy.playedAt).toBe("desc");
  });
});

function makeKdaRow(opts: {
  matchId?: string;
  champion?: string;
  playedAt?: Date;
  kills: number;
  deaths: number;
  assists: number;
  win?: boolean;
  durationSec?: number;
  queueType?: string;
}): KdaMatchRow {
  return {
    matchId: opts.matchId ?? "EUW_KDA_1",
    champion: opts.champion ?? "Ahri",
    playedAt: opts.playedAt ?? new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
    kills: opts.kills,
    deaths: opts.deaths,
    assists: opts.assists,
    win: opts.win ?? true,
    durationSec: opts.durationSec ?? 1820,
    queueType: opts.queueType ?? "Ranked Solo",
  };
}

// 8 baseline games averaging ~2.0 KDA (the BASELINE_MIN_MATCHES floor) —
// each test prepends its standout game so the standout's KDA dominates the
// "best KDA" pick and the baseline stays around 2.0 with the new game folded
// in. Keeps each test self-contained without re-deriving the average.
const KDA_BASELINE_GAMES: KdaMatchRow[] = Array.from({ length: 8 }, (_, i) =>
  makeKdaRow({
    matchId: `EUW_BASE_${i}`,
    playedAt: new Date(NOW.getTime() - (5 + i) * 24 * 60 * 60 * 1000),
    kills: 4,
    deaths: 4,
    assists: 4,
  })
);

describe("LolMomentsService.detectKdaOutliers", () => {
  it("returns no candidates when there are no owner puuids", async () => {
    const { service, prisma } = makeService({ ownerPuuids: [] });
    const result = await service.detectKdaOutliers(NOW);
    expect(result).toEqual([]);
    expect(prisma.match.findMany).not.toHaveBeenCalled();
  });

  it("returns no candidates below the baseline-minimum sample size", async () => {
    // Even a 30/0/30 game can't surface if the owner only has 5 ranked games
    // in the window — there's no baseline to multiply against, and the
    // "standout vs your average" framing breaks down.
    const { service } = makeService({
      kdaRows: [
        makeKdaRow({ kills: 30, deaths: 0, assists: 30 }),
        ...KDA_BASELINE_GAMES.slice(0, 4),
      ],
    });
    const result = await service.detectKdaOutliers(NOW);
    expect(result).toEqual([]);
  });

  it("surfaces the highest-KDA match when it clears both the ratio and absolute floor", async () => {
    const standout = makeKdaRow({
      matchId: "EUW_STAND",
      champion: "Ahri",
      playedAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
      kills: 12,
      deaths: 2,
      assists: 14,
    });
    const { service } = makeService({
      kdaRows: [standout, ...KDA_BASELINE_GAMES],
    });
    const result = await service.detectKdaOutliers(NOW);
    expect(result).toHaveLength(1);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") {
      throw new Error("expected a lol-moment candidate");
    }
    expect(c.momentType).toBe("KDA_OUTLIER");
    expect(c.matchId).toBe("EUW_STAND");
    expect(c.championAlias).toBe("Ahri");
    expect(c.slug).toBe("lol-moment-kda-outlier-EUW_STAND");
    expect(c.daysSince).toBe(1);
    expect(c.kdaOutlier?.matchKda).toBeCloseTo(13.0, 1);
    expect(c.kdaOutlier?.baselineKda).toBeGreaterThan(2.0);
    expect(c.matchStats).toEqual({
      kills: 12,
      deaths: 2,
      assists: 14,
      win: true,
      durationSec: 1820,
      queueType: "Ranked Solo",
    });
  });

  it("drops candidates that beat the ratio but fall below the absolute floor", async () => {
    // Baseline of cold-streak games (1.5 KDA average); 3.0 KDA game is 2×
    // the baseline but well under the 6.0 absolute floor — not a "standout".
    const coldStreak = Array.from({ length: 8 }, (_, i) =>
      makeKdaRow({
        matchId: `EUW_COLD_${i}`,
        playedAt: new Date(NOW.getTime() - (5 + i) * 24 * 60 * 60 * 1000),
        kills: 2,
        deaths: 4,
        assists: 4,
      })
    );
    const { service } = makeService({
      kdaRows: [
        makeKdaRow({ kills: 3, deaths: 2, assists: 3 }), // 3.0 KDA — clears ratio, fails absolute floor
        ...coldStreak,
      ],
    });
    const result = await service.detectKdaOutliers(NOW);
    expect(result).toEqual([]);
  });

  it("drops candidates that clear the absolute floor but fall below the baseline ratio", async () => {
    // Hot-streak baseline (5.0 KDA avg); a 6.5 KDA game clears the absolute
    // floor but only 1.3× the baseline — not a standout vs. the owner's
    // typical performance.
    const hotStreak = Array.from({ length: 8 }, (_, i) =>
      makeKdaRow({
        matchId: `EUW_HOT_${i}`,
        playedAt: new Date(NOW.getTime() - (5 + i) * 24 * 60 * 60 * 1000),
        kills: 8,
        deaths: 2,
        assists: 2,
      })
    );
    const { service } = makeService({
      kdaRows: [
        makeKdaRow({ kills: 6, deaths: 2, assists: 7 }), // 6.5 KDA — 1.3× the 5.0 baseline
        ...hotStreak,
      ],
    });
    const result = await service.detectKdaOutliers(NOW);
    expect(result).toEqual([]);
  });

  it("picks the highest-KDA match across the window, not the most recent qualifying one", async () => {
    const newerSmaller = makeKdaRow({
      matchId: "EUW_NEWER",
      playedAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
      kills: 8,
      deaths: 2,
      assists: 7,
    });
    const olderBigger = makeKdaRow({
      matchId: "EUW_BIGGER",
      playedAt: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000),
      kills: 15,
      deaths: 1,
      assists: 10,
    });
    const { service } = makeService({
      kdaRows: [newerSmaller, olderBigger, ...KDA_BASELINE_GAMES],
    });
    const result = await service.detectKdaOutliers(NOW);
    expect(result).toHaveLength(1);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.matchId).toBe("EUW_BIGGER");
  });

  it("constrains the findMany scan to ranked queues only", async () => {
    const { service, prisma } = makeService({ kdaRows: [] });
    await service.detectKdaOutliers(NOW);
    const calls = vi.mocked(prisma.match.findMany).mock.calls;
    // findMany is shared with detectRankUps — pick the call that's the KDA
    // detector (no snapshotTier filter).
    const kdaCall = calls.find(
      (c) =>
        (c[0] as { where: { snapshotTier?: unknown } }).where?.snapshotTier === undefined
    );
    expect(kdaCall).toBeTruthy();
    const args = kdaCall?.[0] as { where: { queueType: { in: string[] } } };
    expect(new Set(args.where.queueType.in)).toEqual(
      new Set(["Ranked Solo", "Ranked Flex"])
    );
  });
});

describe("LolMomentsService.detectAll", () => {
  it("collects every detector's output into one candidate list", async () => {
    const { service } = makeService({
      championCounts: [{ champion: "Ahri", _count: { _all: 50 } }],
      offMetaMatch: {
        matchId: "EUW_42",
        champion: "Renekton",
        playedAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      rankUpRows: [
        makeSnapshotRow({
          matchId: "EUW_RU",
          playedAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
          toTier: "GOLD",
          toRank: "IV",
          toLp: 15,
          fromTier: "SILVER",
          fromRank: "I",
          fromLp: 96,
        }),
      ],
      kdaRows: [
        makeKdaRow({
          matchId: "EUW_STAND",
          playedAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
          kills: 12,
          deaths: 2,
          assists: 14,
        }),
        ...KDA_BASELINE_GAMES,
      ],
    });
    const result = await service.detectAll(NOW);
    expect(result).toHaveLength(3);
    const momentTypes = result
      .filter((r) => r.kind === "lol-moment")
      .map((r) => (r.kind === "lol-moment" ? r.momentType : null));
    expect(new Set(momentTypes)).toEqual(
      new Set(["OFF_META_PICK", "RANK_UP", "KDA_OUTLIER"])
    );
  });
});
