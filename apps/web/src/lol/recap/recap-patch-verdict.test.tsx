import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { RecapPatchVerdict } from "./recap-patch-verdict";

function match(
  index: number,
  win: boolean,
  gameVersion: string,
  overrides: Partial<MatchSummary> = {}
): MatchSummary {
  return {
    matchId: `EUW1_${index}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win,
    durationSec: 1800,
    playedAt: new Date(2026, 0, 1 + index).toISOString(),
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion,
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
    ...overrides,
  };
}

function renderVerdict(matches: MatchSummary[] | undefined) {
  return render(
    <MotionConfig reducedMotion="always">
      <RecapPatchVerdict matches={matches} />
    </MotionConfig>
  );
}

describe("RecapPatchVerdict", () => {
  it("renders the empty placeholder when there aren't two qualifying patches", () => {
    // Only one patch has the min 5 games — single-patch input cannot form a verdict.
    const matches = [
      match(1, true, "16.9.1.1"),
      match(2, true, "16.9.1.1"),
      match(3, false, "16.9.1.1"),
      match(4, true, "16.9.1.1"),
      match(5, true, "16.9.1.1"),
    ];
    renderVerdict(matches);
    expect(screen.queryByText(/at least 5 games on two or more patches/)).not.toBeNull();
  });

  it("picks the highest WR patch as 'best' and the lowest as 'worst'", () => {
    // Two qualifying patches: 16.9 (display 26.9) 100% WR, 16.10 (display 26.10) 20% WR.
    const best = Array.from({ length: 5 }, (_, i) => match(i + 1, true, "16.9.1.1"));
    const worst = [
      match(10, true, "16.10.1.1"),
      match(11, false, "16.10.1.1"),
      match(12, false, "16.10.1.1"),
      match(13, false, "16.10.1.1"),
      match(14, false, "16.10.1.1"),
    ];
    renderVerdict([...best, ...worst]);

    // Truncated/year-shaped display: API major + 10 → 26.9 and 26.10.
    expect(screen.queryByText("26.9")).not.toBeNull();
    expect(screen.queryByText("26.10")).not.toBeNull();
    // Best 5/5 = 100%; Worst 1/5 = 20%.
    expect(screen.queryByText("100%")).not.toBeNull();
    expect(screen.queryByText("20%")).not.toBeNull();
  });

  it("excludes remakes from per-patch counts so a remake-padded bucket below the min-games threshold is dropped", () => {
    // 16.9 has 5 real games (qualifies); 16.10 has 4 real + 2 remakes = 4 valid (drops below 5).
    const qualifying = Array.from({ length: 5 }, (_, i) =>
      match(i + 1, i % 2 === 0, "16.9.1.1")
    );
    const padded = [
      match(10, true, "16.10.1.1"),
      match(11, false, "16.10.1.1"),
      match(12, true, "16.10.1.1"),
      match(13, false, "16.10.1.1"),
      match(14, true, "16.10.1.1", { remake: true }),
      match(15, true, "16.10.1.1", { remake: true }),
    ];
    renderVerdict([...qualifying, ...padded]);

    // Only one bucket qualifies → empty fallback copy renders.
    expect(screen.queryByText(/at least 5 games on two or more patches/)).not.toBeNull();
  });
});
