import { describe, expect, it, vi } from "vitest";

import type { IdentityService } from "../identity/identity.service";
import type { PrismaService } from "../prisma/prisma.service";
import { LolMomentsService } from "./lol-moments.service";

const NOW = new Date("2026-06-02T12:00:00Z");

interface ChampionCountRow {
  champion: string;
  _count: { _all: number };
}

interface ChampionWinCountRow {
  champion: string;
  win: boolean;
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
  queueId: number;
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
  queueId: number;
}

function makeService(opts: {
  ownerPuuids?: string[];
  championCounts?: ChampionCountRow[];
  offMetaMatch?: MatchRow | null;
  rankUpRows?: SnapshotMatchRow[];
  kdaRows?: KdaMatchRow[];
  hiatusRows?: KdaMatchRow[];
  streakRows?: KdaMatchRow[];
  marathonRows?: KdaMatchRow[];
  favoriteWinCounts?: ChampionWinCountRow[];
  favoriteMostRecentMatch?: { playedAt: Date } | null;
  favoriteCandidateMatches?: KdaMatchRow[];
  /** Fixture for `detectLifetimePeak` (R-7i Lane B). The peak detector
   *  reads from the separate `RankSnapshot` table (vs Match.snapshot*
   *  which isn't backfilled). One row per (tier, rank, lp, capturedAt). */
  rankSnapshotRows?: Array<{
    tier: string;
    rank: string;
    leaguePoints: number;
    capturedAt: Date;
  }>;
  /** Anchor match the lifetime-peak detector uses for championAlias +
   *  matchId via `match.findFirst` ordered by playedAt desc. Also
   *  consumed by the favorite-champion detector's same-shape call. */
  lifetimePeakAnchorMatch?: { matchId: string; champion: string } | null;
}) {
  const identity = {
    getOwnerPuuids: vi.fn().mockResolvedValue(opts.ownerPuuids ?? ["P_owner"]),
  } as unknown as IdentityService;
  // `findMany` is called by FIVE detectors. They differ by call shape:
  //   - rank-up filters on `snapshotTier` (six snapshot columns non-null).
  //   - streak passes `take` (capped scan, no windowed where-filter).
  //   - marathon has `playedAt.gte` AND `orderBy.playedAt = "asc"` (sliding
  //     window walks chronologically).
  //   - KDA has `playedAt.gte` AND `orderBy.playedAt = "desc"` (highest
  //     KDA pick scans newest-first).
  //   - hiatus has none of the above filters (reads ALL owner ranked
  //     matches for prev-match gap detection, ordered asc).
  // The mock routes each call to its fixture by inspecting the call shape.
  const findManyImpl = vi.fn().mockImplementation(
    (args: {
      where: {
        snapshotTier?: { not: null } | null;
        playedAt?: { gte: Date };
      };
      orderBy?: { playedAt?: "asc" | "desc" };
      take?: number;
    }) => {
      const hasSnapshotFilter = args.where?.snapshotTier !== undefined;
      const hasTake = args.take !== undefined;
      const hasWindowFilter = args.where?.playedAt !== undefined;
      const isAsc = args.orderBy?.playedAt === "asc";
      if (hasSnapshotFilter) {
        // Rank-up is the only Match.findMany call that filters on
        // snapshotTier. Lifetime peak now reads from `RankSnapshot`,
        // not from Match snapshots, so the dispatcher no longer
        // needs a second branch here.
        return Promise.resolve(opts.rankUpRows ?? []);
      }
      if (hasTake) return Promise.resolve(opts.streakRows ?? []);
      if (hasWindowFilter && isAsc) return Promise.resolve(opts.marathonRows ?? []);
      if (hasWindowFilter) return Promise.resolve(opts.kdaRows ?? []);
      return Promise.resolve(opts.hiatusRows ?? []);
    }
  );
  const prisma = {
    // RankSnapshot is read by `detectLifetimePeak` only (R-7i Lane B).
    // Returns the canonical rank-tracking rows; the dispatcher applies
    // no shape branching because there's only one consumer.
    rankSnapshot: {
      findMany: vi.fn().mockResolvedValue(opts.rankSnapshotRows ?? []),
    },
    match: {
      // groupBy routes by the `by` shape: off-meta groups by ["champion"]
      // only (count games per champion). Favorite groups by ["champion",
      // "win"] (gives wins/losses split per champion in one read).
      groupBy: vi.fn().mockImplementation((args: { by: string[] }) => {
        if (args.by?.includes("win")) {
          return Promise.resolve(opts.favoriteWinCounts ?? []);
        }
        return Promise.resolve(opts.championCounts ?? []);
      }),
      // findFirst routes by `where.champion` AND select shape:
      //   - off-meta — `where.champion: { notIn: [...] }` set.
      //   - favorite "most recent ranked match" — no champion filter,
      //     `select: { playedAt: true }`.
      //   - lifetime peak "anchor match" — no champion filter,
      //     `select: { matchId: true, champion: true }`.
      findFirst: vi.fn().mockImplementation(
        (args: {
          where: { champion?: unknown };
          select?: { matchId?: boolean; playedAt?: boolean; champion?: boolean };
        }) => {
          if (args.where?.champion !== undefined) {
            return Promise.resolve(opts.offMetaMatch ?? null);
          }
          // Lifetime peak's anchor match selects matchId + champion.
          if (args.select?.matchId === true && args.select?.champion === true) {
            return Promise.resolve(opts.lifetimePeakAnchorMatch ?? null);
          }
          return Promise.resolve(opts.favoriteMostRecentMatch ?? null);
        }
      ),
      // Favorite's findMany passes a single champion string under
      // `where.champion` (vs off-meta's `notIn` array on findFirst).
      // Route it before falling into the existing four-branch matrix
      // that splits rank-up / streak / marathon / KDA / hiatus. Wrapped
      // in `vi.fn()` so existing tests that inspect `mock.calls` still
      // work after the dispatcher addition.
      findMany: vi.fn().mockImplementation(
        (args: {
          where: {
            snapshotTier?: { not: null } | null;
            playedAt?: { gte: Date };
            champion?: unknown;
          };
          orderBy?: { playedAt?: "asc" | "desc" };
          take?: number;
        }) => {
          if (typeof args.where?.champion === "string") {
            return Promise.resolve(opts.favoriteCandidateMatches ?? []);
          }
          return findManyImpl(args);
        }
      ),
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
      where: { queueId: { in: number[] } };
    };
    expect(new Set(groupByArgs.where.queueId.in)).toEqual(new Set([420, 440]));

    const findArgs = vi.mocked(prisma.match.findFirst).mock.calls[0]?.[0] as {
      where: { queueId: { in: number[] } };
    };
    expect(new Set(findArgs.where.queueId.in)).toEqual(new Set([420, 440]));
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
  queueId?: number;
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
    queueId: opts.queueId ?? 420,
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
      queueId: 420,
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
        queueId: { in: number[] };
        snapshotTier: { not: null };
        snapshotTierBefore: { not: null };
      };
      orderBy: { playedAt: "asc" | "desc" };
    };
    expect(new Set(args.where.queueId.in)).toEqual(new Set([420, 440]));
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
  queueId?: number;
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
    queueId: opts.queueId ?? 420,
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
      queueId: 420,
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
    const args = kdaCall?.[0] as { where: { queueId: { in: number[] } } };
    expect(new Set(args.where.queueId.in)).toEqual(new Set([420, 440]));
  });
});

