import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { TrendKda } from "./trend-kda";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
}));

function match(idx: number, k: number, d: number, a: number): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: k,
    deaths: d,
    assists: a,
    win: true,
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

function renderTile(current: MatchSummary[], previous: MatchSummary[] = []) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <TrendKda current={current} previous={previous} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendKda", () => {
  it("renders the empty placeholder when there's no match data", () => {
    renderTile([]);
    expect(screen.getByText("No match data yet.")).toBeTruthy();
  });

  it("renders the avg-KDA verdict when there's no previous window to compare against", () => {
    // Aggregate KDA = (sumK + sumA) / sumD. K=10, D=4, A=10 → (10+10)/4 = 5.0.
    renderTile([match(0, 5, 2, 5), match(1, 5, 2, 5)]);
    expect(screen.getByText("Avg KDA: 5.00 over 2 games.")).toBeTruthy();
  });

  it("uses the singular 'game' when there's exactly 1 match in the window", () => {
    renderTile([match(0, 3, 1, 2)]);
    expect(screen.getByText("Avg KDA: 5.00 over 1 game.")).toBeTruthy();
  });

  it("emits the up-vs-prior verdict when current avg KDA exceeds previous", () => {
    const current = [match(0, 5, 1, 5)]; // KDA = 10
    const previous = [match(0, 2, 1, 0)]; // KDA = 2
    renderTile(current, previous);
    expect(screen.getByText("KDA up 8.00 vs prior window — improving.")).toBeTruthy();
  });

  it("emits the down-vs-prior verdict when current avg KDA is lower than previous", () => {
    const current = [match(0, 1, 1, 1)]; // KDA = 2
    const previous = [match(0, 5, 1, 5)]; // KDA = 10
    renderTile(current, previous);
    expect(screen.getByText("KDA down 8.00 vs prior window.")).toBeTruthy();
  });
});
