import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendTimeHeatmap } from "./trend-time-heatmap";

function match(idx: number, win: boolean, playedAt: string): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win,
    durationSec: 1800,
    playedAt,
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "16.9.1.1",
    visionScore: 0,
    damageShare: 0,
    firstBloodKill: false,
    csAt10: 0,
    csAt15: 0,
    goldAt10: 0,
    goldAt15: 0,
    teamGoldDiffAt15: 0,
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
  };
}

function renderTile(current: MatchSummary[]) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <TrendTimeHeatmap current={current} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendTimeHeatmap", () => {
  it("renders the empty copy when fewer than 5 matches", () => {
    renderTile([
      match(0, true, "2026-05-14T20:00:00Z"),
      match(1, false, "2026-05-14T20:00:00Z"),
    ]);
    expect(
      screen.getByText("Not enough games yet to build a time heatmap.")
    ).toBeTruthy();
  });

  it("renders the not-enough-data-per-slot copy when no slot meets the 3-game minimum", () => {
    // 5 matches all in different slots → each slot has 1 game, below threshold.
    const matches = [
      match(0, true, "2026-05-11T08:00:00Z"),
      match(1, true, "2026-05-12T10:00:00Z"),
      match(2, true, "2026-05-13T12:00:00Z"),
      match(3, true, "2026-05-14T14:00:00Z"),
      match(4, true, "2026-05-15T16:00:00Z"),
    ];
    renderTile(matches);
    expect(screen.getByText("Not enough data per slot yet.")).toBeTruthy();
  });

  it("emits the strongest-slot verdict when a slot has 3+ games", () => {
    // 3 wins all clustered at the same day+hour → meets MIN_BAR_SAMPLE=3.
    const matches = [
      match(0, true, "2026-05-11T20:00:00Z"),
      match(1, true, "2026-05-11T20:00:00Z"),
      match(2, true, "2026-05-11T20:00:00Z"),
      match(3, false, "2026-05-12T20:00:00Z"),
      match(4, false, "2026-05-12T20:00:00Z"),
    ];
    renderTile(matches);
    expect(screen.getByText(/Strongest slot:.* 100% WR over 3 games\./)).toBeTruthy();
  });

  it("emits the schedule-ranked-there prescription when slot WR exceeds overall by 10pp", () => {
    // Overall WR: 3 wins / 5 games = 60%. Slot WR: 100% (gap = 40pp > 10).
    const matches = [
      match(0, true, "2026-05-11T20:00:00Z"),
      match(1, true, "2026-05-11T20:00:00Z"),
      match(2, true, "2026-05-11T20:00:00Z"),
      match(3, false, "2026-05-12T20:00:00Z"),
      match(4, false, "2026-05-12T20:00:00Z"),
    ];
    renderTile(matches);
    expect(screen.getByText("Schedule ranked sessions there.")).toBeTruthy();
  });
});
