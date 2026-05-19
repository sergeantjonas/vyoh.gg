import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendLpEconomy } from "./trend-lp-economy";

function match(
  idx: number,
  win: boolean,
  opts: { lpBefore?: number; lpAfter?: number; unranked?: boolean } = {}
): MatchSummary {
  const base: MatchSummary = {
    matchId: `M_${idx}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win,
    durationSec: 1800,
    playedAt: new Date(Date.UTC(2026, 0, idx + 1)).toISOString(),
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
  if (opts.unranked) return base;
  return {
    ...base,
    snapshotTier: "PLATINUM",
    snapshotRank: "IV",
    snapshotLp: opts.lpAfter ?? 50,
    snapshotTierBefore: "PLATINUM",
    snapshotRankBefore: "IV",
    snapshotLpBefore: opts.lpBefore ?? 30,
  };
}

function renderTile(current: MatchSummary[]) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <TrendLpEconomy current={current} previous={[]} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendLpEconomy", () => {
  it("renders the empty copy when fewer than 4 ranked matches", () => {
    renderTile([match(0, true), match(1, false), match(2, true)]);
    expect(screen.getByText("Not enough ranked games with LP data yet.")).toBeTruthy();
  });

  it("renders the empty copy when ranked sample lacks 2 wins or 2 losses", () => {
    // 4 ranked, 4 wins → 0 losses with delta → stats null.
    const matches = Array.from({ length: 4 }, (_, i) =>
      match(i, true, { lpBefore: 30, lpAfter: 50 })
    );
    renderTile(matches);
    expect(screen.getByText("Not enough ranked games with LP data yet.")).toBeTruthy();
  });

  it("renders the climbing-efficiently verdict when avg gain > avg loss", () => {
    // 2 wins of +20 LP, 2 losses of -10 LP → net = +10 → climbing.
    const matches = [
      match(0, true, { lpBefore: 30, lpAfter: 50 }),
      match(1, true, { lpBefore: 50, lpAfter: 70 }),
      match(2, false, { lpBefore: 70, lpAfter: 60 }),
      match(3, false, { lpBefore: 60, lpAfter: 50 }),
    ];
    renderTile(matches);
    expect(
      screen.getByText(
        "+20 / -10 LP — wins are bigger than losses, you're climbing efficiently."
      )
    ).toBeTruthy();
  });

  it("renders the bleeding-LP verdict and prescription when avg loss > avg gain", () => {
    const matches = [
      match(0, true, { lpBefore: 30, lpAfter: 40 }),
      match(1, true, { lpBefore: 40, lpAfter: 50 }),
      match(2, false, { lpBefore: 50, lpAfter: 30 }),
      match(3, false, { lpBefore: 30, lpAfter: 10 }),
    ];
    renderTile(matches);
    expect(
      screen.getByText("+10 / -20 LP — losses cost more than wins earn.")
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Your MMR may be below your rank — expect harder games until it equalises."
      )
    ).toBeTruthy();
  });

  it("ignores unranked matches when computing LP stats", () => {
    const matches = [
      ...Array.from({ length: 10 }, (_, i) => match(i, true, { unranked: true })),
      match(10, true, { unranked: true }),
    ];
    renderTile(matches);
    expect(screen.getByText("Not enough ranked games with LP data yet.")).toBeTruthy();
  });
});
