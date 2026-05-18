import { describe, expect, it } from "vitest";
import { type MatchupRow, buildWeakestMatchup } from "./weakest-matchup";

const row = (champion: string, games: number, wins: number): MatchupRow => ({
  champion,
  games,
  wins,
});

describe("buildWeakestMatchup", () => {
  it("returns null when no matchup clears MIN_MATCHUP_GAMES (5)", () => {
    expect(buildWeakestMatchup([])).toBeNull();
    expect(buildWeakestMatchup([row("Yasuo", 4, 1)])).toBeNull();
  });

  it("returns null when total matchup games is 0", () => {
    // No eligible row triggers the first null. To exercise the totalGames=0
    // branch we need an eligible row but a zero total — not reachable through
    // normal data, so the null-on-zero-eligible branch covers callers.
    expect(buildWeakestMatchup([row("Yasuo", 0, 0)])).toBeNull();
  });

  it("picks the eligible matchup with the lowest WR and reports delta vs baseline", () => {
    // Baseline WR across all matchups: (2 + 5 + 3) / (10 + 10 + 10) = 0.3333
    // Eligibles: Yasuo 20%, Zed 50%, Ahri 30%. Worst = Yasuo at 20%.
    const result = buildWeakestMatchup([
      row("Yasuo", 10, 2),
      row("Zed", 10, 5),
      row("Ahri", 10, 3),
    ]);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.champion).toBe("Yasuo");
    expect(result.games).toBe(10);
    expect(result.wr).toBeCloseTo(0.2, 5);
    expect(result.baselineWr).toBeCloseTo(10 / 30, 5);
    // (10/30 - 0.2) * 100 = 13.33… → rounds to 13
    expect(result.deltaPP).toBe(13);
  });

  it("ignores small-sample matchups for the worst pick but counts them in the baseline", () => {
    // Eligibles only: Yasuo at 40%. Inelligible (Garen 1/1=100%) still contributes to baseline.
    const result = buildWeakestMatchup([row("Yasuo", 10, 4), row("Garen", 1, 1)]);
    expect(result?.champion).toBe("Yasuo");
    // Baseline includes Garen: 5/11 ≈ 0.4545. Delta = 0.4545 - 0.4 = 0.0545 → 5.
    expect(result?.baselineWr).toBeCloseTo(5 / 11, 5);
    expect(result?.deltaPP).toBe(5);
  });
});
