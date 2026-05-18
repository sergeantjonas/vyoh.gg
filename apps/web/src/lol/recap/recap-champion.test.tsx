import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { RecapChampion } from "./recap-champion";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ championName, alt }: { championName: string; alt: string }) => (
    <img alt={alt} data-champion={championName} />
  ),
}));

vi.mock("@/lol/_shared/patch/use-ddragon-version", () => ({
  useDDragonVersion: () => "26.9",
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

function match(overrides: Partial<MatchSummary>): MatchSummary {
  return {
    matchId: overrides.matchId ?? "M_1",
    queueType: "Ranked Solo",
    champion: overrides.champion ?? "Ahri",
    kills: overrides.kills ?? 5,
    deaths: overrides.deaths ?? 3,
    assists: overrides.assists ?? 7,
    win: overrides.win ?? true,
    durationSec: 1800,
    playedAt: overrides.playedAt ?? "2026-05-19T12:00:00.000Z",
    remake: overrides.remake ?? false,
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

function renderChampion(matches: MatchSummary[] | undefined) {
  return render(
    <MotionConfig reducedMotion="always">
      <RecapChampion matches={matches} accountSlug="jonas-euw" />
    </MotionConfig>
  );
}

describe("RecapChampion", () => {
  it("renders the empty placeholder when matches is undefined", () => {
    renderChampion(undefined);
    expect(
      screen.getByText(/Play a few games and your headline champion will appear here/)
    ).toBeTruthy();
  });

  it("renders the empty placeholder when every match is a remake", () => {
    renderChampion([match({ remake: true })]);
    expect(
      screen.getByText(/Play a few games and your headline champion will appear here/)
    ).toBeTruthy();
  });

  it("aggregates by champion and surfaces the most-played one with WR and KDA", () => {
    // Ahri: 3 games, 2 wins, K/D/A summed 15/6/15 → KDA (15+15)/6 = 5.00
    // Yasuo: 2 games — fewer, so Ahri wins.
    const matches = [
      match({
        matchId: "1",
        champion: "Ahri",
        win: true,
        kills: 5,
        deaths: 2,
        assists: 5,
      }),
      match({
        matchId: "2",
        champion: "Ahri",
        win: true,
        kills: 5,
        deaths: 2,
        assists: 5,
      }),
      match({
        matchId: "3",
        champion: "Ahri",
        win: false,
        kills: 5,
        deaths: 2,
        assists: 5,
      }),
      match({
        matchId: "4",
        champion: "Yasuo",
        win: true,
        kills: 1,
        deaths: 1,
        assists: 1,
      }),
      match({
        matchId: "5",
        champion: "Yasuo",
        win: true,
        kills: 1,
        deaths: 1,
        assists: 1,
      }),
    ];
    renderChampion(matches);
    expect(screen.getAllByText("Ahri").length).toBeGreaterThan(0);
    expect(screen.getByText("67%")).toBeTruthy();
    expect(screen.getByText("5.00")).toBeTruthy();
    expect(screen.queryByText("Yasuo")).toBeNull();
  });

  it("formats KDA with one decimal when deaths is 0 (perfect)", () => {
    const matches = [
      match({
        matchId: "1",
        champion: "Ahri",
        win: true,
        kills: 5,
        deaths: 0,
        assists: 3,
      }),
    ];
    renderChampion(matches);
    // (5 + 3) → "8.0"
    expect(screen.getByText("8.0")).toBeTruthy();
  });

  it("excludes remakes from the aggregation", () => {
    const matches = [
      match({ matchId: "1", champion: "Yasuo", remake: true }),
      match({ matchId: "2", champion: "Yasuo", remake: true }),
      match({ matchId: "3", champion: "Ahri" }),
    ];
    renderChampion(matches);
    expect(screen.getAllByText("Ahri").length).toBeGreaterThan(0);
    expect(screen.queryByText("Yasuo")).toBeNull();
  });
});
