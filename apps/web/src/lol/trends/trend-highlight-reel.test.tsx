import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { LolAccount, MatchNarrativeWindow, MatchSummary } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrendHighlightReel } from "./trend-highlight-reel";

const ACCOUNT: LolAccount = {
  slug: "vyoh-euw",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "EUW",
};

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function match(idx: number, remake = false): MatchSummary {
  return {
    matchId: `EUW1_${idx}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win: true,
    durationSec: 1800,
    playedAt: new Date(Date.UTC(2026, 0, idx + 1)).toISOString(),
    remake,
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

function renderTile(current: MatchSummary[], account: LolAccount | undefined = ACCOUNT) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="always">
        <TooltipPrimitive.Provider>
          <TrendHighlightReel current={current} account={account} />
        </TooltipPrimitive.Provider>
      </MotionConfig>
    </QueryClientProvider>
  );
}

function mockNarrative(payload: MatchNarrativeWindow) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(payload),
  } as Response);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(Date.UTC(2026, 4, 22)));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TrendHighlightReel", () => {
  it("renders the empty copy when fewer than 5 non-remake games", () => {
    // Remakes drop out of the count; this is 5 input rows but only 3 eligible.
    const matches = [match(1), match(2), match(3), match(4, true), match(5, true)];
    renderTile(matches);
    expect(
      screen.getByText("Need 5+ non-remake games to assemble a highlight reel.")
    ).toBeTruthy();
  });

  it("shows the pending copy while the narrative window resolves", () => {
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    renderTile(Array.from({ length: 5 }, (_, i) => match(i)));
    expect(screen.getByText("Counting moments…")).toBeTruthy();
  });

  it("renders the no-clutch-moments copy when all counts are zero", async () => {
    mockNarrative({
      matchCount: 5,
      remakeCount: 0,
      highlightReel: {
        soloKills: 0,
        outnumberedKills: 0,
        survivedSingleDigitHpCount: 0,
      },
    });
    renderTile(Array.from({ length: 5 }, (_, i) => match(i)));
    await waitFor(() =>
      expect(
        screen.getByText("No clutch moments this window — 5 games of textbook play.")
      ).toBeTruthy()
    );
  });

  it("renders the narrative verdict and the three-number strip when counts are present", async () => {
    mockNarrative({
      matchCount: 8,
      remakeCount: 0,
      highlightReel: {
        soloKills: 12,
        outnumberedKills: 4,
        survivedSingleDigitHpCount: 1,
      },
    });
    renderTile(Array.from({ length: 8 }, (_, i) => match(i)));
    await waitFor(() =>
      expect(
        screen.getByText(
          "12 solo kills, 4 outnumbered takedowns, 1 clutch survival across 8 games."
        )
      ).toBeTruthy()
    );
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("Solo kills")).toBeTruthy();
  });

  it("passes an axe scan when rendering the populated tile", async () => {
    mockNarrative({
      matchCount: 5,
      remakeCount: 0,
      highlightReel: {
        soloKills: 3,
        outnumberedKills: 1,
        survivedSingleDigitHpCount: 0,
      },
    });
    const { container } = renderTile(Array.from({ length: 5 }, (_, i) => match(i)));
    await waitFor(() => screen.getByText(/3 solo kills/));
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
