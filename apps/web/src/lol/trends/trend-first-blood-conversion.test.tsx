import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendFirstBloodConversion } from "./trend-first-blood-conversion";

function match(idx: number, win: boolean, firstBlood: boolean): MatchSummary {
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
    firstBloodKill: firstBlood,
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
        <TrendFirstBloodConversion current={current} previous={[]} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendFirstBloodConversion", () => {
  it("renders the empty copy when fewer than 5 games", () => {
    renderTile([match(0, true, true)]);
    expect(screen.getByText("Need 5+ games to gauge first-blood impact.")).toBeTruthy();
  });

  it("renders the no-FB copy when no match has a first-blood kill", () => {
    const matches = Array.from({ length: 5 }, (_, i) => match(i, true, false));
    renderTile(matches);
    expect(screen.getByText("No first bloods this window across 5 games.")).toBeTruthy();
  });

  it("emits the close-to-overall verdict when FB WR is near overall WR", () => {
    // 10 games, 5 wins → 50% overall. 4 FB games, 2 wins → 50% (delta 0).
    const matches = [
      ...Array.from({ length: 4 }, (_, i) => match(i, i < 2, true)),
      ...Array.from({ length: 6 }, (_, i) => match(i + 4, i < 3, false)),
    ];
    renderTile(matches);
    expect(
      screen.getByText("2/4 first bloods — wins close to your overall rate.")
    ).toBeTruthy();
  });

  it("emits the above-overall verdict when FB WR exceeds overall by 4+pp", () => {
    // 10 games, 4 FB all wins (100%), 6 non-FB all losses (0%) → overall 40%, FB 100% (delta +60pp).
    const matches = [
      ...Array.from({ length: 4 }, (_, i) => match(i, true, true)),
      ...Array.from({ length: 6 }, (_, i) => match(i + 4, false, false)),
    ];
    renderTile(matches);
    expect(
      screen.getByText("4/4 first bloods — 100% WR, 60% above overall.")
    ).toBeTruthy();
  });

  it("emits the below-overall verdict and prescription when FB WR is 8+pp below overall", () => {
    // 10 games, 5 FB all losses (0%), 5 non-FB all wins (100%) → overall 50%, FB 0% (delta -50pp).
    const matches = [
      ...Array.from({ length: 5 }, (_, i) => match(i, false, true)),
      ...Array.from({ length: 5 }, (_, i) => match(i + 5, true, false)),
    ];
    renderTile(matches);
    expect(screen.getByText("0/5 first bloods — 0% WR, 50% below overall.")).toBeTruthy();
    expect(
      screen.getByText("Back off after the kill — don't trade the lead chasing for more.")
    ).toBeTruthy();
  });
});