function makeHiatusRow(opts: {
  matchId?: string;
  champion?: string;
  playedAt: Date;
  kills?: number;
  deaths?: number;
  assists?: number;
  win?: boolean;
  durationSec?: number;
  queueId?: number;
}): KdaMatchRow {
  return {
    matchId: opts.matchId ?? `EUW_H_${opts.playedAt.getTime()}`,
    champion: opts.champion ?? "Ahri",
    playedAt: opts.playedAt,
    kills: opts.kills ?? 5,
    deaths: opts.deaths ?? 3,
    assists: opts.assists ?? 7,
    win: opts.win ?? true,
    durationSec: opts.durationSec ?? 1820,
    queueId: opts.queueId ?? 420,
  };
}

describe("LolMomentsService.detectReturnsFromHiatus", () => {
  it("returns no candidates when there are no owner puuids", async () => {
    const { service, prisma } = makeService({ ownerPuuids: [] });
    const result = await service.detectReturnsFromHiatus(NOW);
    expect(result).toEqual([]);
    expect(prisma.match.findMany).not.toHaveBeenCalled();
  });

  it("returns no candidates when the owner has played daily (no gap ≥ threshold)", async () => {
    // 6 games, each one day after the previous — biggest gap is 1d.
    const dailyRows = Array.from({ length: 6 }, (_, i) =>
      makeHiatusRow({
        matchId: `EUW_DAILY_${i}`,
        playedAt: new Date(NOW.getTime() - (6 - i) * 24 * 60 * 60 * 1000),
      })
    );
    const { service } = makeService({ hiatusRows: dailyRows });
    const result = await service.detectReturnsFromHiatus(NOW);
    expect(result).toEqual([]);
  });

  it("returns no candidates when the gap exists but the return match is outside the recency window", async () => {
    // Gap of 30d before a return that happened 45d ago — return match too old.
    const { service } = makeService({
      hiatusRows: [
        makeHiatusRow({
          matchId: "EUW_OLD",
          playedAt: new Date(NOW.getTime() - 75 * 24 * 60 * 60 * 1000),
        }),
        makeHiatusRow({
          matchId: "EUW_RETURN_OLD",
          playedAt: new Date(NOW.getTime() - 45 * 24 * 60 * 60 * 1000),
        }),
      ],
    });
    const result = await service.detectReturnsFromHiatus(NOW);
    expect(result).toEqual([]);
  });

  it("surfaces a return match with a gap above the threshold and within the recency window", async () => {
    const prev = makeHiatusRow({
      matchId: "EUW_PREV",
      playedAt: new Date(NOW.getTime() - 35 * 24 * 60 * 60 * 1000),
    });
    const ret = makeHiatusRow({
      matchId: "EUW_BACK",
      champion: "Ahri",
      playedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000),
      kills: 8,
      deaths: 3,
      assists: 12,
    });
    const { service } = makeService({ hiatusRows: [prev, ret] });
    const result = await service.detectReturnsFromHiatus(NOW);
    expect(result).toHaveLength(1);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") {
      throw new Error("expected a lol-moment candidate");
    }
    expect(c.momentType).toBe("RETURN_FROM_HIATUS");
    expect(c.matchId).toBe("EUW_BACK");
    expect(c.championAlias).toBe("Ahri");
    expect(c.slug).toBe("lol-moment-hiatus-return-EUW_BACK");
    expect(c.daysSince).toBe(5);
    // Gap: 35d - 5d = 30d. baseSignal = 30 × 0.4 = 12.
    expect(c.hiatusReturn?.gapDays).toBe(30);
    expect(c.baseSignal).toBeCloseTo(12);
    expect(c.matchStats).toEqual({
      kills: 8,
      deaths: 3,
      assists: 12,
      win: true,
      durationSec: 1820,
      queueId: 420,
    });
  });

  it("caps baseSignal magnitude at the gap-cap (≥90d break reads as max-strength)", async () => {
    const ancient = makeHiatusRow({
      matchId: "EUW_ANCIENT",
      playedAt: new Date(NOW.getTime() - 250 * 24 * 60 * 60 * 1000),
    });
    const ret = makeHiatusRow({
      matchId: "EUW_HUGE_RETURN",
      playedAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
    });
    const { service } = makeService({ hiatusRows: [ancient, ret] });
    const result = await service.detectReturnsFromHiatus(NOW);
    expect(result).toHaveLength(1);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    // Actual gap is ~248d but cap is 90d → baseSignal = 90 × 0.4 = 36.
    expect(c.hiatusReturn?.gapDays).toBeGreaterThan(90);
    expect(c.baseSignal).toBeCloseTo(36);
  });

  it("picks the freshest qualifying return when multiple hiatuses occurred in the window", async () => {
    // Hiatus A: 30d gap, return 25d ago. Hiatus B: 14d gap, return 1d ago.
    // Both qualify; B is the freshest framing.
    const veryOld = makeHiatusRow({
      matchId: "EUW_VERY_OLD",
      playedAt: new Date(NOW.getTime() - 55 * 24 * 60 * 60 * 1000),
    });
    const firstReturn = makeHiatusRow({
      matchId: "EUW_R1",
      playedAt: new Date(NOW.getTime() - 25 * 24 * 60 * 60 * 1000),
    });
    const middle = makeHiatusRow({
      matchId: "EUW_MID",
      playedAt: new Date(NOW.getTime() - 15 * 24 * 60 * 60 * 1000),
    });
    const secondReturn = makeHiatusRow({
      matchId: "EUW_R2",
      playedAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
    });
    const { service } = makeService({
      hiatusRows: [veryOld, firstReturn, middle, secondReturn],
    });
    const result = await service.detectReturnsFromHiatus(NOW);
    expect(result).toHaveLength(1);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.matchId).toBe("EUW_R2");
    expect(c.hiatusReturn?.gapDays).toBe(14);
  });

  it("returns no candidates when the only match has no prior reference (first-ever ranked game)", async () => {
    const { service } = makeService({
      hiatusRows: [
        makeHiatusRow({
          matchId: "EUW_FIRST",
          playedAt: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000),
        }),
      ],
    });
    const result = await service.detectReturnsFromHiatus(NOW);
    expect(result).toEqual([]);
  });

  it("constrains the findMany scan to ranked queues only", async () => {
    const { service, prisma } = makeService({ hiatusRows: [] });
    await service.detectReturnsFromHiatus(NOW);
    const calls = vi.mocked(prisma.match.findMany).mock.calls;
    // hiatus is the only call lacking BOTH snapshotTier AND playedAt filters.
    const hiatusCall = calls.find((c) => {
      const w = (c[0] as { where: { snapshotTier?: unknown; playedAt?: unknown } }).where;
      return w?.snapshotTier === undefined && w?.playedAt === undefined;
    });
    expect(hiatusCall).toBeTruthy();
    const args = hiatusCall?.[0] as { where: { queueId: { in: number[] } } };
    expect(new Set(args.where.queueId.in)).toEqual(new Set([420, 440]));
  });
});

