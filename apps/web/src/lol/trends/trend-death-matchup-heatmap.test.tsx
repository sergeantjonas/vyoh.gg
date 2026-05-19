import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { TrendDeathMatchupHeatmap } from "./trend-death-matchup-heatmap";

vi.mock("@/lol/_shared/patch/use-ddragon-version", () => ({
  useDDragonVersion: () => "16.9.1",
}));

vi.mock("@visx/group", () => ({
  Group: ({ children }: { children: React.ReactNode }) => <g>{children}</g>,
}));

vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
  }) => <div>{children({ width: 400, height: 300 })}</div>,
}));

vi.mock("@visx/scale", () => ({
  scaleBand: () => {
    const fn = (() => 0) as unknown as {
      bandwidth: () => number;
      (input: unknown): number;
    };
    fn.bandwidth = () => 40;
    return fn;
  },
  scaleLinear: () => () => "rgba(0,0,0,0.5)",
}));

function match(
  idx: number,
  opp: string | null,
  opts: { csAt10?: number; deathTimings?: number[] } = {}
): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: opts.deathTimings?.length ?? 0,
    assists: 0,
    win: true,
    durationSec: 1800,
    playedAt: new Date(Date.UTC(2026, 0, idx + 1)).toISOString(),
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "16.9.1.1",
    visionScore: 0,
    damageShare: 0,
    firstBloodKill: false,
    csAt10: opts.csAt10 ?? 80,
    csAt15: 0,
    goldAt10: 0,
    goldAt15: 0,
    teamGoldDiffAt15: 0,
    deathTimings: opts.deathTimings ?? [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: opp
      ? {
          championName: opp,
          puuid: `OPP_${idx}`,
          gameName: "Opp",
          tagLine: "EUW",
        }
      : null,
  };
}

function renderTile(current: MatchSummary[]) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <TrendDeathMatchupHeatmap current={current} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendDeathMatchupHeatmap", () => {
  it("renders the empty copy when fewer than 5 projected matches", () => {
    renderTile([match(0, "Zed"), match(1, "Yasuo"), match(2, "Lux")]);
    expect(
      screen.getByText(
        "Need 5+ matches with timeline data and at least 3 distinct lane opponents."
      )
    ).toBeTruthy();
  });

  it("renders the empty copy when fewer than 3 distinct opponents", () => {
    const matches = Array.from({ length: 6 }, (_, i) =>
      match(i, i < 3 ? "Zed" : "Yasuo", { deathTimings: [120] })
    );
    renderTile(matches);
    expect(
      screen.getByText(
        "Need 5+ matches with timeline data and at least 3 distinct lane opponents."
      )
    ).toBeTruthy();
  });

  it("emits the hardest-matchup verdict when an opponent has 4+ deaths", () => {
    // 5 matches with 3 different opponents; Zed has 5 deaths across 2 games clustered at 5–10 min.
    const matches = [
      match(0, "Zed", { deathTimings: [330, 360, 390] }),
      match(1, "Zed", { deathTimings: [420, 450] }),
      match(2, "Yasuo", { deathTimings: [60] }),
      match(3, "Lux", { deathTimings: [60] }),
      match(4, "Lux", { deathTimings: [60] }),
    ];
    renderTile(matches);
    expect(
      screen.getByText(
        "Hardest matchup: Zed — 5 deaths across 2 games, clustered around minutes 5–10."
      )
    ).toBeTruthy();
  });

  it("emits the spread-evenly verdict when no opponent has 4+ deaths", () => {
    // 5 matches with 3 opponents, each row has ≤3 deaths.
    const matches = [
      match(0, "Zed", { deathTimings: [60] }),
      match(1, "Yasuo", { deathTimings: [60] }),
      match(2, "Lux", { deathTimings: [60] }),
      match(3, "Lux", { deathTimings: [60] }),
      match(4, "Lux", { deathTimings: [60] }),
    ];
    renderTile(matches);
    expect(
      screen.getByText(
        "Deaths spread evenly across your matchups — no single opponent dominates the heatmap."
      )
    ).toBeTruthy();
  });
});
