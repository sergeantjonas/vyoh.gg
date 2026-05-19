import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { TrendWorstMatchup } from "./trend-worst-matchup";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...(props as Record<string, unknown>)}>{children}</a>
  ),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ championName }: { championName: string }) => (
    <span data-champion={championName} />
  ),
}));

function match(
  idx: number,
  win: boolean,
  champion: string,
  opp: string | null
): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueType: "Ranked Solo",
    champion,
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
        <TrendWorstMatchup current={current} previous={[]} accountSlug="me-euw" />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendWorstMatchup", () => {
  it("renders the empty copy when no matches have lane opponents", () => {
    renderTile([match(0, true, "Ahri", null), match(1, false, "Ahri", null)]);
    expect(screen.getByText("Need Summoner's Rift games for matchup data.")).toBeTruthy();
  });

  it("renders the no-losing-matchups copy when no pair meets minimum sample", () => {
    // 2 games vs Zed (below 3-min sample).
    const matches = [match(0, false, "Ahri", "Zed"), match(1, false, "Ahri", "Zed")];
    renderTile(matches);
    expect(
      screen.getByText("No losing matchups with 3+ games in this window.")
    ).toBeTruthy();
  });

  it("emits the worst-matchup verdict with W-L count and champion names", () => {
    // 3 games vs Zed, 0 wins, 3 losses → 0% WR (below ban threshold).
    const matches = [
      match(0, false, "Ahri", "Zed"),
      match(1, false, "Ahri", "Zed"),
      match(2, false, "Ahri", "Zed"),
    ];
    renderTile(matches);
    expect(screen.getByText("0–3 on Ahri into Zed.")).toBeTruthy();
    expect(screen.getByText("Consider banning Zed.")).toBeTruthy();
  });

  it("omits the ban prescription when WR is above the ban threshold", () => {
    // 3 games vs Zed, 1 win, 2 losses → 33% WR (above 25% threshold).
    const matches = [
      match(0, true, "Ahri", "Zed"),
      match(1, false, "Ahri", "Zed"),
      match(2, false, "Ahri", "Zed"),
    ];
    renderTile(matches);
    expect(screen.getByText("1–2 on Ahri into Zed.")).toBeTruthy();
    expect(screen.queryByText("Consider banning Zed.")).toBeNull();
  });

  it("excludes remakes from the sample size", () => {
    const remakeMatch = match(0, false, "Ahri", "Zed");
    remakeMatch.remake = true;
    renderTile([remakeMatch]);
    expect(screen.getByText("Need Summoner's Rift games for matchup data.")).toBeTruthy();
  });
});