function makeStreakRow(opts: {
  matchId?: string;
  champion?: string;
  playedAt: Date;
  win: boolean;
  kills?: number;
  deaths?: number;
  assists?: number;
  durationSec?: number;
  queueId?: number;
}): KdaMatchRow {
  return {
    matchId: opts.matchId ?? `EUW_S_${opts.playedAt.getTime()}`,
    champion: opts.champion ?? "Ahri",
    playedAt: opts.playedAt,
    kills: opts.kills ?? 5,
    deaths: opts.deaths ?? 3,
    assists: opts.assists ?? 7,
    win: opts.win,
    durationSec: opts.durationSec ?? 1820,
    queueId: opts.queueId ?? 420,
  };
}

describe("LolMomentsService.detectStreaks", () => {
  it("returns no candidates when there are no owner puuids", async () => {
    const { service, prisma } = makeService({ ownerPuuids: [] });
    const result = await service.detectStreaks(NOW);
    expect(result).toEqual([]);
    expect(prisma.match.findMany).not.toHaveBeenCalled();
  });

  it("returns no candidates when fewer than the minimum-length matches exist", async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeStreakRow({
        matchId: `EUW_FEW_${i}`,
        playedAt: new Date(NOW.getTime() - i * 24 * 60 * 60 * 1000),
        win: true,
      })
    );
    const { service } = makeService({ streakRows: rows });
    const result = await service.detectStreaks(NOW);
    expect(result).toEqual([]);
  });

  it("returns no candidates when the head run is shorter than the minimum", async () => {
    // 3 wins at head, then a loss → head run is 3, below 5.
    const rows = [
      makeStreakRow({
        matchId: "EUW_W3",
        playedAt: new Date(NOW.getTime() - 0 * 24 * 60 * 60 * 1000),
        win: true,
      }),
      makeStreakRow({
        matchId: "EUW_W2",
        playedAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
        win: true,
      }),
      makeStreakRow({
        matchId: "EUW_W1",
        playedAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
        win: true,
      }),
      makeStreakRow({
        matchId: "EUW_BREAK",
        playedAt: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000),
        win: false,
      }),
      makeStreakRow({
        matchId: "EUW_OLDW",
        playedAt: new Date(NOW.getTime() - 4 * 24 * 60 * 60 * 1000),
        win: true,
      }),
    ];
    const { service } = makeService({ streakRows: rows });
    const result = await service.detectStreaks(NOW);
    expect(result).toEqual([]);
  });

  it("returns no candidates when the head match is outside the recency window", async () => {
    // 5-game win streak, but the most recent match is 45d ago.
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeStreakRow({
        matchId: `EUW_OLDW_${i}`,
        playedAt: new Date(NOW.getTime() - (45 + i) * 24 * 60 * 60 * 1000),
        win: true,
      })
    );
    const { service } = makeService({ streakRows: rows });
    const result = await service.detectStreaks(NOW);
    expect(result).toEqual([]);
  });

  it("emits STREAK_5W when the head 5 matches are all wins", async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeStreakRow({
        matchId: `EUW_HOT_${i}`,
        champion: i === 0 ? "Ahri" : "Lux",
        playedAt: new Date(NOW.getTime() - i * 24 * 60 * 60 * 1000),
        win: true,
      })
    );
    const { service } = makeService({ streakRows: rows });
    const result = await service.detectStreaks(NOW);
    expect(result).toHaveLength(1);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.momentType).toBe("STREAK_5W");
    expect(c.matchId).toBe("EUW_HOT_0");
    expect(c.championAlias).toBe("Ahri"); // head match's champion
    expect(c.slug).toBe("lol-moment-streak-w-EUW_HOT_0");
    expect(c.streak).toEqual({ result: "W", length: 5 });
    expect(c.baseSignal).toBeCloseTo(15);
  });

  it("emits STREAK_5L when the head 5 matches are all losses", async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeStreakRow({
        matchId: `EUW_COLD_${i}`,
        playedAt: new Date(NOW.getTime() - i * 24 * 60 * 60 * 1000),
        win: false,
      })
    );
    const { service } = makeService({ streakRows: rows });
    const result = await service.detectStreaks(NOW);
    expect(result).toHaveLength(1);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.momentType).toBe("STREAK_5L");
    expect(c.slug).toBe("lol-moment-streak-l-EUW_COLD_0");
    expect(c.streak).toEqual({ result: "L", length: 5 });
  });

  it("counts the FULL run length when it exceeds the minimum (8 wins → length 8)", async () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      makeStreakRow({
        matchId: `EUW_LONG_${i}`,
        playedAt: new Date(NOW.getTime() - i * 24 * 60 * 60 * 1000),
        win: true,
      })
    );
    const { service } = makeService({ streakRows: rows });
    const result = await service.detectStreaks(NOW);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.streak?.length).toBe(8);
    expect(c.baseSignal).toBeCloseTo(24); // 8 × 3
  });

  it("caps the base signal at STREAK_LENGTH_CAP × factor", async () => {
    // 18-game streak — length stays accurate, signal caps at 15 × 3 = 45.
    const rows = Array.from({ length: 18 }, (_, i) =>
      makeStreakRow({
        matchId: `EUW_LR_${i}`,
        playedAt: new Date(NOW.getTime() - i * 24 * 60 * 60 * 1000),
        win: true,
      })
    );
    const { service } = makeService({ streakRows: rows });
    const result = await service.detectStreaks(NOW);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.streak?.length).toBeGreaterThan(15);
    expect(c.baseSignal).toBeCloseTo(45);
  });

  it("passes `take` to findMany so the mock can discriminate vs KDA / hiatus calls", async () => {
    const { service, prisma } = makeService({ streakRows: [] });
    await service.detectStreaks(NOW);
    const calls = vi.mocked(prisma.match.findMany).mock.calls;
    const streakCall = calls.find((c) => (c[0] as { take?: number }).take !== undefined);
    expect(streakCall).toBeTruthy();
    const args = streakCall?.[0] as {
      where: { queueId: { in: number[] } };
      take: number;
    };
    expect(args.take).toBeGreaterThan(0);
    expect(new Set(args.where.queueId.in)).toEqual(new Set([420, 440]));
  });
});

