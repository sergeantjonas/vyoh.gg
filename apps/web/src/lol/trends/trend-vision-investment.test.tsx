import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendVisionInvestment } from "./trend-vision-investment";

function match(
  idx: number,
  teamPosition: string,
  visionScore: number,
  queueType = "Ranked Solo"
): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueType,
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win: true,
    durationSec: 1800,
    playedAt: new Date(Date.UTC(2026, 0, idx + 1)).toISOString(),
    remake: false,
    teamPosition,
    gameVersion: "16.9.1.1",
    visionScore,
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
        <TrendVisionInvestment current={current} previous={[]} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendVisionInvestment", () => {
  it("renders the empty placeholder when no primary role is detected", () => {
    renderTile([]);
    expect(
      screen.getByText("Need 5+ Rift games on a role to gauge vision investment.")
    ).toBeTruthy();
  });

  it("renders the empty placeholder when fewer than 5 games on the primary role", () => {
    const matches = Array.from({ length: 3 }, (_, i) => match(i, "MIDDLE", 25));
    renderTile(matches);
    expect(
      screen.getByText("Need 5+ Rift games on a role to gauge vision investment.")
    ).toBeTruthy();
  });

  it("emits the 'well above' verdict when avg vision exceeds 1.15× the role floor", () => {
    // MIDDLE baseline is ~22; 50 average → 50/22 ≈ 2.27 → well above.
    const matches = Array.from({ length: 6 }, (_, i) => match(i, "MIDDLE", 50));
    renderTile(matches);
    expect(screen.getByText(/well above the role's typical floor/)).toBeTruthy();
  });

  it("emits the 'well below' verdict and ward prescription when vision is under 70% of floor", () => {
    // Vision score of 1 across 6 MID games → far below baseline → ratio < 0.7.
    const matches = Array.from({ length: 6 }, (_, i) => match(i, "MIDDLE", 1));
    renderTile(matches);
    expect(screen.getByText(/well below the typical floor/)).toBeTruthy();
    expect(
      screen.getByText("Buy a control ward on every back, sweep before objectives.")
    ).toBeTruthy();
  });
});
