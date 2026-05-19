import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useNavigate } from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchRecord } from "./match-record";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: vi.fn(),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

function match(idx: number, win: boolean): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 5,
    deaths: 2,
    assists: 3,
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

afterEach(() => {
  vi.mocked(useNavigate).mockReset();
});

describe("MatchRecord", () => {
  it("renders one pip button per match", () => {
    vi.mocked(useNavigate).mockReturnValue(vi.fn());
    render(
      <MotionConfig reducedMotion="always">
        <TooltipPrimitive.Provider>
          <MatchRecord matches={[match(0, true), match(1, false)]} accountSlug="me-euw" />
        </TooltipPrimitive.Provider>
      </MotionConfig>
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("navigates to the match detail route on pip click", () => {
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    render(
      <MotionConfig reducedMotion="always">
        <TooltipPrimitive.Provider>
          <MatchRecord matches={[match(7, true)]} accountSlug="me-euw" />
        </TooltipPrimitive.Provider>
      </MotionConfig>
    );
    fireEvent.click(screen.getAllByRole("button")[0] as HTMLElement);
    expect(navigate).toHaveBeenCalledWith({
      to: "/lol/$accountSlug/matches/$matchId",
      params: { accountSlug: "me-euw", matchId: "M_7" },
    });
  });
});
