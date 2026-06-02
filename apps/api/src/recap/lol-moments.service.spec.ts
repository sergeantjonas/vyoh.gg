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

function makeService(opts: {
  ownerPuuids?: string[];
  championCounts?: ChampionCountRow[];
  offMetaMatch?: MatchRow | null;
}) {
  const identity = {
    getOwnerPuuids: vi.fn().mockResolvedValue(opts.ownerPuuids ?? ["P_owner"]),
  } as unknown as IdentityService;
  const prisma = {
    match: {
      groupBy: vi.fn().mockResolvedValue(opts.championCounts ?? []),
      findFirst: vi.fn().mockResolvedValue(opts.offMetaMatch ?? null),
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

describe("LolMomentsService.detectAll", () => {
  it("collects every detector's output into one candidate list", async () => {
    const { service } = makeService({
      championCounts: [{ champion: "Ahri", _count: { _all: 50 } }],
      offMetaMatch: {
        matchId: "EUW_42",
        champion: "Renekton",
        playedAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
    });
    const result = await service.detectAll(NOW);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("lol-moment");
  });
});
