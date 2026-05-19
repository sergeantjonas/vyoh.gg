import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { TrendChampionFocus } from "./trend-champion-focus";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a {...(props as Record<string, string>)}>{children}</a>
  ),
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ championName }: { championName: string }) => (
    <span data-champion={championName} />
  ),
}));

function match(champion: string, idx: number, win = true): MatchSummary {
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
    laneOpponent: null,
  };
}

function renderFocus(current: MatchSummary[]) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <TrendChampionFocus current={current} previous={[]} accountSlug="jonas-euw" />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendChampionFocus", () => {
  it("renders nothing when there are no played games", () => {
    const { container } = renderFocus([]);
    expect(container.firstChild).toBeNull();
  });

  it("emits 'tight pool' label and verdict when 3 or fewer unique champions are played", () => {
    const matches = [
      match("Ahri", 0),
      match("Ahri", 1),
      match("Yasuo", 2),
      match("Lux", 3),
    ];
    renderFocus(matches);
    expect(screen.getByText(/3 unique champions — tight pool/)).toBeTruthy();
    expect(screen.getByText(/Top 3: Ahri, Yasuo, Lux \(4 of 4 games\)/)).toBeTruthy();
  });

  it("emits 'focused pool' label when uniques/total ratio is below 0.25", () => {
    // 10 games across 4 champions where Ahri dominates → 4/10 = 0.4 (not "focused").
    // Use 20 games / 4 unique = 0.2 ratio → "focused pool".
    const matches: MatchSummary[] = [];
    for (let i = 0; i < 14; i++) matches.push(match("Ahri", i));
    matches.push(match("Yasuo", 15));
    matches.push(match("Yasuo", 16));
    matches.push(match("Yasuo", 17));
    matches.push(match("Lux", 18));
    matches.push(match("Lux", 19));
    matches.push(match("Sett", 20));
    renderFocus(matches);
    expect(screen.getByText(/4 unique champions — focused pool/)).toBeTruthy();
  });

  it("renders the wide-pool prescription when uniques ≥ 10 and top-3 share < 50%", () => {
    // 11 unique champions, all with 2 games each → top-3 share = 6/22 ≈ 27%.
    const matches: MatchSummary[] = [];
    const names = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
    let idx = 0;
    for (const n of names) {
      matches.push(match(n, idx++));
      matches.push(match(n, idx++));
    }
    renderFocus(matches);
    expect(
      screen.getByText("Wide pool — consider focusing on 3 to climb faster.")
    ).toBeTruthy();
  });

  it("renders an 'others' summary line when more champions exist than the display count", () => {
    // 7 champions with one game each. DISPLAY_COUNT = 6 → "+1 other".
    const matches = ["A", "B", "C", "D", "E", "F", "G"].map((n, i) => match(n, i));
    renderFocus(matches);
    expect(screen.getByText("+1 other")).toBeTruthy();
  });

  it("excludes remakes from the unique/total counts", () => {
    const matches = [
      match("Ahri", 0),
      match("Yasuo", 1),
      { ...match("Lux", 2), remake: true },
    ];
    renderFocus(matches);
    expect(screen.getByText(/2 unique champions/)).toBeTruthy();
  });
});
