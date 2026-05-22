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
    // The fixture's prior "csAt10:80 means timeline projected" convention now
    // routes through the explicit flag — anything other than csAt10:0
    // (the empty-state knob) implies a timeline ran.
    hasTimeline: (opts.csAt10 ?? 80) !== 0,
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

  it("leads with early-phase narrative when ≥40% of deaths land before 15 minutes (PN4)", () => {
    // All deaths under 15 min → 100% early → phase-dominant verdict wins
    // over the existing peak-bucket framing.
    const matches = Array.from({ length: 5 }, (_, i) =>
      match(i, true, { deathTimings: [60, 90, 120, 150, 175] })
    );
    renderTile(matches);
    expect(
      screen.getByText(
        /100% of your deaths happen in the first 15 minutes — 25 of 25 across 5 games\./
      )
    ).toBeTruthy();
    expect(
      screen.getByText("Early-game safety: ward early and respect lane swap-ins.")
    ).toBeTruthy();
  });

  it("leads with late-phase narrative when ≥40% of deaths land after 25 minutes (PN4)", () => {
    // All deaths past 25 min (1500s+).
    const matches = Array.from({ length: 5 }, (_, i) =>
      match(i, true, { deathTimings: [1600, 1750, 1900, 2050, 2200] })
    );
    renderTile(matches);
    expect(
      screen.getByText(
        /100% of your deaths happen after 25 minutes — 25 of 25 across 5 games\./
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Late-game positioning: hold tempo, group for objectives, avoid solo picks."
      )
    ).toBeTruthy();
  });

  it("falls back to the peak-bucket cluster verdict when no phase dominates (PN4 fallback)", () => {
    // Each phase holds exactly 33% — under the 40% phase-dominant threshold
    // — but a single 3-min bucket clusters at 33% (above the 25% peak floor),
    // so the fallback verdict fires.
    const matches = Array.from({ length: 5 }, (_, i) =>
      match(i, true, {
        deathTimings: [
          // 4 early-phase deaths spread across early buckets
          120, 300, 500, 700,
          // 4 mid-phase deaths all clustered at 15–18 (bucket 5).
          // Note: 1080 = exactly 6 × 180 → Math.floor → bucket 6, so keep
          // values strictly under 1080.
          920, 970, 1020, 1070,
          // 4 late-phase deaths spread across late buckets
          1600, 1800, 2000, 2200,
        ],
      })
    );
    renderTile(matches);
    expect(
      screen.getByText(/Deaths cluster at minutes 15–18 — 20 of 60 \(33%\)\./)
    ).toBeTruthy();
  });

  it("emits the evenly-spread verdict when no phase OR bucket dominates", () => {
    // 6 deaths per match, evenly distributed across all 3 phases and 6
    // buckets — no phase reaches 40%, no bucket reaches 25%.
    const deaths = [300, 600, 1100, 1300, 1700, 1900];
    const matches = Array.from({ length: 5 }, (_, i) =>
      match(i, true, { deathTimings: deaths })
    );
    renderTile(matches);
    expect(screen.getByText(/Deaths spread evenly across the game/)).toBeTruthy();
  });
});