function makeMarathonRow(opts: {
  matchId?: string;
  champion?: string;
  playedAt: Date;
  win?: boolean;
  kills?: number;
  deaths?: number;
  assists?: number;
  durationSec?: number;
  queueId?: number;
}): KdaMatchRow {
  return {
    matchId: opts.matchId ?? `EUW_M_${opts.playedAt.getTime()}`,
    champion: opts.champion ?? "Ahri",
    playedAt: opts.playedAt,
    kills: opts.kills ?? 6,
    deaths: opts.deaths ?? 4,
    assists: opts.assists ?? 8,
    win: opts.win ?? true,
    durationSec: opts.durationSec ?? 1800,
    queueId: opts.queueId ?? 420,
  };
}

describe("LolMomentsService.detectMarathons", () => {
  it("returns no candidates when there are no owner puuids", async () => {
    const { service, prisma } = makeService({ ownerPuuids: [] });
    const result = await service.detectMarathons(NOW);
    expect(result).toEqual([]);
    expect(prisma.match.findMany).not.toHaveBeenCalled();
  });

  it("returns no candidates when no cluster reaches the minimum match count", async () => {
    // 5 games over 12h (one short of threshold).
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeMarathonRow({
        matchId: `EUW_NO_${i}`,
        playedAt: new Date(NOW.getTime() - (5 - i) * 2 * 60 * 60 * 1000),
      })
    );
    const { service } = makeService({ marathonRows: rows });
    const result = await service.detectMarathons(NOW);
    expect(result).toEqual([]);
  });

  it("returns no candidates when 6 games are spread across more than 12 hours", async () => {
    // 6 games over 30 hours → no 12h window holds them all.
    const rows = Array.from({ length: 6 }, (_, i) =>
      makeMarathonRow({
        matchId: `EUW_SPREAD_${i}`,
        playedAt: new Date(NOW.getTime() - (30 - 5 * i) * 60 * 60 * 1000),
      })
    );
    const { service } = makeService({ marathonRows: rows });
    const result = await service.detectMarathons(NOW);
    expect(result).toEqual([]);
  });

  it("emits a MARATHON candidate for 6 games inside a 12h window", async () => {
    // 6 games over ~5h, capped on Ahri.
    const rows = [
      makeMarathonRow({
        matchId: "EUW_M0",
        playedAt: new Date(NOW.getTime() - 5 * 60 * 60 * 1000),
      }),
      makeMarathonRow({
        matchId: "EUW_M1",
        playedAt: new Date(NOW.getTime() - 4 * 60 * 60 * 1000),
      }),
      makeMarathonRow({
        matchId: "EUW_M2",
        playedAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
      }),
      makeMarathonRow({
        matchId: "EUW_M3",
        playedAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
      }),
      makeMarathonRow({
        matchId: "EUW_M4",
        playedAt: new Date(NOW.getTime() - 1 * 60 * 60 * 1000),
      }),
      makeMarathonRow({
        matchId: "EUW_CAP",
        champion: "Ahri",
        playedAt: new Date(NOW.getTime() - 0.5 * 60 * 60 * 1000),
      }),
    ];
    const { service } = makeService({ marathonRows: rows });
    const result = await service.detectMarathons(NOW);
    expect(result).toHaveLength(1);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.momentType).toBe("MARATHON");
    expect(c.matchId).toBe("EUW_CAP");
    expect(c.championAlias).toBe("Ahri");
    expect(c.slug).toBe("lol-moment-marathon-EUW_CAP");
    expect(c.marathon?.matchCount).toBe(6);
    expect(c.marathon?.spanHours).toBeCloseTo(4.5, 1);
    expect(c.baseSignal).toBeCloseTo(12); // 6 × 2
  });

  it("picks the most recent marathon when multiple qualify in the window", async () => {
    const earlier = Array.from({ length: 7 }, (_, i) =>
      makeMarathonRow({
        matchId: `EUW_OLD_${i}`,
        playedAt: new Date(NOW.getTime() - (20 * 24 - i) * 60 * 60 * 1000),
      })
    );
    const recent = Array.from({ length: 6 }, (_, i) =>
      makeMarathonRow({
        matchId: `EUW_NEW_${i}`,
        playedAt: new Date(NOW.getTime() - (6 - i) * 60 * 60 * 1000),
      })
    );
    const { service } = makeService({ marathonRows: [...earlier, ...recent] });
    const result = await service.detectMarathons(NOW);
    expect(result).toHaveLength(1);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    // Recent cap match (NEW_5) is the freshest end.
    expect(c.matchId).toBe("EUW_NEW_5");
    expect(c.marathon?.matchCount).toBe(6);
  });

  it("caps the base signal at MARATHON_MATCH_CAP × factor", async () => {
    // 20 games in a tight 11h window — count caps at 15, signal at 30.
    const rows = Array.from({ length: 20 }, (_, i) =>
      makeMarathonRow({
        matchId: `EUW_HUGE_${i}`,
        playedAt: new Date(NOW.getTime() - (11 - i * 0.5) * 60 * 60 * 1000),
      })
    );
    const { service } = makeService({ marathonRows: rows });
    const result = await service.detectMarathons(NOW);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.marathon?.matchCount).toBe(20);
    expect(c.baseSignal).toBeCloseTo(30);
  });

  it("orders the findMany scan ASC by playedAt (so the mock can discriminate vs KDA)", async () => {
    const { service, prisma } = makeService({ marathonRows: [] });
    await service.detectMarathons(NOW);
    const calls = vi.mocked(prisma.match.findMany).mock.calls;
    const marathonCall = calls.find((c) => {
      const args = c[0] as {
        where: { playedAt?: unknown };
        orderBy?: { playedAt?: string };
      };
      return args.where?.playedAt !== undefined && args.orderBy?.playedAt === "asc";
    });
    expect(marathonCall).toBeTruthy();
    const args = marathonCall?.[0] as { where: { queueId: { in: number[] } } };
    expect(new Set(args.where.queueId.in)).toEqual(new Set([420, 440]));
  });
});

