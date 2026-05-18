import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { RecapSignatureGame } from "./recap-signature-game";

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

function match(overrides: Partial<MatchSummary>): MatchSummary {
  return {
    matchId: overrides.matchId ?? "M_1",
    queueType: "Ranked Solo",
    champion: overrides.champion ?? "Ahri",
    kills: overrides.kills ?? 0,
    deaths: overrides.deaths ?? 0,
    assists: overrides.assists ?? 0,
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
    teamGoldDiffAt15: overrides.teamGoldDiffAt15 ?? 0,
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

function renderSignature(matches: MatchSummary[] | undefined) {
  return render(
    <MotionConfig reducedMotion="always">
      <RecapSignatureGame matches={matches} accountSlug="jonas-euw" />
    </MotionConfig>
  );
}

describe("RecapSignatureGame", () => {
  it("renders the empty placeholder when matches is undefined", () => {
    renderSignature(undefined);
    expect(
      screen.getByText(/Once you've played a few more games, the standout performance/)
    ).toBeTruthy();
  });

  it("renders the empty placeholder when every match is a remake", () => {
    renderSignature([match({ remake: true })]);
    expect(
      screen.getByText(/Once you've played a few more games, the standout performance/)
    ).toBeTruthy();
  });

  it("picks the highest-scored win and labels it 'Standout win' with KDA", () => {
    const matches = [
      match({
        matchId: "win-high-kda",
        champion: "Ahri",
        win: true,
        kills: 10,
        deaths: 2,
        assists: 8,
      }),
      match({
        matchId: "loss",
        champion: "Yasuo",
        win: false,
        kills: 12,
        deaths: 3,
        assists: 6,
      }),
    ];
    renderSignature(matches);
    expect(screen.getByText("Standout win on Ahri")).toBeTruthy();
    // KDA (10+8)/2 = 9.00
    expect(screen.getByText(/10\/2\/8 · KDA 9\.00/)).toBeTruthy();
  });

  it("labels deep-deficit wins as 'Comeback win' (teamGoldDiffAt15 ≤ -3000)", () => {
    renderSignature([
      match({
        matchId: "comeback",
        champion: "Ahri",
        win: true,
        kills: 4,
        deaths: 2,
        assists: 6,
        teamGoldDiffAt15: -4000,
      }),
    ]);
    expect(screen.getByText("Comeback win on Ahri")).toBeTruthy();
  });

  it("labels losses as 'Carry performance' rather than win copy", () => {
    renderSignature([
      match({
        matchId: "loss-only",
        champion: "Ahri",
        win: false,
        kills: 6,
        deaths: 4,
        assists: 12,
      }),
    ]);
    expect(screen.getByText("Carry performance on Ahri")).toBeTruthy();
  });

  it("renders 'perfect' KDA suffix when deaths is 0", () => {
    renderSignature([
      match({
        matchId: "perfect",
        champion: "Ahri",
        win: true,
        kills: 6,
        deaths: 0,
        assists: 4,
      }),
    ]);
    // kdaValue = 6 + 4 = 10 → "10 (perfect)"
    expect(screen.getByText(/6\/0\/4 · KDA 10 \(perfect\)/)).toBeTruthy();
  });
});
