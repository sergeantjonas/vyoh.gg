import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { TrendRolePerformance } from "./trend-role-performance";

vi.mock("@/lol/_shared/assets/role-icon", async (original) => {
  const actual = (await original()) as Record<string, unknown>;
  return {
    ...actual,
    RoleIcon: ({ position }: { position: string }) => <span data-role={position} />,
  };
});

function match(idx: number, win: boolean, position: string | null): MatchSummary {
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
    teamPosition: position ?? "",
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
        <TrendRolePerformance current={current} previous={[]} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendRolePerformance", () => {
  it("renders the not-enough-games copy when no positioned matches exist", () => {
    renderTile([]);
    expect(screen.getByText("Not enough games yet.")).toBeTruthy();
  });

  it("renders the ARAM copy when all positioned matches are positionless", () => {
    const matches = Array.from({ length: 4 }, (_, i) => match(i, true, null));
    renderTile(matches);
    expect(
      screen.getByText(
        "ARAM and Arena games don't carry role data — play a Rift game to see this."
      )
    ).toBeTruthy();
  });

  it("emits the strongest-role verdict when a role has 3+ games", () => {
    const matches = [
      match(0, true, "MIDDLE"),
      match(1, true, "MIDDLE"),
      match(2, true, "MIDDLE"),
      match(3, false, "TOP"),
      match(4, false, "TOP"),
    ];
    renderTile(matches);
    expect(screen.getByText("Strongest on Mid — 100% over 3 games.")).toBeTruthy();
  });

  it("emits the climb-prescription when WR gap between top and bottom role exceeds 15pp", () => {
    // 5 Mid wins (100% WR) + 5 Top losses (0%) → gap = 100pp ≥ 15.
    const matches = [
      ...Array.from({ length: 5 }, (_, i) => match(i, true, "MIDDLE")),
      ...Array.from({ length: 5 }, (_, i) => match(i + 5, false, "TOP")),
    ];
    renderTile(matches);
    expect(screen.getByText("Consider climbing on Mid.")).toBeTruthy();
  });

  it("tags the verdict as ARAM-heavy when positionless ratio exceeds the threshold", () => {
    // 9 ARAM + 3 Mid = positionless ratio 9/12 = 75% > 70% threshold.
    const matches = [
      ...Array.from({ length: 9 }, (_, i) => match(i, true, null)),
      match(9, true, "MIDDLE"),
      match(10, true, "MIDDLE"),
      match(11, true, "MIDDLE"),
    ];
    renderTile(matches);
    expect(
      screen.getByText(
        /Strongest Rift role is Mid — 100% over 3 games \(mostly ARAM otherwise\)\./
      )
    ).toBeTruthy();
  });
});