describe("LolMomentsService.detectFavoriteChampions", () => {
  function makeFavoriteMatch(opts: {
    matchId: string;
    champion: string;
    kills?: number;
    deaths?: number;
    assists?: number;
    win?: boolean;
    durationSec?: number;
  }): KdaMatchRow {
    return {
      matchId: opts.matchId,
      champion: opts.champion,
      playedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000),
      kills: opts.kills ?? 6,
      deaths: opts.deaths ?? 4,
      assists: opts.assists ?? 9,
      win: opts.win ?? true,
      durationSec: opts.durationSec ?? 1820,
      queueId: 420,
    };
  }

  it("returns empty when no owner puuids resolved", async () => {
    const { service } = makeService({ ownerPuuids: [] });
    const result = await service.detectFavoriteChampions(NOW);
    expect(result).toEqual([]);
  });

  it("returns empty when no champion counts in window", async () => {
    const { service } = makeService({ favoriteWinCounts: [] });
    const result = await service.detectFavoriteChampions(NOW);
    expect(result).toEqual([]);
  });

  it("excludes Ahri and picks the next champion when Ahri tops the period", async () => {
    const { service } = makeService({
      favoriteWinCounts: [
        // Ahri dominates total games but is the structural anchor and
        // must be skipped — favorite is the next champion (Lulu).
        { champion: "Ahri", win: true, _count: { _all: 25 } },
        { champion: "Ahri", win: false, _count: { _all: 15 } },
        { champion: "Lulu", win: true, _count: { _all: 7 } },
        { champion: "Lulu", win: false, _count: { _all: 5 } },
        { champion: "Renekton", win: true, _count: { _all: 2 } },
      ],
      favoriteMostRecentMatch: {
        playedAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      favoriteCandidateMatches: [
        makeFavoriteMatch({ matchId: "EUW_BEST", champion: "Lulu", kills: 12 }),
      ],
    });
    const result = await service.detectFavoriteChampions(NOW);
    expect(result).toHaveLength(1);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.championAlias).toBe("Lulu");
    expect(c.favoriteChampion?.gameCount).toBe(12); // 7 + 5
    expect(c.favoriteChampion?.winCount).toBe(7);
    expect(c.favoriteChampion?.lossCount).toBe(5);
    expect(c.momentType).toBe("FAVORITE_CHAMPION_OF_PERIOD");
  });

  it("returns empty when the eligible favorite is below FAVORITE_MIN_GAMES (5)", async () => {
    const { service } = makeService({
      favoriteWinCounts: [
        // Top non-Ahri champ has only 4 games — not enough to claim
        // "side-project of the month" honestly.
        { champion: "Ahri", win: true, _count: { _all: 30 } },
        { champion: "Lulu", win: true, _count: { _all: 3 } },
        { champion: "Lulu", win: false, _count: { _all: 1 } },
      ],
    });
    const result = await service.detectFavoriteChampions(NOW);
    expect(result).toEqual([]);
  });

  it("picks the top non-Ahri champion when no Ahri play exists at all", async () => {
    const { service } = makeService({
      favoriteWinCounts: [
        { champion: "Renekton", win: true, _count: { _all: 6 } },
        { champion: "Renekton", win: false, _count: { _all: 4 } },
        { champion: "Lulu", win: true, _count: { _all: 3 } },
      ],
      favoriteMostRecentMatch: {
        playedAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      favoriteCandidateMatches: [
        makeFavoriteMatch({ matchId: "EUW_REN", champion: "Renekton" }),
      ],
    });
    const result = await service.detectFavoriteChampions(NOW);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.championAlias).toBe("Renekton");
    expect(c.favoriteChampion?.gameCount).toBe(10);
  });

  it("anchors daysSince on the most recent OVERALL ranked match, not just the favorite's last game", async () => {
    // Most recent ranked match overall was 1 day ago (on Ahri, the
    // anchor). The favorite is Lulu but their last Lulu game might be
    // 10 days back. The chapter is "this month" framed against the
    // page-level activity recency, not a single-champion timeline.
    const { service } = makeService({
      favoriteWinCounts: [
        { champion: "Ahri", win: true, _count: { _all: 20 } },
        { champion: "Lulu", win: true, _count: { _all: 5 } },
        { champion: "Lulu", win: false, _count: { _all: 3 } },
      ],
      favoriteMostRecentMatch: {
        playedAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      favoriteCandidateMatches: [
        makeFavoriteMatch({ matchId: "EUW_LULU", champion: "Lulu" }),
      ],
    });
    const result = await service.detectFavoriteChampions(NOW);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.daysSince).toBe(1);
  });

  it("picks the highest-KDA match on the favorite champion as the matchId anchor", async () => {
    const { service } = makeService({
      favoriteWinCounts: [{ champion: "Lulu", win: true, _count: { _all: 5 } }],
      favoriteMostRecentMatch: {
        playedAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      favoriteCandidateMatches: [
        // 5 / 6 / 4 → KDA ~1.5
        makeFavoriteMatch({
          matchId: "EUW_MID",
          champion: "Lulu",
          kills: 5,
          deaths: 6,
          assists: 4,
        }),
        // 12 / 2 / 14 → KDA 13
        makeFavoriteMatch({
          matchId: "EUW_BEST",
          champion: "Lulu",
          kills: 12,
          deaths: 2,
          assists: 14,
        }),
        // 3 / 8 / 2 → KDA ~0.625
        makeFavoriteMatch({
          matchId: "EUW_BAD",
          champion: "Lulu",
          kills: 3,
          deaths: 8,
          assists: 2,
        }),
      ],
    });
    const result = await service.detectFavoriteChampions(NOW);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.matchId).toBe("EUW_BEST");
    expect(c.matchStats?.kills).toBe(12);
  });

  it("returns empty when the most-recent ranked match query yields no rows (no ranked play in window)", async () => {
    const { service } = makeService({
      favoriteWinCounts: [{ champion: "Lulu", win: true, _count: { _all: 5 } }],
      favoriteMostRecentMatch: null,
      favoriteCandidateMatches: [],
    });
    const result = await service.detectFavoriteChampions(NOW);
    expect(result).toEqual([]);
  });

  it("queries only ranked queues and excludes remakes", async () => {
    const { service, prisma } = makeService({ favoriteWinCounts: [] });
    await service.detectFavoriteChampions(NOW);
    const groupByCalls = vi.mocked(prisma.match.groupBy).mock.calls;
    const favoriteGroupBy = groupByCalls.find((c) => {
      const args = c[0] as { by?: string[] };
      return args.by?.includes("win") ?? false;
    });
    expect(favoriteGroupBy).toBeTruthy();
    const args = favoriteGroupBy?.[0] as {
      where: {
        queueId?: { in: readonly number[] };
        remake?: boolean;
      };
    };
    expect(args.where.remake).toBe(false);
    expect(new Set(args.where.queueId?.in ?? [])).toEqual(new Set([420, 440]));
  });
});

