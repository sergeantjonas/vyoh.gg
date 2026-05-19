import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendWrTrajectory } from "./trend-wr-trajectory";

function match(idx: number, win: boolean): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win,
    durationSec: 1800,
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

function buildN(n: number, winCount: number): MatchSummary[] {
  return Array.from({ length: n }, (_, i) => match(i, i < winCount));
}

function renderTraj(current: MatchSummary[], previous: MatchSummary[] = []) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <TrendWrTrajectory current={current} previous={previous} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendWrTrajectory", () => {
  it("renders the empty placeholder under 20 played games", () => {
    renderTraj(buildN(19, 10));
    expect(screen.getByText("Need 20+ games to plot win-rate trajectory.")).toBeTruthy();
  });

  it("renders the bare WR verdict when no previous window exists", () => {
    // 25 games, 10 wins → 40% WR.
    renderTraj(buildN(25, 10));
    expect(screen.getByText("40% win rate over 25 games.")).toBeTruthy();
  });

  it("renders the steady verdict when current and previous WR match", () => {
    renderTraj(buildN(25, 10), buildN(25, 10));
    expect(screen.getByText("WR steady vs prior window — 40% overall.")).toBeTruthy();
  });

  it("renders the up-vs-prior verdict when current WR exceeds previous", () => {
    // current 50%, previous 25% → +25pp.
    renderTraj(buildN(20, 10), buildN(20, 5));
    expect(screen.getByText("WR up 25% vs prior window — 50% overall.")).toBeTruthy();
  });

  it("renders the down-vs-prior verdict with the take-a-break prescription when delta ≤ -8", () => {
    // current 40%, previous 80% → -40pp.
    renderTraj(buildN(25, 10), buildN(25, 20));
    expect(screen.getByText("WR down 40% vs prior window — what changed?")).toBeTruthy();
    expect(
      screen.getByText("Take a break or change up your champion pool.")
    ).toBeTruthy();
  });

  it("omits the prescription when the drop is shallower than 8pp", () => {
    // current 48% (12/25), previous 52% (13/25) → -4pp.
    renderTraj(buildN(25, 12), buildN(25, 13));
    expect(screen.getByText(/WR down 4% vs prior window/)).toBeTruthy();
    expect(screen.queryByText(/Take a break or change up/)).toBeNull();
  });
});
