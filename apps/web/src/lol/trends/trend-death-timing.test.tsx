import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendDeathTiming } from "./trend-death-timing";

function match(
  idx: number,
  win: boolean,
  opts: { csAt10?: number; deathTimings?: number[] } = {}
): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: opts.deathTimings?.length ?? 0,
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
    csAt10: opts.csAt10 ?? 80,
    csAt15: 0,
    goldAt10: 0,
    goldAt15: 0,
    teamGoldDiffAt15: 0,
    deathTimings: opts.deathTimings ?? [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
  };
}

function renderTile(current: MatchSummary[]) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <TrendDeathTiming current={current} previous={[]} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendDeathTiming", () => {
  it("renders the empty copy when no matches have a projected timeline", () => {
    renderTile([match(0, true, { csAt10: 0 })]);
    expect(
      screen.getByText(
        "Need 5+ matches with a projected timeline to detect death-timing patterns."
      )
    ).toBeTruthy();
  });

  it("renders the empty copy when fewer than 5 projected matches", () => {
    const matches = Array.from({ length: 3 }, (_, i) => match(i, true));
    renderTile(matches);
    expect(
      screen.getByText(
        "Need 5+ matches with a projected timeline to detect death-timing patterns."
      )
    ).toBeTruthy();
  });

  it("renders the exceptional copy when 5+ projected matches have no deaths", () => {
    const matches = Array.from({ length: 5 }, (_, i) => match(i, true));
    renderTile(matches);
    expect(
      screen.getByText("No deaths recorded across 5 games — exceptional.")
    ).toBeTruthy();
  });

  it("emits the cluster verdict and transition prescription when peak is at 12–15min", () => {
    // 5 matches, each with 5 deaths in the 12–15 min window (720–900s).
    // Bucket index 4 = 12–15. Each match contributes 5 deaths there.
    const matches = Array.from({ length: 5 }, (_, i) =>
      match(i, true, { deathTimings: [780, 800, 820, 840, 860] })
    );
    renderTile(matches);
    expect(
      screen.getByText(/Deaths cluster at minutes 12–15 — 25 of 25 \(100%\)\./)
    ).toBeTruthy();
    expect(
      screen.getByText("Be cautious during transition — prefer farm over fight.")
    ).toBeTruthy();
  });

  it("emits early-game prescription when deaths peak at 0–3min", () => {
    const matches = Array.from({ length: 5 }, (_, i) =>
      match(i, true, { deathTimings: [60, 90, 120, 150, 175] })
    );
    renderTile(matches);
    expect(
      screen.getByText(/Deaths cluster at minutes 0–3 — 25 of 25 \(100%\)\./)
    ).toBeTruthy();
    expect(
      screen.getByText("Early-game safety: ward early and respect lane swap-ins.")
    ).toBeTruthy();
  });

  it("emits the evenly-spread verdict when no bucket holds 25% of deaths", () => {
    // 5 matches, deaths spread across many buckets so no single bucket dominates.
    // Each match has 12 deaths, one per bucket (60 deaths total, ~8% per bucket).
    const deaths = Array.from({ length: 12 }, (_, i) => i * 180 + 30);
    const matches = Array.from({ length: 5 }, (_, i) =>
      match(i, true, { deathTimings: deaths })
    );
    renderTile(matches);
    expect(screen.getByText(/Deaths spread evenly across the game/)).toBeTruthy();
  });
});
