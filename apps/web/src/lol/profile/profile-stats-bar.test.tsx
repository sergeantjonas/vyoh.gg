import { useMatchWindow } from "@/lol/matches/match-window-context";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileStatsBar } from "./profile-stats-bar";

vi.mock("@/lol/matches/match-window-context", () => ({
  useMatchWindow: vi.fn(),
}));

type Window = ReturnType<typeof useMatchWindow>;

function mockWindow(value: Window): void {
  vi.mocked(useMatchWindow).mockReturnValue(value);
}

function match(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: "M_1",
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 5,
    deaths: 3,
    assists: 7,
    win: true,
    durationSec: 1800,
    playedAt: "2026-01-01T00:00:00Z",
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

function renderBar() {
  return render(
    <MotionConfig reducedMotion="always">
      <ProfileStatsBar />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useMatchWindow).mockReset();
});

describe("ProfileStatsBar", () => {
  it("renders nothing while the match window is pending", () => {
    mockWindow({
      matches: undefined,
      isPending: true,
      total: 0,
      count: 20,
      setCount: () => {},
    });
    const { container } = renderBar();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when matches is an empty array", () => {
    mockWindow({
      matches: [],
      isPending: false,
      total: 0,
      count: 20,
      setCount: () => {},
    });
    const { container } = renderBar();
    expect(container.firstChild).toBeNull();
  });

  it("renders the five stat tiles with computed values when matches are present", () => {
    // 4 wins / 4 games → 100% WR. Unique champions: 2 (Ahri, Yasuo).
    const matches = [
      match({ matchId: "M_1", champion: "Ahri", win: true }),
      match({ matchId: "M_2", champion: "Ahri", win: true }),
      match({ matchId: "M_3", champion: "Yasuo", win: true }),
      match({ matchId: "M_4", champion: "Yasuo", win: true }),
    ];
    mockWindow({
      matches,
      isPending: false,
      total: 4,
      count: 20,
      setCount: () => {},
    });
    const { container } = renderBar();
    expect(screen.getByText("Games")).toBeTruthy();
    expect(screen.getByText("Win Rate")).toBeTruthy();
    expect(screen.getByText("KDA")).toBeTruthy();
    expect(screen.getByText("Champs")).toBeTruthy();
    expect(screen.getByText("Time Played")).toBeTruthy();
    expect(container.textContent).toContain("4");
    expect(container.textContent).toContain("100");
    expect(container.textContent).toContain("2");
  });

  it("renders the playtime in hours when total duration >= 1 hour", () => {
    // 4 games × 1800s = 7200s = 2 hours.
    const matches = Array.from({ length: 4 }, (_, i) =>
      match({ matchId: `M_${i}`, durationSec: 1800 })
    );
    mockWindow({
      matches,
      isPending: false,
      total: 4,
      count: 20,
      setCount: () => {},
    });
    const { container } = renderBar();
    expect(container.textContent).toMatch(/2\.0h/);
  });

  it("renders the playtime in minutes when total duration < 1 hour", () => {
    // 1 game × 1800s = 30 minutes total.
    const matches = [match({ durationSec: 1800 })];
    mockWindow({
      matches,
      isPending: false,
      total: 1,
      count: 20,
      setCount: () => {},
    });
    const { container } = renderBar();
    expect(container.textContent).toMatch(/30m/);
    expect(container.textContent).not.toMatch(/\dh/);
  });
});
