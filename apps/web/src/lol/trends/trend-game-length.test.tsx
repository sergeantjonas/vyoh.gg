import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendGameLength } from "./trend-game-length";

function match(idx: number, win: boolean, durationSec: number): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win,
    durationSec,
    playedAt: new Date(Date.UTC(2026, 0, idx + 1)).toISOString(),
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
        <TrendGameLength current={current} previous={[]} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendGameLength", () => {
  it("renders the not-enough-games copy when fewer than 5 played", () => {
    renderTile([match(0, true, 1800)]);
    expect(
      screen.getByText("Not enough games yet to analyse game-length patterns.")
    ).toBeTruthy();
  });

  it("renders the 2+ buckets copy when only one bucket has games", () => {
    // 6 games all in the "25–35m" bucket → only 1 bucket → empty copy.
    const matches = Array.from({ length: 6 }, (_, i) => match(i, true, 1800));
    renderTile(matches);
    expect(screen.getByText("Need games across 2+ different game lengths.")).toBeTruthy();
  });

  it("emits the strongest-bucket verdict when 2+ buckets have data", () => {
    // 4 short games (all wins) + 4 long games (all losses).
    const matches = [
      ...Array.from({ length: 4 }, (_, i) => match(i, true, 1200)), // 20m → Under 25m
      ...Array.from({ length: 4 }, (_, i) => match(i + 4, false, 2400)), // 40m → Over 35m
    ];
    renderTile(matches);
    expect(
      screen.getByText("You're strongest in Under 25m games — 100% WR over 4 games.")
    ).toBeTruthy();
  });

  it("renders the surrender-earlier prescription when the long-game gap is at least 12pp", () => {
    // Short bucket all wins (100%), long bucket all losses (0%) → gap = 100pp ≥ 12.
    const matches = [
      ...Array.from({ length: 4 }, (_, i) => match(i, true, 1200)),
      ...Array.from({ length: 4 }, (_, i) => match(i + 4, false, 2400)),
    ];
    renderTile(matches);
    expect(
      screen.getByText("Consider surrendering earlier in long losing games.")
    ).toBeTruthy();
  });
});
