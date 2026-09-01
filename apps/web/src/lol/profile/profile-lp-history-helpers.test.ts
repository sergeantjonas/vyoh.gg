import type { RankHistoryPoint } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { findSnapshotIndices, toChartPoints } from "./profile-lp-history-helpers";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const base = new Date("2026-01-01T00:00:00Z").getTime();

function snapshot(offsetMs: number, leaguePoints: number): RankHistoryPoint {
  return {
    capturedAt: new Date(base + offsetMs).toISOString(),
    queueId: "RANKED_SOLO_5x5",
    tier: "SILVER",
    rank: "II",
    leaguePoints,
  };
}

describe("findSnapshotIndices", () => {
  const points = toChartPoints([
    snapshot(0, 30),
    snapshot(DAY, 40),
    snapshot(2 * DAY, 50),
    snapshot(3 * DAY, 60),
  ]);

  it("maps each game to the first snapshot captured after it, deduplicated and ordered", () => {
    const games = [2 * DAY + HOUR, DAY - HOUR, DAY - 2 * HOUR].map((o) => base + o);
    expect(findSnapshotIndices(games, points)).toEqual([1, 3]);
  });

  it("keeps a game played shortly before the first snapshot, drops one from long before", () => {
    expect(findSnapshotIndices([base - HOUR, base - 2 * DAY], points)).toEqual([0]);
  });

  it("drops a game with no snapshot after it", () => {
    expect(findSnapshotIndices([base + 3 * DAY + HOUR], points)).toEqual([]);
  });

  it("returns nothing for an empty series", () => {
    expect(findSnapshotIndices([base], [])).toEqual([]);
  });

  it("lands a game inside a day bucket on that bucket's closing point", () => {
    // Day resolution folds the two same-day snapshots into one point that
    // closes on the later capture, so a game between them maps to it.
    const bucketed = toChartPoints(
      [
        snapshot(0, 30),
        snapshot(10 * HOUR, 40),
        snapshot(14 * HOUR, 50),
        snapshot(2 * DAY, 60),
      ],
      "day"
    );
    expect(findSnapshotIndices([base + 12 * HOUR], bucketed)).toEqual([0]);
  });
});
