import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { ActiveMatchProvider } from "./active-match-context";
import { MatchHero } from "./match-hero";

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("@/lol/champions/champion-card", () => ({
  ChampionCardChrome: ({ champion }: { champion: string }) => (
    <div data-testid="chrome" data-champion={champion} />
  ),
  championCardBaseClassName: "champ-card",
  championCardStyle: () => ({}),
}));

function summary(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: "EUW1_1",
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 5,
    deaths: 2,
    assists: 7,
    win: true,
    durationSec: 1800,
    playedAt: "2026-01-15T18:30:00Z",
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "16.9.1.1",
    visionScore: 20,
    damageShare: 0.25,
    firstBloodKill: false,
    csAt10: 80,
    csAt15: 120,
    goldAt10: 4000,
    goldAt15: 6000,
    teamGoldDiffAt15: 200,
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

function renderHero(s: MatchSummary, lpDelta?: number) {
  return render(
    <MotionConfig reducedMotion="always">
      <ActiveMatchProvider>
        <MatchHero summary={s} {...(lpDelta !== undefined && { lpDelta })} />
      </ActiveMatchProvider>
    </MotionConfig>
  );
}

describe("MatchHero", () => {
  it("renders the champion name, Win badge, and KDA for a winning game", () => {
    renderHero(summary());
    expect(screen.getByText("Ahri")).toBeTruthy();
    expect(screen.getByText("Win")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("renders the Loss badge for a lost game", () => {
    renderHero(summary({ win: false }));
    expect(screen.getByText("Loss")).toBeTruthy();
    expect(screen.queryByText("Win")).toBeNull();
  });

  it("renders the Remake badge and hides the LP delta on remakes", () => {
    renderHero(summary({ remake: true }), 12);
    expect(screen.getByText("Remake")).toBeTruthy();
    expect(screen.queryByText(/LP/)).toBeNull();
  });

  it("renders the LP delta with a + sign when positive", () => {
    const { container } = renderHero(summary(), 15);
    expect(container.textContent).toContain("+15 LP");
  });

  it("renders the LP delta without a synthesized + when negative", () => {
    const { container } = renderHero(summary({ win: false }), -18);
    expect(container.textContent).toContain("-18 LP");
    expect(container.textContent).not.toContain("+");
  });

  it("renders the queue type and a formatted duration in the meta row", () => {
    const { container } = renderHero(summary());
    expect(container.textContent).toContain("Ranked Solo");
    expect(container.textContent).toContain("30m 00s");
  });
});
