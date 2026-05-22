import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { LolService } from "./lol.service";
import { MatchNarrativeService } from "./match-narrative.service";

const PUUID = "test-puuid";

function makeDetailRow(
  matchId: string,
  challenges: Partial<{
    soloKills: number;
    outnumberedKills: number;
    survivedSingleDigitHpCount: number;
  }>,
  options: { ownerPuuid?: string } = {}
) {
  return {
    matchId,
    detail: {
      info: {
        participants: [
          { puuid: options.ownerPuuid ?? PUUID, isOwner: true, challenges },
          { puuid: "other-puuid", isOwner: false, challenges: { soloKills: 99 } },
        ],
      },
    },
  };
}

function makeService(
  matchRows: { matchId: string }[],
  detailRows: unknown[] = []
): MatchNarrativeService {
  const prisma = {
    match: { findMany: vi.fn().mockResolvedValue(matchRows) },
    matchDetailCache: { findMany: vi.fn().mockResolvedValue(detailRows) },
  } as unknown as PrismaService;
  const lol = {
    resolveSummoner: vi.fn().mockResolvedValue({ puuid: PUUID }),
  } as unknown as LolService;
  return new MatchNarrativeService(prisma, lol);
}

const ACCOUNT = ["euw1", "TestUser", "EUW"] as const;

describe("MatchNarrativeService.getNarrativeWindow", () => {
  it("returns zero counts when no match IDs are supplied", async () => {
    const svc = makeService([]);
    const result = await svc.getNarrativeWindow(...ACCOUNT, []);
    expect(result).toEqual({
      matchCount: 0,
      remakeCount: 0,
      highlightReel: {
        soloKills: 0,
        outnumberedKills: 0,
        survivedSingleDigitHpCount: 0,
      },
    });
  });

  it("returns zero counts when none of the supplied IDs match owner-played, non-remake rows", async () => {
    const svc = makeService([]);
    const result = await svc.getNarrativeWindow(...ACCOUNT, ["EUW1_1", "EUW1_2"]);
    expect(result.matchCount).toBe(0);
    // Caller-supplied IDs that don't survive the puuid+remake filter are
    // surfaced as remakeCount so the tile can show "excluded N remakes".
    expect(result.remakeCount).toBe(2);
  });

  it("sums challenge fields across owner participants only", async () => {
    const matchRows = [{ matchId: "EUW1_1" }, { matchId: "EUW1_2" }];
    const detailRows = [
      makeDetailRow("EUW1_1", {
        soloKills: 2,
        outnumberedKills: 1,
        survivedSingleDigitHpCount: 1,
      }),
      makeDetailRow("EUW1_2", {
        soloKills: 3,
        outnumberedKills: 0,
        survivedSingleDigitHpCount: 0,
      }),
    ];
    const svc = makeService(matchRows, detailRows);
    const result = await svc.getNarrativeWindow(...ACCOUNT, ["EUW1_1", "EUW1_2"]);
    expect(result.matchCount).toBe(2);
    expect(result.highlightReel).toEqual({
      soloKills: 5,
      outnumberedKills: 1,
      survivedSingleDigitHpCount: 1,
    });
  });

  it("treats missing challenge fields as zero (Riot omits unused fields)", async () => {
    const matchRows = [{ matchId: "EUW1_1" }];
    const detailRows = [makeDetailRow("EUW1_1", { soloKills: 2 })];
    const svc = makeService(matchRows, detailRows);
    const result = await svc.getNarrativeWindow(...ACCOUNT, ["EUW1_1"]);
    expect(result.highlightReel).toEqual({
      soloKills: 2,
      outnumberedKills: 0,
      survivedSingleDigitHpCount: 0,
    });
  });

  it("skips detail rows where the owner puuid isn't a participant", async () => {
    const matchRows = [{ matchId: "EUW1_1" }];
    const detailRows = [
      // Owner doesn't appear in participants — defensive guard against stale
      // detail cache rows after a puuid reassignment.
      makeDetailRow("EUW1_1", { soloKills: 10 }, { ownerPuuid: "stale-puuid" }),
    ];
    const svc = makeService(matchRows, detailRows);
    const result = await svc.getNarrativeWindow(...ACCOUNT, ["EUW1_1"]);
    expect(result.matchCount).toBe(0);
    expect(result.highlightReel.soloKills).toBe(0);
  });

  it("reports remakeCount as the gap between requested IDs and owner-played non-remake rows", async () => {
    // 3 requested; only 1 survives the puuid+remake filter → 2 excluded.
    const matchRows = [{ matchId: "EUW1_2" }];
    const detailRows = [makeDetailRow("EUW1_2", { soloKills: 1 })];
    const svc = makeService(matchRows, detailRows);
    const result = await svc.getNarrativeWindow(...ACCOUNT, [
      "EUW1_1",
      "EUW1_2",
      "EUW1_3",
    ]);
    expect(result.matchCount).toBe(1);
    expect(result.remakeCount).toBe(2);
  });
});

