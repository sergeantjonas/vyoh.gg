import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { useCachedMatchesWindow } from "@/lol/matches/use-matches";
import { render, screen } from "@testing-library/react";
import type { LolAccount, MatchSummary } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecapSeasonThread } from "./recap-season-thread";

vi.mock("@/lol/matches/use-matches", () => ({
  useCachedMatchesWindow: vi.fn(),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "Ahri",
} as LolAccount;

function match(
  index: number,
  win: boolean,
  overrides: Partial<MatchSummary> = {}
): MatchSummary {
  return {
    matchId: `EUW1_${index}`,
    queueId: 420,
    champion: "Ahri",
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
    teamGoldDiffSeries: [],
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

function mockWindow(matches: MatchSummary[] | undefined, isPending = false) {
  vi.mocked(useCachedMatchesWindow).mockReturnValue({
    data: matches ? { matches, total: matches.length } : undefined,
    isPending,
  } as ReturnType<typeof useCachedMatchesWindow>);
}

function renderThread() {
  return render(
    <MotionConfig reducedMotion="always">
      <RecapSeasonThread account={account} />
    </MotionConfig>
  );
}

beforeEach(() => {
  vi.mocked(useCachedMatchesWindow).mockReset();
});

describe("RecapSeasonThread", () => {
  it("draws one segment per match plus the baseline, excluding remakes", () => {
    mockWindow([
      match(1, true),
      match(2, false),
      match(3, true, { remake: true }),
      match(4, true),
    ]);
    const { container } = renderThread();
    // 3 non-remake segments + 1 baseline.
    expect(container.querySelectorAll("svg line")).toHaveLength(4);
  });

  it("colors segments through championTheme, resolving Swarm aliases", () => {
    mockWindow([
      match(1, true, { champion: "Ahri" }),
      match(2, false, { champion: "Strawberry_Ahri" }),
    ]);
    const { container } = renderThread();
    const strokes = [...container.querySelectorAll("svg line")].map((l) =>
      l.getAttribute("stroke")
    );
    const ahriHex = championTheme("Ahri").dominantHex;
    expect(strokes.filter((s) => s === ahriHex)).toHaveLength(2);
    expect(strokes).not.toContain("#888888");
  });

  it("orders the walk chronologically even when the window arrives newest-first", () => {
    // Jinx game played after the Ahri game, but listed first (API order).
    const jinxHex = championTheme("Jinx").dominantHex;
    const ahriHex = championTheme("Ahri").dominantHex;
    mockWindow([
      match(5, true, { champion: "Jinx" }),
      match(1, true, { champion: "Ahri" }),
    ]);
    const { container } = renderThread();
    const segments = [...container.querySelectorAll("svg line")].filter(
      (l) => l.getAttribute("stroke") !== "#ffffff"
    );
    expect(segments.map((l) => l.getAttribute("stroke"))).toEqual([ahriHex, jinxHex]);
  });

  it("summarises the window in the caption", () => {
    mockWindow([
      match(1, true, { champion: "Ahri" }),
      match(2, false, { champion: "Jinx" }),
      match(3, true, { champion: "Strawberry_Ahri" }),
    ]);
    renderThread();
    // Strawberry_Ahri normalises into Ahri: 2 distinct champions, not 3.
    expect(
      screen.queryByText(/3 games · 2 champions · Jan 2026 → Jan 2026/)
    ).not.toBeNull();
  });

  it("mirrors the layout with a skeleton while the window is pending", () => {
    mockWindow(undefined, true);
    const { container } = renderThread();
    expect(container.querySelector(".aspect-\\[40\\/21\\].animate-pulse")).not.toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders nothing for an empty or failed window", () => {
    mockWindow([]);
    expect(renderThread().container.firstChild).toBeNull();
    mockWindow(undefined, false);
    expect(renderThread().container.firstChild).toBeNull();
  });

  it("labels the artwork for assistive tech and passes axe", async () => {
    mockWindow([match(1, true), match(2, false)]);
    const { container } = renderThread();
    expect(
      screen.queryByRole("img", { name: /win\/loss walk of 2 games/ })
    ).not.toBeNull();

    const axe = configureAxe({
      rules: {
        "color-contrast": { enabled: false },
        "aria-hidden-focus": { enabled: false },
      },
    });
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
