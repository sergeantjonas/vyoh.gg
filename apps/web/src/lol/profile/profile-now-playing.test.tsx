import { useMatchWindow } from "@/lol/matches/match-window-context";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileNowPlaying } from "./profile-now-playing";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a {...(props as Record<string, string>)}>{children}</a>
  ),
}));

vi.mock("@/lol/matches/match-window-context", () => ({
  useMatchWindow: vi.fn(),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ championName }: { championName: string }) => (
    <img alt={championName} data-champion={championName} />
  ),
}));

type Window = ReturnType<typeof useMatchWindow>;

function mockWindow(matches: MatchSummary[] | undefined): void {
  vi.mocked(useMatchWindow).mockReturnValue({
    matches,
    isPending: false,
    total: matches?.length ?? 0,
    count: 20,
    setCount: () => {},
  } as Window);
}

function match(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: "M_1",
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 5,
    deaths: 2,
    assists: 7,
    win: true,
    durationSec: 1800,
    playedAt: new Date().toISOString(),
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

function renderNowPlaying() {
  return render(
    <MotionConfig reducedMotion="always">
      <ProfileNowPlaying accountSlug="jonas-euw" />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useMatchWindow).mockReset();
});

describe("ProfileNowPlaying", () => {
  it("renders nothing when matches is undefined", () => {
    mockWindow(undefined);
    const { container } = renderNowPlaying();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no matches fall inside the 7-day window", () => {
    // 30 days ago — outside the 7-day cutoff.
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    mockWindow([match({ playedAt: old })]);
    const { container } = renderNowPlaying();
    expect(container.firstChild).toBeNull();
  });

  it("renders the heading and the top 3 champions sorted by games", () => {
    const recent = new Date().toISOString();
    const matches: MatchSummary[] = [
      match({ matchId: "1", champion: "Ahri", playedAt: recent }),
      match({ matchId: "2", champion: "Ahri", playedAt: recent }),
      match({ matchId: "3", champion: "Ahri", playedAt: recent }),
      match({ matchId: "4", champion: "Yasuo", playedAt: recent }),
      match({ matchId: "5", champion: "Yasuo", playedAt: recent }),
      match({ matchId: "6", champion: "Lux", playedAt: recent }),
      match({ matchId: "7", champion: "Sett", playedAt: recent }),
    ];
    mockWindow(matches);
    renderNowPlaying();
    expect(screen.getByText(/Now Playing · last 7 days/)).toBeTruthy();
    expect(screen.getByText("Ahri")).toBeTruthy();
    expect(screen.getByText("Yasuo")).toBeTruthy();
    expect(screen.getByText("Lux")).toBeTruthy();
    // 4th champion (Sett) is past MAX_CHAMPS = 3.
    expect(screen.queryByText("Sett")).toBeNull();
  });

  it("uses singular 'game' for a single-game champion and plural otherwise", () => {
    const recent = new Date().toISOString();
    const matches: MatchSummary[] = [
      match({ matchId: "1", champion: "Ahri", playedAt: recent }),
      match({ matchId: "2", champion: "Ahri", playedAt: recent }),
      match({ matchId: "3", champion: "Yasuo", playedAt: recent }),
    ];
    mockWindow(matches);
    const { container } = renderNowPlaying();
    expect(container.textContent).toContain("2 games");
    expect(container.textContent).toContain("1 game ·");
  });
});
