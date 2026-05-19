import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendComebackResilience } from "./trend-comeback-resilience";

function match(idx: number, win: boolean, teamGoldDiffAt15: number): MatchSummary {
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
    teamGoldDiffAt15,
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
  };
}

function renderTile(matches: MatchSummary[]) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <TrendComebackResilience current={matches} previous={[]} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendComebackResilience", () => {
  it("renders the not-enough-projections empty state under 5 timeline matches", () => {
    renderTile([match(0, true, -6000)]);
    expect(
      screen.getByText(
        "Need 5+ matches with a projected timeline to gauge comeback ability."
      )
    ).toBeTruthy();
  });

  it("renders the 'not behind that early' empty state when fewer than 5 games are behind 5k", () => {
    // 6 projected games, only 2 behind 5k+.
    const matches = [
      match(0, true, -6000),
      match(1, true, -5500),
      match(2, true, 2000),
      match(3, true, 1500),
      match(4, true, 1000),
      match(5, true, 500),
    ];
    renderTile(matches);
    expect(
      screen.getByText(
        /Only 2 games down 5k\+ at 15 min — usually you're not behind that early\./
      )
    ).toBeTruthy();
  });

  it("renders the 'close to typical' verdict when within ±5pp of the 30% baseline", () => {
    // 10 behind games, 3 wins → 30% — exactly typical.
    const matches = [
      ...Array.from({ length: 3 }, (_, i) => match(i, true, -6000)),
      ...Array.from({ length: 7 }, (_, i) => match(i + 3, false, -6000)),
    ];
    renderTile(matches);
    expect(screen.getByText(/close to typical \(~30%\)/)).toBeTruthy();
  });

  it("renders the above-typical verdict when behind WR beats 30% by 5+ pp", () => {
    // 10 behind games, 6 wins → 60% (+30pp above 30%).
    const matches = [
      ...Array.from({ length: 6 }, (_, i) => match(i, true, -6000)),
      ...Array.from({ length: 4 }, (_, i) => match(i + 6, false, -6000)),
    ];
    renderTile(matches);
    expect(screen.getByText(/30% above typical/)).toBeTruthy();
  });

  it("renders the below-typical verdict and prescription when behind WR is under 20%", () => {
    // 10 behind games, all losses → 0% (well below 30%).
    const matches = Array.from({ length: 10 }, (_, i) => match(i, false, -6000));
    renderTile(matches);
    expect(screen.getByText(/30% below typical/)).toBeTruthy();
    expect(
      screen.getByText(
        "Practice playing from behind — focus on safety, scaling, single picks."
      )
    ).toBeTruthy();
  });
});