describe("LolMomentsService.detectLifetimePeak", () => {
  function makeSnapshot(opts: {
    tier: string;
    rank: string;
    lp: number;
    daysAgo?: number;
  }) {
    return {
      tier: opts.tier,
      rank: opts.rank,
      leaguePoints: opts.lp,
      capturedAt: new Date(NOW.getTime() - (opts.daysAgo ?? 30) * 24 * 60 * 60 * 1000),
    };
  }

  it("returns empty when there are no owner puuids", async () => {
    const { service } = makeService({ ownerPuuids: [] });
    const result = await service.detectLifetimePeak(NOW);
    expect(result).toEqual([]);
  });

  it("returns empty when the owner has no RankSnapshot rows on file", async () => {
    const { service } = makeService({ rankSnapshotRows: [] });
    const result = await service.detectLifetimePeak(NOW);
    expect(result).toEqual([]);
  });

  it("picks the highest normalized LP across all snapshots regardless of how old", async () => {
    const { service } = makeService({
      rankSnapshotRows: [
        // Current snapshot — Silver IV 50 LP, recent.
        makeSnapshot({ tier: "SILVER", rank: "IV", lp: 50, daysAgo: 5 }),
        // Year-old peak — Emerald I 30 LP. Should win even though it's
        // way older; the retrospective register makes age irrelevant
        // to ranking.
        makeSnapshot({ tier: "EMERALD", rank: "I", lp: 30, daysAgo: 365 }),
        // Middle row — Platinum II 80 LP.
        makeSnapshot({ tier: "PLATINUM", rank: "II", lp: 80, daysAgo: 90 }),
      ],
      lifetimePeakAnchorMatch: { matchId: "EUW_RECENT_GAME", champion: "Ahri" },
    });
    const result = await service.detectLifetimePeak(NOW);
    expect(result).toHaveLength(1);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.lifetimePeak?.tier).toBe("EMERALD");
    expect(c.lifetimePeak?.rank).toBe("I");
    expect(c.lifetimePeak?.leaguePoints).toBe(30);
    expect(c.matchId).toBe("EUW_RECENT_GAME");
    expect(c.championAlias).toBe("Ahri");
  });

  it("anchors daysSince at 0 regardless of when the peak was actually hit", async () => {
    const { service } = makeService({
      rankSnapshotRows: [
        // Peak from 18 months ago. daysSince should still be 0 because
        // the chapter is being SURFACED today; the prose carries the
        // historical date via `lifetimePeak.achievedAt`.
        makeSnapshot({ tier: "DIAMOND", rank: "II", lp: 75, daysAgo: 540 }),
      ],
      lifetimePeakAnchorMatch: { matchId: "EUW_X", champion: "Ahri" },
    });
    const result = await service.detectLifetimePeak(NOW);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.daysSince).toBe(0);
  });

  it("carries the snapshot's capturedAt as the `achievedAt` ISO string", async () => {
    const peakDate = new Date("2024-08-15T14:23:00Z");
    const { service } = makeService({
      rankSnapshotRows: [
        {
          tier: "GOLD",
          rank: "I",
          leaguePoints: 50,
          capturedAt: peakDate,
        },
      ],
      lifetimePeakAnchorMatch: { matchId: "EUW_X", champion: "Ahri" },
    });
    const result = await service.detectLifetimePeak(NOW);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    expect(c.lifetimePeak?.achievedAt).toBe(peakDate.toISOString());
  });

  it("falls back to Ahri championAlias when no ranked matches exist (snapshot only)", async () => {
    const { service } = makeService({
      rankSnapshotRows: [makeSnapshot({ tier: "GOLD", rank: "I", lp: 50 })],
      lifetimePeakAnchorMatch: null,
    });
    const result = await service.detectLifetimePeak(NOW);
    const c = result[0];
    if (!c || c.kind !== "lol-moment") throw new Error("expected lol-moment");
    // Ahri fallback satisfies routes/index.tsx's `Boolean(championAlias)`
    // filter while remaining honest under the retrospective register —
    // Ahri is the page's structural anchor LoL subject anyway.
    expect(c.championAlias).toBe("Ahri");
    expect(c.matchId).toBeNull();
  });

  it("queries rankSnapshot with the Riot queueId vocabulary (RANKED_SOLO_5x5 / RANKED_FLEX_SR)", async () => {
    const { service, prisma } = makeService({ rankSnapshotRows: [] });
    await service.detectLifetimePeak(NOW);
    const calls = vi.mocked(prisma.rankSnapshot.findMany).mock.calls;
    expect(calls.length).toBe(1);
    const args = calls[0]?.[0] as {
      where: { queueId: { in: readonly string[] } };
    };
    expect(new Set(args.where.queueId.in)).toEqual(
      new Set(["RANKED_SOLO_5x5", "RANKED_FLEX_SR"])
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
      hiatusRows: [
        makeHiatusRow({
          matchId: "EUW_OLD_H",
          playedAt: new Date(NOW.getTime() - 35 * 24 * 60 * 60 * 1000),
        }),
        makeHiatusRow({
          matchId: "EUW_BACK_H",
          playedAt: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000),
        }),
      ],
      streakRows: Array.from({ length: 5 }, (_, i) =>
        makeStreakRow({
          matchId: `EUW_S_${i}`,
          playedAt: new Date(NOW.getTime() - i * 24 * 60 * 60 * 1000),
          win: true,
        })
      ),
      marathonRows: Array.from({ length: 6 }, (_, i) =>
        makeMarathonRow({
          matchId: `EUW_MAR_${i}`,
          playedAt: new Date(NOW.getTime() - (6 - i) * 60 * 60 * 1000),
        })
      ),
      // LIFETIME_PEAK_RANK now reads from RankSnapshot, not from Match
      // — provide a fixture so the dry-spell top-up emits a candidate
      // in the integration test alongside the event-tier detectors.
      rankSnapshotRows: [
        {
          tier: "EMERALD",
          rank: "I",
          leaguePoints: 17,
          capturedAt: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000),
        },
      ],
      lifetimePeakAnchorMatch: { matchId: "EUW_42", champion: "Renekton" },
    });
    const result = await service.detectAll(NOW);
    // Six event-tier detectors + LIFETIME_PEAK_RANK (R-7i Lane B
    // always-on top-up reading from RankSnapshot).
    expect(result).toHaveLength(7);
    const momentTypes = result
      .filter((r) => r.kind === "lol-moment")
      .map((r) => (r.kind === "lol-moment" ? r.momentType : null));
    expect(new Set(momentTypes)).toEqual(
      new Set([
        "OFF_META_PICK",
        "RANK_UP",
        "KDA_OUTLIER",
        "RETURN_FROM_HIATUS",
        "STREAK_5W",
        "MARATHON",
        "LIFETIME_PEAK_RANK",
      ])
    );
  });
});
