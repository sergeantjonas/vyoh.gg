import { useSeriousMatches } from "@/lol/_shared/serious-queues/serious-queues";
import { useNewMatchNotice } from "@/lol/profile/use-new-match-notice";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfilePostGame } from "./profile-post-game";

vi.mock("@/lol/_shared/serious-queues/serious-queues", () => ({
  useSeriousMatches: vi.fn(),
}));

vi.mock("@/lol/profile/use-new-match-notice", () => ({
  useNewMatchNotice: vi.fn(),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...(props as Record<string, unknown>)}>{children}</a>
  ),
}));

const DAY_MS = 24 * 60 * 60 * 1000;

function fakeMatch(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: `M${Math.random()}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 5,
    deaths: 4,
    assists: 8,
    win: true,
    durationSec: 1800,
    playedAt: new Date(Date.now() - DAY_MS).toISOString(),
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "14.20.586.5840",
    visionScore: 20,
    damageShare: 0.25,
    firstBloodKill: false,
    csAt10: 70,
    csAt15: 110,
    goldAt10: 4000,
    goldAt15: 6000,
    teamGoldDiffAt15: 0,
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
    ...overrides,
  } as unknown as MatchSummary;
}

function setMatches(matches: MatchSummary[] | undefined, isFresh = false) {
  vi.mocked(useSeriousMatches).mockReturnValue({
    matches,
    isPending: false,
  } as unknown as ReturnType<typeof useSeriousMatches>);
  vi.mocked(useNewMatchNotice).mockReturnValue(isFresh);
}

function renderShell() {
  return render(
    <MotionConfig reducedMotion="always">
      <ProfilePostGame accountSlug="ahri" />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useSeriousMatches).mockReset();
  vi.mocked(useNewMatchNotice).mockReset();
});

describe("ProfilePostGame", () => {
  it("renders null when matches are undefined", () => {
    setMatches(undefined);
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders null when matches are empty", () => {
    setMatches([]);
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders null when all matches are remakes", () => {
    setMatches([fakeMatch({ remake: true })]);
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders all four post-game signal tiles after a non-remake last match", () => {
    setMatches([fakeMatch({ csAt15: 0, goldAt15: 0 })]);
    renderShell();
    expect(screen.getByText("Post-game")).toBeTruthy();
    expect(screen.getByText("Last game")).toBeTruthy();
    expect(screen.getByText("Performance")).toBeTruthy();
    expect(screen.getByText("Next game")).toBeTruthy();
    // No game-shape signal when timeline data missing → falls back to champion read.
    expect(screen.getByText("Champion read")).toBeTruthy();
  });

  it("reports a 3-game win streak verdict when consecutive recent wins exist", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({ win: true, playedAt: new Date(now - 1 * DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 3 * DAY_MS).toISOString() }),
    ]);
    renderShell();
    expect(screen.getByText(/3-game win streak now\./)).toBeTruthy();
  });

  it("reports the 'broke a run' verdict when the latest game ends a prior streak", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({ win: true, playedAt: new Date(now - 1 * DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 3 * DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 4 * DAY_MS).toISOString() }),
    ]);
    renderShell();
    expect(screen.getByText(/broke a 3-game loss run\./)).toBeTruthy();
  });

  it("renders a Game shape tile (replacing Champion read) when timeline data is present", () => {
    setMatches([
      fakeMatch({ goldAt15: 6000, csAt15: 110, teamGoldDiffAt15: 0, win: true }),
    ]);
    renderShell();
    expect(screen.getByText("Game shape")).toBeTruthy();
    expect(screen.queryByText("Champion read")).toBeNull();
  });

  it("renders the 'led at 15 — converted' verdict when ahead at 15 and won", () => {
    setMatches([
      fakeMatch({ goldAt15: 7000, csAt15: 110, teamGoldDiffAt15: 3000, win: true }),
    ]);
    renderShell();
    expect(screen.getByText(/Led 3\.0k at 15/)).toBeTruthy();
  });

  it("renders the 'let it slip' verdict when ahead at 15 but lost", () => {
    setMatches([
      fakeMatch({ goldAt15: 7000, csAt15: 110, teamGoldDiffAt15: 3000, win: false }),
    ]);
    renderShell();
    expect(screen.getByText(/Up 3\.0k at 15 — let it slip\./)).toBeTruthy();
  });

  it("renders a 'No role baseline' performance verdict when last.teamPosition is invalid", () => {
    setMatches([
      fakeMatch({ teamPosition: "" as unknown as MatchSummary["teamPosition"] }),
    ]);
    renderShell();
    expect(screen.getByText(/No role baseline for this queue\./)).toBeTruthy();
  });

  it("renders the 'need more games' tilt verdict when history has fewer than 8 matches", () => {
    setMatches([fakeMatch()]);
    renderShell();
    expect(screen.getByText(/Need more games to read tilt patterns\./)).toBeTruthy();
  });
});
