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

  it("reports back-to-back wins when the latest two games both won", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({ win: true, playedAt: new Date(now - 1 * DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 3 * DAY_MS).toISOString() }),
    ]);
    renderShell();
    expect(screen.getByText(/back-to-back wins\./)).toBeTruthy();
  });

  it("reports 'back on the scoreboard' when a win follows a single loss", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({ win: true, playedAt: new Date(now - 1 * DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 3 * DAY_MS).toISOString() }),
    ]);
    renderShell();
    expect(screen.getByText(/back on the scoreboard\./)).toBeTruthy();
  });

  it("reports 'first one back' when a loss follows a single win", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({ win: false, playedAt: new Date(now - 1 * DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 3 * DAY_MS).toISOString() }),
    ]);
    renderShell();
    expect(screen.getByText(/first one back\./)).toBeTruthy();
  });

  it("renders the damage-above-norm baseline verdict when damage share is well above role baseline", () => {
    // MID baseline damage share is ~0.255; 0.40 → ~57% above → above-norm branch.
    setMatches([
      fakeMatch({
        csAt15: 0,
        goldAt15: 0,
        damageShare: 0.4,
        visionScore: 20,
        teamPosition: "MIDDLE",
      }),
    ]);
    renderShell();
    expect(screen.getByText(/Damage share .* above/)).toBeTruthy();
  });

  it("renders the vision-below-norm baseline verdict when vision is way below the role baseline", () => {
    // UTILITY: damage baseline 0.08, vision baseline 70.
    // Pin damage to the baseline so vision (with a large negative delta) wins.
    setMatches([
      fakeMatch({
        csAt15: 0,
        goldAt15: 0,
        damageShare: 0.08,
        visionScore: 1,
        teamPosition: "UTILITY",
      }),
    ]);
    renderShell();
    expect(screen.getByText(/Vision .* below/)).toBeTruthy();
  });

  it("renders an 'above your average' champion read when current KDA beats prior games", () => {
    // 4 prior Ahri games with awful KDA (1/10/0 → 0.1) + 1 latest with great KDA.
    const now = Date.now();
    const ahriBad = (offset: number) =>
      fakeMatch({
        champion: "Ahri",
        kills: 1,
        deaths: 10,
        assists: 0,
        playedAt: new Date(now - offset * DAY_MS).toISOString(),
        csAt15: 0,
        goldAt15: 0,
      });
    setMatches([
      fakeMatch({
        champion: "Ahri",
        kills: 15,
        deaths: 2,
        assists: 10,
        csAt15: 0,
        goldAt15: 0,
        playedAt: new Date(now - 0).toISOString(),
      }),
      ahriBad(1),
      ahriBad(2),
      ahriBad(3),
    ]);
    renderShell();
    expect(screen.getByText(/above your .* average/)).toBeTruthy();
  });

  it("renders a 'below your average' champion read when current KDA trails prior games", () => {
    const now = Date.now();
    const ahriGreat = (offset: number) =>
      fakeMatch({
        champion: "Ahri",
        kills: 15,
        deaths: 2,
        assists: 10,
        playedAt: new Date(now - offset * DAY_MS).toISOString(),
        csAt15: 0,
        goldAt15: 0,
      });
    setMatches([
      fakeMatch({
        champion: "Ahri",
        kills: 1,
        deaths: 10,
        assists: 0,
        csAt15: 0,
        goldAt15: 0,
        playedAt: new Date(now).toISOString(),
      }),
      ahriGreat(1),
      ahriGreat(2),
      ahriGreat(3),
    ]);
    renderShell();
    expect(screen.getByText(/below your .* average/)).toBeTruthy();
  });

  it("renders a 'matches your average' champion read when current KDA is within the band", () => {
    const now = Date.now();
    const ahriMid = (offset: number, k = 5, d = 4, a = 8) =>
      fakeMatch({
        champion: "Ahri",
        kills: k,
        deaths: d,
        assists: a,
        playedAt: new Date(now - offset * DAY_MS).toISOString(),
        csAt15: 0,
        goldAt15: 0,
      });
    setMatches([ahriMid(0), ahriMid(1), ahriMid(2), ahriMid(3)]);
    renderShell();
    expect(screen.getByText(/matches your average/)).toBeTruthy();
  });

  it("renders the comeback-win verdict when behind at 15 and still won", () => {
    setMatches([
      fakeMatch({ goldAt15: 6000, csAt15: 110, teamGoldDiffAt15: -3000, win: true }),
    ]);
    renderShell();
    expect(screen.getByText(/Down 3\.0k at 15 — comeback win\./)).toBeTruthy();
  });

  it("renders the hard-stomped verdict when blown out and lost", () => {
    setMatches([
      fakeMatch({ goldAt15: 6000, csAt15: 110, teamGoldDiffAt15: -6000, win: false }),
    ]);
    renderShell();
    expect(screen.getByText(/Hard-stomped/)).toBeTruthy();
  });

  it("renders a tilt verdict tone once the history is at least 8 games deep", () => {
    const now = Date.now();
    // 8 alternating games — enough to satisfy history >= 8 and bucket.games >= 3.
    setMatches(
      Array.from({ length: 8 }, (_, i) =>
        fakeMatch({
          win: i % 2 === 0,
          playedAt: new Date(now - i * DAY_MS).toISOString(),
          csAt15: 0,
          goldAt15: 0,
        })
      )
    );
    renderShell();
    // 4 alternating "after-a-win" buckets with 0 wins → 0%, well below overall
    // 50% WR — falls into the warning ("consider stepping away") branch.
    expect(screen.getByText(/consider stepping away/)).toBeTruthy();
  });

  it("animates a win-tinted pulse when isFresh is true", () => {
    setMatches([fakeMatch({ csAt15: 0, goldAt15: 0, win: true })], true);
    const { container } = renderShell();
    // We can't observe motion's animate prop directly, but the section must
    // still render — the pulseColor branch is exercised via isFresh=true.
    expect(container.textContent).toContain("Post-game");
  });
});
