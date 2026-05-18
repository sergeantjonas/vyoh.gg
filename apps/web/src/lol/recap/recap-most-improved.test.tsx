import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { RecapMostImproved } from "./recap-most-improved";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ championName, alt }: { championName: string; alt: string }) => (
    <img alt={alt} data-champion={championName} />
  ),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

function match(
  index: number,
  champion: string,
  win: boolean,
  overrides: Partial<MatchSummary> = {}
): MatchSummary {
  return {
    matchId: `M_${index}`,
    queueType: "Ranked Solo",
    champion,
    kills: 0,
    deaths: 0,
    assists: 0,
    win,
    durationSec: 1800,
    playedAt: new Date(2026, 0, 1 + index).toISOString(),
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
    ...overrides,
  };
}

function renderImproved(matches: MatchSummary[] | undefined) {
  return render(
    <MotionConfig reducedMotion="always">
      <RecapMostImproved matches={matches} accountSlug="jonas-euw" />
    </MotionConfig>
  );
}

describe("RecapMostImproved", () => {
  it("renders the empty placeholder when there aren't enough games for two halves", () => {
    // MIN_GAMES_PER_HALF * 2 = 8. 6 games can't form two halves of 4.
    const matches = Array.from({ length: 6 }, (_, i) => match(i, "Ahri", true));
    renderImproved(matches);
    expect(
      screen.getByText(/Once a champion in your pool gains traction late in the window/)
    ).toBeTruthy();
  });

  it("renders the empty placeholder when no champion has 4+ games in BOTH halves", () => {
    // 8 games: 4 Ahri early (3W 1L = 75%), 4 Yasuo late (4W = 100%) — no champion crosses
    // both halves, so no improvement candidate.
    const matches = [
      match(1, "Ahri", true),
      match(2, "Ahri", true),
      match(3, "Ahri", true),
      match(4, "Ahri", false),
      match(5, "Yasuo", true),
      match(6, "Yasuo", true),
      match(7, "Yasuo", true),
      match(8, "Yasuo", true),
    ];
    renderImproved(matches);
    expect(
      screen.getByText(/Once a champion in your pool gains traction late in the window/)
    ).toBeTruthy();
  });

  it("picks the champion with the biggest positive WR delta across halves", () => {
    // 8 games, Ahri only. Early 4 = all losses (0%). Late 4 = all wins (100%). Δ +100pp.
    const matches = [
      match(1, "Ahri", false),
      match(2, "Ahri", false),
      match(3, "Ahri", false),
      match(4, "Ahri", false),
      match(5, "Ahri", true),
      match(6, "Ahri", true),
      match(7, "Ahri", true),
      match(8, "Ahri", true),
    ];
    renderImproved(matches);
    expect(screen.getAllByText("Ahri").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/0% → 100% win rate · \+100% in the recent half/)
    ).toBeTruthy();
  });

  it("rejects candidates whose recent half is flat or worse than the early half", () => {
    // Ahri early 4W (100%), late 4L (0%). Δ = -100pp → not surfaced.
    const matches = [
      match(1, "Ahri", true),
      match(2, "Ahri", true),
      match(3, "Ahri", true),
      match(4, "Ahri", true),
      match(5, "Ahri", false),
      match(6, "Ahri", false),
      match(7, "Ahri", false),
      match(8, "Ahri", false),
    ];
    renderImproved(matches);
    expect(
      screen.getByText(/Once a champion in your pool gains traction late in the window/)
    ).toBeTruthy();
  });
});
