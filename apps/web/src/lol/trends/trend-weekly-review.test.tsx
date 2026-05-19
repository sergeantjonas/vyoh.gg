import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendWeeklyReview } from "./trend-weekly-review";

function match(idx: number, win: boolean, durationSec = 1800): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win,
    durationSec,
    playedAt: new Date(Date.UTC(2026, 0, idx + 1, 12)).toISOString(),
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

function renderReview(matches: MatchSummary[]) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <TrendWeeklyReview current={matches} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendWeeklyReview", () => {
  it("renders the empty placeholder when fewer than 10 played games exist", () => {
    renderReview(Array.from({ length: 9 }, (_, i) => match(i, true)));
    expect(
      screen.getByText("Not enough data yet to generate your briefing.")
    ).toBeTruthy();
  });

  it("renders the empty placeholder when 10+ games produce no qualifying insights", () => {
    // 10 straight wins at the same hour → tilt has only afterWin (no afterLoss),
    // a single game-length bucket, and a hotspot that matches the overall WR.
    renderReview(Array.from({ length: 10 }, (_, i) => match(i, true)));
    expect(
      screen.getByText("Not enough data yet to generate your briefing.")
    ).toBeTruthy();
  });

  it("surfaces the tilt insight when after-win vs after-loss WR diverges by 8pp+", () => {
    // 6 wins then 6 losses → afterWin 6g 5W (83%), afterLoss 5g 0W (0%).
    const matches = [
      ...Array.from({ length: 6 }, (_, i) => match(i, true)),
      ...Array.from({ length: 6 }, (_, i) => match(i + 6, false)),
    ];
    renderReview(matches);
    expect(
      screen.getByText("83% WR after a win vs 0% after a loss — momentum carries.")
    ).toBeTruthy();
  });

  it("uses the fresh-sessions phrasing when after-loss WR is higher than after-win WR", () => {
    // Alternating L W starting with L → afterLoss 6g 6W (100%), afterWin 5g 0W (0%).
    const matches = Array.from({ length: 12 }, (_, i) => match(i, i % 2 === 1));
    renderReview(matches);
    expect(
      screen.getByText(
        "0% WR after a win vs 100% after a loss — fresh sessions seem to help."
      )
    ).toBeTruthy();
  });

  it("surfaces a game-length insight when one duration bucket dominates win-rate", () => {
    // 5 short games (10min, all wins) + 5 long games (40min, all losses).
    // Short bucket → 100% WR, long bucket → 0% WR, spread = 1.0 >> 0.12 threshold.
    const short = Array.from({ length: 5 }, (_, i) => match(i, true, 10 * 60));
    const long = Array.from({ length: 5 }, (_, i) => match(i + 5, false, 40 * 60));
    renderReview([...short, ...long]);
    // Game-length insight text mentions the strongest bucket label + WR.
    // We don't know the exact bucket label, but every variant ends with the same suffix.
    expect(
      screen.getAllByText(/is your strongest — 100% WR over 5 games\./).length
    ).toBeGreaterThan(0);
  });

  it("surfaces a strong-hour-slot insight when an hour bucket beats overall WR by 15pp+", () => {
    // computeHourDayStats buckets by (day-of-week, hour). To produce a bucket
    // with 3+ games we need multiple matches on the same weekday + same hour.
    // 4 wins on consecutive Mondays at 12:00 + 8 losses at 18:00 on other days.
    // Overall WR = 4/12 = 33%; the Mon-12:00 slot WR = 100% → margin > 0.15.
    const mondays = [5, 12, 19, 26]; // Jan 5/12/19/26 2026 are all Mondays
    const hot = mondays.map((day, i) => {
      const m = match(i, true, 1800);
      m.playedAt = new Date(Date.UTC(2026, 0, day, 12)).toISOString();
      return m;
    });
    const others = Array.from({ length: 8 }, (_, i) => {
      const m = match(i + 100, false, 1800);
      m.playedAt = new Date(Date.UTC(2026, 0, i + 1, 18)).toISOString();
      return m;
    });
    renderReview([...hot, ...others]);
    expect(
      screen.getAllByText(/is a strong slot — 100% WR over 4 games\./).length
    ).toBeGreaterThan(0);
  });
});
