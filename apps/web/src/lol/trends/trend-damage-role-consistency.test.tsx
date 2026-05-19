import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendDamageRoleConsistency } from "./trend-damage-role-consistency";

function match(idx: number, position: string, damageShare: number): MatchSummary {
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
    damageShare,
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
        <TrendDamageRoleConsistency current={current} previous={[]} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendDamageRoleConsistency", () => {
  it("renders the empty copy when no role has 5+ games", () => {
    renderTile([match(0, "MIDDLE", 0.3), match(1, "TOP", 0.25)]);
    expect(
      screen.getByText("Need 5+ Rift games on a role to gauge damage consistency.")
    ).toBeTruthy();
  });

  it("emits the at-floor verdict when avg damage share matches the role baseline", () => {
    // Mid baseline is 0.28 → 5 games at 0.28 → delta 0.
    const matches = Array.from({ length: 5 }, (_, i) => match(i, "MIDDLE", 0.28));
    renderTile(matches);
    expect(
      screen.getByText(
        "Damage share on Middle averages 28% — right at the role's typical floor."
      )
    ).toBeTruthy();
  });

  it("emits the above-floor verdict when avg damage share is 3+pp above baseline", () => {
    // Mid baseline 0.28 → 5 games at 0.40 → delta +12pp.
    const matches = Array.from({ length: 5 }, (_, i) => match(i, "MIDDLE", 0.4));
    renderTile(matches);
    expect(
      screen.getByText(
        "Damage share on Middle averages 40% — 12% above the typical role floor."
      )
    ).toBeTruthy();
  });

  it("emits the below-floor verdict and positioning prescription when 5+pp below baseline", () => {
    // Mid baseline 0.28 → 5 games at 0.15 → delta -13pp ≤ -5.
    const matches = Array.from({ length: 5 }, (_, i) => match(i, "MIDDLE", 0.15));
    renderTile(matches);
    expect(
      screen.getByText(
        "Damage share on Middle averages 15% — 13% below the typical role floor."
      )
    ).toBeTruthy();
    expect(
      screen.getByText("Work on positioning to deal more damage in fights.")
    ).toBeTruthy();
  });
});