function makeLifetimeDetailRow(
  matchId: string,
  multikills: Partial<{
    doubleKills: number;
    tripleKills: number;
    quadraKills: number;
    pentaKills: number;
    largestKillingSpree: number;
  }>,
  options: { ownerPuuid?: string } = {}
) {
  return {
    matchId,
    detail: {
      info: {
        participants: [
          {
            puuid: options.ownerPuuid ?? PUUID,
            isOwner: true,
            ...multikills,
          },
          {
            puuid: "other-puuid",
            isOwner: false,
            // Other-participant multikills must not bleed into owner totals.
            pentaKills: 99,
            largestKillingSpree: 50,
          },
        ],
      },
    },
  };
}

describe("MatchNarrativeService.getLifetimeNarrative", () => {
  it("returns zero counts when the owner has no stored matches", async () => {
    const svc = makeService([]);
    const result = await svc.getLifetimeNarrative(...ACCOUNT);
    expect(result).toEqual({
      matchCount: 0,
      multikills: {
        pentaKills: 0,
        quadraKills: 0,
        tripleKills: 0,
        doubleKills: 0,
        largestKillingSpree: 0,
      },
    });
  });

  it("sums multikill fields across owner participants only", async () => {
    const matchRows = [{ matchId: "EUW1_1" }, { matchId: "EUW1_2" }];
    const detailRows = [
      makeLifetimeDetailRow("EUW1_1", {
        pentaKills: 1,
        quadraKills: 2,
        tripleKills: 4,
        doubleKills: 10,
        largestKillingSpree: 8,
      }),
      makeLifetimeDetailRow("EUW1_2", {
        pentaKills: 0,
        quadraKills: 1,
        tripleKills: 3,
        doubleKills: 7,
        largestKillingSpree: 12,
      }),
    ];
    const svc = makeService(matchRows, detailRows);
    const result = await svc.getLifetimeNarrative(...ACCOUNT);
    expect(result.matchCount).toBe(2);
    expect(result.multikills).toEqual({
      pentaKills: 1,
      quadraKills: 3,
      tripleKills: 7,
      doubleKills: 17,
      // largestKillingSpree is a max — not a sum.
      largestKillingSpree: 12,
    });
  });

  it("takes the max killing spree, never the sum", async () => {
    const matchRows = [{ matchId: "EUW1_1" }, { matchId: "EUW1_2" }];
    const detailRows = [
      makeLifetimeDetailRow("EUW1_1", { largestKillingSpree: 7 }),
      makeLifetimeDetailRow("EUW1_2", { largestKillingSpree: 4 }),
    ];
    const svc = makeService(matchRows, detailRows);
    const result = await svc.getLifetimeNarrative(...ACCOUNT);
    expect(result.multikills.largestKillingSpree).toBe(7);
  });
});
