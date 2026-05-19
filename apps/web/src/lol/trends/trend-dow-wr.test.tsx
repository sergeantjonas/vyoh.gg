import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendDowWr } from "./trend-dow-wr";

// 2026-01-05 = Monday, 06 = Tuesday, 07 = Wednesday, 08 = Thursday in JS Date.
function match(playedAt: string, win: boolean, idx: number): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win,
    durationSec: 1800,
    playedAt,
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
  };
}

function renderDow(matches: MatchSummary[], previous: MatchSummary[] = []) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <TrendDowWr current={matches} previous={previous} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendDowWr", () => {
  it("renders the empty placeholder when there are fewer than 7 played games", () => {
    const matches = Array.from({ length: 6 }, (_, i) =>
      match(`2026-01-0${5 + (i % 3)}T12:00:00Z`, true, i)
    );
    renderDow(matches);
    expect(
      screen.getByText(/Need games on 2\+ days to compare day-of-week performance/)
    ).toBeTruthy();
  });

  it("renders the empty placeholder when fewer than 2 days clear the 3-game eligibility floor", () => {
    // 7 games all on Mon → only one eligible day.
    const matches = Array.from({ length: 7 }, (_, i) =>
      match("2026-01-05T12:00:00Z", true, i)
    );
    renderDow(matches);
    expect(
      screen.getByText(/Need games on 2\+ days to compare day-of-week performance/)
    ).toBeTruthy();
  });

  it("flags the weakest day with the prescription when the gap is at least 12pp", () => {
    // Mon 3L (0%), Wed 3W (100%), Tue 1W = 7 played, deltaPp = 100.
    const matches: MatchSummary[] = [
      match("2026-01-05T12:00:00Z", false, 1),
      match("2026-01-05T12:00:00Z", false, 2),
      match("2026-01-05T12:00:00Z", false, 3),
      match("2026-01-07T12:00:00Z", true, 4),
      match("2026-01-07T12:00:00Z", true, 5),
      match("2026-01-07T12:00:00Z", true, 6),
      match("2026-01-06T12:00:00Z", true, 7),
    ];
    renderDow(matches);
    expect(
      screen.getByText(/Mon is your weakest day — 0% WR over 3 games\./)
    ).toBeTruthy();
    expect(
      screen.getByText(/Consider lighter ranked load on Mon\. Wed is your best at 100%/)
    ).toBeTruthy();
  });

  it("omits the prescription when the strong/weak day delta is under 12pp", () => {
    // Mon 2W 1L (67%), Wed 2W 1L (67%), Tue 1W = 7 played, deltaPp = 0.
    const matches: MatchSummary[] = [
      match("2026-01-05T12:00:00Z", true, 1),
      match("2026-01-05T12:00:00Z", true, 2),
      match("2026-01-05T12:00:00Z", false, 3),
      match("2026-01-07T12:00:00Z", true, 4),
      match("2026-01-07T12:00:00Z", true, 5),
      match("2026-01-07T12:00:00Z", false, 6),
      match("2026-01-06T12:00:00Z", true, 7),
    ];
    renderDow(matches);
    expect(screen.getByText(/is your weakest day — 67% WR over 3 games\./)).toBeTruthy();
    expect(screen.queryByText(/Consider lighter ranked load/)).toBeNull();
  });

  it("renders the sample-size badge with the played-games count", () => {
    const matches = Array.from({ length: 9 }, (_, i) =>
      match(`2026-01-0${5 + (i % 3)}T12:00:00Z`, i % 2 === 0, i)
    );
    renderDow(matches);
    expect(screen.getByText(/9 games/)).toBeTruthy();
  });
});
