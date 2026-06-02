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

function makeService(opts: {
  ownerPuuids?: string[];
  championCounts?: ChampionCountRow[];
  offMetaMatch?: MatchRow | null;
  rankUpRows?: SnapshotMatchRow[];
}) {
  const identity = {
    getOwnerPuuids: vi.fn().mockResolvedValue(opts.ownerPuuids ?? ["P_owner"]),
  } as unknown as IdentityService;
  const prisma = {
    match: {
      groupBy: vi.fn().mockResolvedValue(opts.championCounts ?? []),
      findFirst: vi.fn().mockResolvedValue(opts.offMetaMatch ?? null),
      findMany: vi.fn().mockResolvedValue(opts.rankUpRows ?? []),
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
    });
    const result = await service.detectAll(NOW);
    expect(result).toHaveLength(2);
    const momentTypes = result
      .filter((r) => r.kind === "lol-moment")
      .map((r) => (r.kind === "lol-moment" ? r.momentType : null));
    expect(new Set(momentTypes)).toEqual(new Set(["OFF_META_PICK", "RANK_UP"]));
  });
});
