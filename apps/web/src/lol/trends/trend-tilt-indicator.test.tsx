import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendTiltIndicator } from "./trend-tilt-indicator";

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
    // Ascending playedAt so chronological sort is index order.
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

function fromPattern(wins: boolean[]): MatchSummary[] {
  return wins.map((w, i) => match(i, w));
}

function renderTilt(matches: MatchSummary[]) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <TrendTiltIndicator current={matches} previous={[]} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendTiltIndicator", () => {
  it("renders the not-enough-games copy when there are fewer than 5 played games", () => {
    renderTilt(fromPattern([true, true, false, true]));
    expect(
      screen.getByText("Not enough games yet to detect tilt patterns.")
    ).toBeTruthy();
  });

  it("renders the need-5-in-each-bucket copy when only one bucket has data", () => {
    // 12 straight wins → afterWin=11, afterLoss=0 → MIN_SAMPLE not met in afterLoss.
    renderTilt(fromPattern(Array.from({ length: 12 }, () => true)));
    expect(
      screen.getByText(
        "Need 5+ games after a win and after a loss to detect tilt patterns."
      )
    ).toBeTruthy();
  });

  it("emits 'drops X% after a loss' when after-win WR exceeds after-loss WR", () => {
    // 6 wins then 6 losses chronologically →
    // afterWin: 6 games, 5 wins = 83%
    // afterLoss: 5 games, 0 wins = 0%
    // diffPp = +83 → after-loss is worse.
    renderTilt(
      fromPattern([
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
      ])
    );
    expect(screen.getByText(/Win rate drops 83% after a loss\./)).toBeTruthy();
    expect(screen.getByText(/Consider stepping away after a loss\./)).toBeTruthy();
  });

  it("emits 'drops X% after a win — fresh sessions help' when after-loss WR exceeds after-win WR", () => {
    // Alternating L W L W ... starting with L (12 games) →
    // afterLoss: 6 games 6 wins = 100%
    // afterWin: 5 games 0 wins = 0%
    // diffPp = -100 → fresh sessions branch.
    renderTilt(
      fromPattern([
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
      ])
    );
    expect(
      screen.getByText("Win rate drops 100% after a win — fresh sessions help.")
    ).toBeTruthy();
  });

  it("omits the prescription when after-loss WR is higher (negative diffPp)", () => {
    // Alternating starting with W → afterWin 5g 0W, afterLoss 5g 5W. diffPp = -100;
    // prescription requires diffPp >= 8, so the negative branch never shows it.
    renderTilt(
      fromPattern([true, false, true, false, true, false, true, false, true, false, true])
    );
    expect(
      screen.getByText("Win rate drops 100% after a win — fresh sessions help.")
    ).toBeTruthy();
    expect(screen.queryByText(/Consider stepping away after a loss/)).toBeNull();
  });
});
