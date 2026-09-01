import { describe, expect, it } from "vitest";
import { type DuoLpSourceMatch, computeDuoLpOverlays } from "./duo-lp.ts";

function ranked(
  matchId: string,
  playedAt: string,
  lpBefore: number,
  lpAfter: number,
  overrides: Partial<DuoLpSourceMatch> = {}
): DuoLpSourceMatch {
  return {
    matchId,
    playedAt,
    queueId: 420,
    remake: false,
    snapshotTier: "GOLD",
    snapshotRank: "II",
    snapshotLp: lpAfter,
    snapshotTierBefore: "GOLD",
    snapshotRankBefore: "II",
    snapshotLpBefore: lpBefore,
    ...overrides,
  };
}

describe("computeDuoLpOverlays", () => {
  it("returns no overlays for no duos", () => {
    expect(
      computeDuoLpOverlays([], [ranked("M1", "2026-08-01T10:00:00.000Z", 10, 30)])
    ).toEqual([]);
  });

  it("splits the owner's ranked LP by whether the duo was in the game", () => {
    const matches = [
      ranked("M1", "2026-08-01T10:00:00.000Z", 10, 30),
      ranked("M2", "2026-08-01T11:00:00.000Z", 30, 15),
      ranked("M3", "2026-08-02T10:00:00.000Z", 15, 40),
    ];
    const [overlay] = computeDuoLpOverlays(
      [{ puuid: "p1", matchIds: ["M1", "M3"] }],
      matches
    );
    expect(overlay).toEqual({
      puuid: "p1",
      together: { games: 2, lpDelta: 45 },
      without: { games: 1, lpDelta: -15 },
      matches: [
        { matchId: "M3", playedAt: "2026-08-02T10:00:00.000Z", lpDelta: 25 },
        { matchId: "M1", playedAt: "2026-08-01T10:00:00.000Z", lpDelta: 20 },
      ],
    });
  });

  it("ignores remakes, unranked queues and games without both snapshots on both sides", () => {
    const matches = [
      ranked("M1", "2026-08-01T10:00:00.000Z", 10, 30),
      ranked("R", "2026-08-01T11:00:00.000Z", 30, 30, { remake: true }),
      ranked("N", "2026-08-01T12:00:00.000Z", 0, 0, { queueId: 450 }),
      ranked("H", "2026-08-01T13:00:00.000Z", 0, 50, { snapshotLpBefore: null }),
      ranked("W", "2026-08-01T14:00:00.000Z", 30, 12),
    ];
    const [overlay] = computeDuoLpOverlays(
      [{ puuid: "p1", matchIds: ["M1", "R", "N", "H"] }],
      matches
    );
    expect(overlay?.together).toEqual({ games: 1, lpDelta: 20 });
    expect(overlay?.without).toEqual({ games: 1, lpDelta: -18 });
    expect(overlay?.matches.map((m) => m.matchId)).toEqual(["M1"]);
  });

  it("sums solo and flex deltas into one ranked total", () => {
    const matches = [
      ranked("S", "2026-08-01T10:00:00.000Z", 10, 30),
      ranked("F", "2026-08-01T11:00:00.000Z", 50, 65, { queueId: 440 }),
    ];
    const [overlay] = computeDuoLpOverlays(
      [{ puuid: "p1", matchIds: ["S", "F"] }],
      matches
    );
    expect(overlay?.together).toEqual({ games: 2, lpDelta: 35 });
    expect(overlay?.without).toEqual({ games: 0, lpDelta: 0 });
  });
});
