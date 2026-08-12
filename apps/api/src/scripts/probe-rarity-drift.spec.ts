import { describe, expect, it } from "vitest";
import {
  type Observation,
  type Series,
  type Thresholds,
  ageDays,
  cohortOf,
  delta,
  foldSeries,
  isVisible,
  perWeek,
  ratio,
  spanDays,
} from "./probe-rarity-drift";

const at = (iso: string) => new Date(iso);

const obs = (apiName: string, percent: number, iso: string): Observation => ({
  appid: 1,
  apiName,
  percent,
  observedAt: at(iso),
});

const series = (over: Partial<Series> = {}): Series => ({
  appid: 1,
  apiName: "ACH",
  points: 2,
  firstAt: at("2026-08-01T00:00:00Z"),
  lastAt: at("2026-08-08T00:00:00Z"),
  firstPct: 1,
  lastPct: 1,
  ...over,
});

const thresholds: Thresholds = {
  rareBand: 10,
  visiblePp: 0.5,
  visibleRatio: 2,
  launchWindowDays: 60,
};

describe("foldSeries", () => {
  it("takes endpoints from the first and last observation of each achievement", () => {
    const folded = foldSeries([
      obs("A", 5, "2026-08-01T00:00:00Z"),
      obs("B", 9, "2026-08-01T00:00:00Z"),
      obs("A", 5.3, "2026-08-05T00:00:00Z"),
      obs("A", 5.8, "2026-08-09T00:00:00Z"),
    ]);

    const a = folded.find((s) => s.apiName === "A");
    expect(a).toMatchObject({ points: 3, firstPct: 5, lastPct: 5.8 });
    expect(a?.firstAt).toEqual(at("2026-08-01T00:00:00Z"));
    expect(a?.lastAt).toEqual(at("2026-08-09T00:00:00Z"));
  });

  it("keeps a single observation as a one-point series rather than dropping it", () => {
    // Single-point series are the coverage signal — they must survive the fold
    // so the report can say "silent" instead of implying "flat".
    const folded = foldSeries([obs("B", 9, "2026-08-01T00:00:00Z")]);
    expect(folded).toHaveLength(1);
    expect(folded[0]).toMatchObject({ points: 1, firstPct: 9, lastPct: 9 });
  });

  it("separates achievements that share an apiName across different games", () => {
    const folded = foldSeries([
      { appid: 1, apiName: "ACH_1", percent: 2, observedAt: at("2026-08-01T00:00:00Z") },
      { appid: 2, apiName: "ACH_1", percent: 40, observedAt: at("2026-08-01T00:00:00Z") },
    ]);
    expect(folded).toHaveLength(2);
  });
});

describe("ratio", () => {
  it("is null when the series starts at Steam's zero floor", () => {
    // A literal 0 is a bound, not a measurement, so 0 → 2.0% has no ratio.
    expect(ratio(series({ firstPct: 0, lastPct: 2 }))).toBeNull();
  });

  it("divides last by first otherwise", () => {
    expect(ratio(series({ firstPct: 0.3, lastPct: 1.9 }))).toBeCloseTo(6.33, 2);
  });
});

describe("isVisible", () => {
  it("rejects a single-quantum move, which is indistinguishable from rounding", () => {
    expect(isVisible(series({ firstPct: 8.2, lastPct: 8.3 }), thresholds)).toBe(false);
  });

  it("accepts a move that clears the absolute threshold", () => {
    expect(isVisible(series({ firstPct: 8.2, lastPct: 8.9 }), thresholds)).toBe(true);
  });

  it("accepts a small absolute move that is a large relative one", () => {
    // 0.3% → 1.9% is only 1.6pp, but it is the shape this arc reserved itself
    // for, so the ratio arm has to catch it independently of the pp arm.
    expect(isVisible(series({ firstPct: 0.3, lastPct: 1.9 }), thresholds)).toBe(true);
  });

  it("treats a large drop as visible, since drift has no preferred direction", () => {
    expect(isVisible(series({ firstPct: 9, lastPct: 8 }), thresholds)).toBe(true);
  });

  it("does not credit a rise off the zero floor through the ratio arm", () => {
    // Guards the null-ratio path: 0 → 0.3 must fail, because 0.3pp is under the
    // pp threshold and the ratio is undefined rather than infinite.
    expect(isVisible(series({ firstPct: 0, lastPct: 0.3 }), thresholds)).toBe(false);
  });
});

describe("cohort", () => {
  const asOf = at("2026-08-12T00:00:00Z");

  it("measures age in days from the release date", () => {
    expect(ageDays(at("2026-08-03T00:00:00Z"), asOf)).toBe(9);
  });

  it("has no age for a game with no known release date", () => {
    expect(ageDays(null, asOf)).toBeNull();
  });

  it("calls a game inside the window a launch-window title", () => {
    expect(cohortOf(9, 60)).toBe("launch");
  });

  it("treats the boundary day as still inside the window", () => {
    expect(cohortOf(60, 60)).toBe("launch");
    expect(cohortOf(60.5, 60)).toBe("mature");
  });

  it("calls a long-settled game mature", () => {
    expect(cohortOf(4038, 60)).toBe("mature");
  });

  it("keeps an unknown age out of both cohorts", () => {
    // The mature cohort answers "does a settled game drift", so an unenriched
    // new release landing in it would be the one error that flips the verdict.
    expect(cohortOf(null, 60)).toBe("unknown");
  });
});

describe("slope", () => {
  it("reports change per week over the observed span", () => {
    const s = series({
      firstPct: 1,
      lastPct: 2,
      firstAt: at("2026-08-01T00:00:00Z"),
      lastAt: at("2026-08-15T00:00:00Z"),
    });
    expect(spanDays(s)).toBe(14);
    expect(delta(s)).toBe(1);
    expect(perWeek(s)).toBeCloseTo(0.5, 6);
  });

  it("is zero when both observations land at the same instant", () => {
    const sameInstant = at("2026-08-01T00:00:00Z");
    expect(
      perWeek(series({ firstAt: sameInstant, lastAt: sameInstant, lastPct: 5 }))
    ).toBe(0);
  });
});
