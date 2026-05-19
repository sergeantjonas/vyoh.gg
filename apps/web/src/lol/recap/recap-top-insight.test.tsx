import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { RecapTopInsight } from "./recap-top-insight";

function match(index: number, win: boolean): MatchSummary {
  return {
    matchId: `EUW1_${index}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win,
    durationSec: 1800,
    // Chronological by ISO; the insight functions rely on `playedAt` ordering.
    playedAt: new Date(2026, 0, 1 + index, 12, 0, 0).toISOString(),
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

function renderInsight(matches: MatchSummary[] | undefined) {
  return render(
    <MotionConfig reducedMotion="always">
      <RecapTopInsight matches={matches} />
    </MotionConfig>
  );
}

describe("RecapTopInsight", () => {
  it("renders the empty placeholder when no insight candidate qualifies", () => {
    renderInsight([]);
    expect(screen.queryByText(/the standout pattern will land here/)).not.toBeNull();
  });

  it("surfaces the streak insight when a 4+ win run exists and other categories are below threshold", () => {
    // 5 wins then 3 losses → bestWin=5, bestLoss=3. <10 matches keeps tilt and
    // hour out of the running, so streak wins by default.
    const wins = Array.from({ length: 5 }, (_, i) => match(i + 1, true));
    const losses = Array.from({ length: 3 }, (_, i) => match(i + 6, false));
    renderInsight([...wins, ...losses]);

    expect(screen.queryByText(/longest win streak this window: 5 games/)).not.toBeNull();
  });

  it("surfaces the tilt insight when after-win and after-loss win rates diverge", () => {
    // 12 alternating matches starting with a win: WLWLWLWLWLWL. Eleven
    // transitions; six 'after a win' (all losses, 0/6 WR), five 'after a loss'
    // (all wins, 5/5 WR). The 100pp swing locks tilt as the only headline —
    // bestWin=bestLoss=1 keeps streak out; matches.length<15 keeps hour out.
    const matches = Array.from({ length: 12 }, (_, i) => match(i + 1, i % 2 === 0));
    renderInsight(matches);

    expect(
      screen.queryByText(/bounce back 100% better after a loss than a win/)
    ).not.toBeNull();
  });

  it("surfaces the loss-streak insight when a 4+ loss run is the dominant signal", () => {
    // 3 wins then 5 losses → bestWin=3 (< 4), bestLoss=5 → loss-streak wins.
    const wins = Array.from({ length: 3 }, (_, i) => match(i + 1, true));
    const losses = Array.from({ length: 5 }, (_, i) => match(i + 4, false));
    renderInsight([...wins, ...losses]);

    expect(screen.queryByText(/longest loss streak this window: 5 games/)).not.toBeNull();
  });

  it("surfaces the hour-slot insight when a (day, hour) bucket is well above the average WR", () => {
    // Need: matches.length >= 15, a (day, hour) bucket with >= 4 games, and
    // that bucket's WR at least 10pp above the overall WR.
    // 4 wins on 4 consecutive Mondays (Jan 5/12/19/26 2026, all hour 12)
    // + 12 losses spread across other days/hours.
    const mondays = [5, 12, 19, 26];
    const hot: MatchSummary[] = mondays.map((day, i) => {
      const m = match(i + 1, true);
      m.playedAt = new Date(Date.UTC(2026, 0, day, 12)).toISOString();
      return m;
    });
    const others: MatchSummary[] = Array.from({ length: 12 }, (_, i) => {
      const m = match(i + 100, false);
      m.playedAt = new Date(Date.UTC(2026, 1, i + 1, 18)).toISOString();
      return m;
    });
    renderInsight([...hot, ...others]);
    expect(screen.queryByText(/strongest slot/)).not.toBeNull();
  });
});
