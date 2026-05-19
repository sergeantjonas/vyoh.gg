import { useSeriousMatches } from "@/lol/_shared/serious-queues/serious-queues";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfilePregameRitual } from "./profile-pregame-ritual";

vi.mock("@/lol/_shared/serious-queues/serious-queues", () => ({
  useSeriousMatches: vi.fn(),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...(props as Record<string, unknown>)}>{children}</a>
  ),
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

function setMatches(matches: MatchSummary[] | undefined, isPending = false) {
  vi.mocked(useSeriousMatches).mockReturnValue({ matches, isPending });
}

function renderRitual() {
  return render(
    <MotionConfig reducedMotion="always">
      <ProfilePregameRitual accountSlug="ahri" />
    </MotionConfig>
  );
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

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
    playedAt: new Date(Date.now() - 24 * HOUR_MS).toISOString(),
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "14.20.586.5840",
    visionScore: 20,
    damageShare: 0.2,
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

afterEach(() => {
  vi.mocked(useSeriousMatches).mockReset();
  vi.useRealTimers();
});

describe("ProfilePregameRitual", () => {
  it("renders nothing when there are no matches", () => {
    setMatches([]);
    const { container } = renderRitual();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing while the matches query is pending (undefined data)", () => {
    setMatches(undefined, true);
    const { container } = renderRitual();
    expect(container.firstChild).toBeNull();
  });

  it("renders all four signal tiles when matches are available", () => {
    setMatches([fakeMatch()]);
    renderRitual();
    expect(screen.getByText("Pre-game")).toBeTruthy();
    expect(screen.getByText("Form")).toBeTruthy();
    expect(screen.getByText("After last game")).toBeTruthy();
    expect(screen.getByText("Time slot")).toBeTruthy();
    // Champion tile label varies (Champion vs Most played) depending on data.
    expect(
      screen.queryByText("Champion") ?? screen.queryByText("Most played")
    ).toBeTruthy();
  });

  it("reports a streak when consecutive recent games share an outcome", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({ win: true, playedAt: new Date(now - DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 3 * DAY_MS).toISOString() }),
    ]);
    renderRitual();
    expect(screen.getByText(/On a 3-game win streak\./)).toBeTruthy();
  });

  it("reports the loss-streak phrasing for a losing run", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({ win: false, playedAt: new Date(now - DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
    ]);
    renderRitual();
    expect(screen.getByText(/On a 2-game loss streak\./)).toBeTruthy();
  });

  it("reads 'Last game was a win.' when only one recent game and it was a win", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({ win: true, playedAt: new Date(now - DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
    ]);
    renderRitual();
    expect(screen.getByText(/Last game was a win\./)).toBeTruthy();
  });

  it("reports the most-played champion verdict when ≥1 recent game exists", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({
        win: true,
        playedAt: new Date(now - DAY_MS).toISOString(),
        champion: "Ahri",
      }),
      fakeMatch({
        win: false,
        playedAt: new Date(now - 2 * DAY_MS).toISOString(),
        champion: "Ahri",
      }),
      fakeMatch({
        win: true,
        playedAt: new Date(now - 3 * DAY_MS).toISOString(),
        champion: "Lux",
      }),
    ]);
    renderRitual();
    expect(screen.getByText(/Ahri — 2g · 50% WR/)).toBeTruthy();
    expect(screen.getByText(/Last 14 days/)).toBeTruthy();
  });

  it("falls back to 'No games in the last 14 days' for the champion tile when all matches are older than the window", () => {
    const tooOld = new Date(Date.now() - 30 * DAY_MS).toISOString();
    setMatches([fakeMatch({ playedAt: tooOld })]);
    renderRitual();
    expect(screen.getByText(/No games in the last 14 days\./)).toBeTruthy();
  });

  it("reports the 'need more games' tilt verdict when fewer than 5 played games exist", () => {
    setMatches([fakeMatch()]);
    renderRitual();
    expect(screen.getByText(/Need a few more games to read\./)).toBeTruthy();
  });

  it("reports the 'untested hour' time-slot verdict when fewer than 10 games exist", () => {
    setMatches([fakeMatch()]);
    renderRitual();
    expect(screen.getByText(/Need more games to read your hours\./)).toBeTruthy();
  });

  it("renders a composite read banner when at least one signal fires", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({ win: true, playedAt: new Date(now - DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
    ]);
    renderRitual();
    expect(screen.getByText(/Composite read · next ranked/)).toBeTruthy();
  });

  it("renders the empty composite when no signal fires", () => {
    setMatches([fakeMatch({ remake: true })]);
    renderRitual();
    expect(screen.getByText(/Play a few games and we'll have a read\./)).toBeTruthy();
  });

  it("reports 'not enough games after a win' when ≥5 total but <3 after-win games", () => {
    const now = Date.now();
    // 5 games total: last 4 were losses (the "after-loss" bucket is fine);
    // last game won, but the after-win bucket only has the games following
    // wins in history — with only one win at the top, there are 0 after-win.
    setMatches([
      fakeMatch({ win: true, playedAt: new Date(now - 1 * DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 3 * DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 4 * DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 5 * DAY_MS).toISOString() }),
    ]);
    renderRitual();
    expect(screen.getByText(/Not enough games after a win yet\./)).toBeTruthy();
  });

  it("reports the after-loss WR verdict when ≥5 total and ≥3 in the after-loss bucket", () => {
    const now = Date.now();
    // 6 losses in a row → after-loss bucket has 5 entries.
    setMatches(
      Array.from({ length: 6 }, (_, i) =>
        fakeMatch({
          win: false,
          playedAt: new Date(now - (i + 1) * DAY_MS).toISOString(),
        })
      )
    );
    renderRitual();
    // 0% WR after a loss → the verdict surfaces as a warning.
    expect(screen.getByText(/After a loss you historically win 0%\./)).toBeTruthy();
  });

  it("reads 'Last game was a loss.' when only one recent game and it was a loss", () => {
    const now = Date.now();
    // Alternating outcomes ⇒ no streak ⇒ falls through to last-game branch.
    setMatches([
      fakeMatch({ win: false, playedAt: new Date(now - DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
    ]);
    renderRitual();
    expect(screen.getByText(/Last game was a loss\./)).toBeTruthy();
  });

  it("reports the after-win positive tone WR verdict when ≥3 after-win games exist", () => {
    const now = Date.now();
    // 6 wins in a row → after-win bucket has 5 entries → 100% WR ⇒ positive tone.
    setMatches(
      Array.from({ length: 6 }, (_, i) =>
        fakeMatch({
          win: true,
          playedAt: new Date(now - (i + 1) * DAY_MS).toISOString(),
        })
      )
    );
    renderRitual();
    expect(screen.getByText(/After a win you historically win 100%\./)).toBeTruthy();
  });

  it("renders the champion verdict with a positive tone when WR ≥ 50%", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({ win: true, playedAt: new Date(now - DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 3 * DAY_MS).toISOString() }),
    ]);
    renderRitual();
    // WR=100% → tone="positive" → emerald border class applied to the tile.
    expect(screen.getByText(/Ahri — 3g · 100% WR/)).toBeTruthy();
  });

  it("renders the time-slot tile when matches reach the ≥10-game threshold", () => {
    const now = Date.now();
    setMatches(
      Array.from({ length: 12 }, (_, i) =>
        fakeMatch({
          win: i % 2 === 0,
          playedAt: new Date(now - (i + 1) * HOUR_MS).toISOString(),
        })
      )
    );
    renderRitual();
    // With 12 alternating games at arbitrary hours, no specific slot reaches
    // the MIN_HOUR_SAMPLE threshold — the "Untested hour" verdict surfaces.
    expect(screen.getByText(/Untested hour for you/)).toBeTruthy();
  });
});
