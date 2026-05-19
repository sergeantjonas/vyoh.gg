import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { MatchPips } from "./match-pips";

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

function renderPips(matches: MatchSummary[], onMatchClick?: (m: MatchSummary) => void) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <MatchPips
          matches={matches}
          renderTooltip={(m) => <span>tip-{m.matchId}</span>}
          {...(onMatchClick && { onMatchClick })}
        />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("MatchPips", () => {
  it("renders one button per match", () => {
    renderPips([match(0, true), match(1, false), match(2, true)]);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("renders cursor-pointer when onMatchClick is provided", () => {
    renderPips([match(0, true)], () => {});
    const btn = screen.getAllByRole("button")[0];
    expect(btn?.className).toContain("cursor-pointer");
  });

  it("renders cursor-default when onMatchClick is not provided", () => {
    renderPips([match(0, true)]);
    const btn = screen.getAllByRole("button")[0];
    expect(btn?.className).toContain("cursor-default");
  });

  it("invokes onMatchClick with the matched summary on click", () => {
    const onClick = vi.fn();
    const m = match(7, true);
    renderPips([m], onClick);
    fireEvent.click(screen.getAllByRole("button")[0] as HTMLElement);
    expect(onClick).toHaveBeenCalledWith(m);
  });
});
