import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendLanePhasePrognosis } from "./trend-lane-phase-prognosis";

function match(idx: number, position: string, csAt10: number): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win: true,
    durationSec: 1800,
    playedAt: new Date(Date.UTC(2026, 0, idx + 1)).toISOString(),
    remake: false,
    teamPosition: position,
    gameVersion: "16.9.1.1",
    visionScore: 0,
    damageShare: 0,
    firstBloodKill: false,
    csAt10,
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
        <TrendLanePhasePrognosis current={current} previous={[]} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendLanePhasePrognosis", () => {
  it("renders the support copy when primary role is UTILITY", () => {
    const matches = Array.from({ length: 5 }, (_, i) => match(i, "UTILITY", 10));
    renderTile(matches);
    expect(
      screen.getByText(
        "Support play isn't farm-driven — see vision investment for the relevant signal."
      )
    ).toBeTruthy();
  });

  it("renders the empty copy when no role has 5+ projected games", () => {
    renderTile([match(0, "MIDDLE", 80), match(1, "TOP", 70)]);
    expect(
      screen.getByText(
        "Need 5+ Rift games with a projected timeline to gauge lane phase."
      )
    ).toBeTruthy();
  });

  it("emits the at-floor verdict when CS@10 matches the role baseline", () => {
    // Mid baseline CS@10 = 80. 5 games at 80.
    const matches = Array.from({ length: 5 }, (_, i) => match(i, "MIDDLE", 80));
    renderTile(matches);
    expect(
      screen.getByText("CS@10 on Middle averages 80 — right at the role's typical floor.")
    ).toBeTruthy();
  });

  it("emits the ahead-of-typical verdict when CS@10 is 5+ above baseline", () => {
    const matches = Array.from({ length: 5 }, (_, i) => match(i, "MIDDLE", 95));
    renderTile(matches);
    expect(
      screen.getByText("CS@10 on Middle averages 95 — 15 ahead of typical.")
    ).toBeTruthy();
  });

  it("emits the behind-typical verdict and prescription when 10+ behind baseline", () => {
    // Mid baseline 80 → 5 games at 60 → delta -20.
    const matches = Array.from({ length: 5 }, (_, i) => match(i, "MIDDLE", 60));
    renderTile(matches);
    expect(
      screen.getByText(
        "CS@10 on Middle averages 60 — 20 behind typical, early lane needs work."
      )
    ).toBeTruthy();
    expect(screen.getByText("Practice last-hitting in the practice tool.")).toBeTruthy();
  });
});
