import { describe, expect, it } from "vitest";
import type { SteamLaunchDriftStats } from "../home/recap-chapter.ts";
import {
  type LaunchDriftInput,
  deriveLaunchDrift,
  launchDriftBaseSignal,
  launchDriftDaysSince,
} from "./launch-drift.ts";

const RELEASE = new Date("2026-08-03T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

/** Days after release, so every fixture reads as a launch curve at a glance. */
function day(n: number): Date {
  return new Date(RELEASE.getTime() + n * DAY_MS);
}

/** The whole game is sampled on the same days, as the poller does. */
const OBSERVED_DAYS = [1, 4, 12, 28];

interface SeriesSpec {
  apiName: string;
  displayName: string;
  /** Global percentage at each entry of the observed days, ascending. */
  percents: number[];
  unlockDay: number;
}

function spec(
  apiName: string,
  percents: number[],
  unlockDay: number,
  displayName = `${apiName} label`
): SeriesSpec {
  return { apiName, displayName, percents, unlockDay };
}

function input(
  series: SeriesSpec[],
  observedDays: number[] = OBSERVED_DAYS
): LaunchDriftInput {
  return {
    releaseDate: RELEASE,
    observations: observedDays.flatMap((d, i) =>
      series.flatMap((s) => {
        const percent = s.percents[i];
        return percent === undefined
          ? []
          : [{ apiName: s.apiName, percent, observedAt: day(d) }];
      })
    ),
    unlocks: series.map((s) => ({
      apiName: s.apiName,
      displayName: s.displayName,
      unlockedAt: day(s.unlockDay),
      percentNow: s.percents.at(-1) ?? null,
    })),
  };
}

/**
 * Beast of Reincarnation, from the third probe reading — a day-one title whose
 * rare achievements climbed thirty points in four weeks. Munitions Master was
 * earned on day 13, after the crowd, so it qualifies on absolute movement but
 * ranks last.
 */
const BEAST: SeriesSpec[] = [
  spec("corvus_end", [0.7, 6.2, 18.9, 28.4], 2, "Corvus's End"),
  spec("bestie", [1.4, 8.1, 22.6, 34.3], 2, "Bestie"),
  spec("munitions_master", [0.1, 0.9, 3.4, 5.7], 13, "Munitions Master"),
];

/** Ratio 20, absolute 19.0pp — a plain qualifying row. */
const RISING = [1.0, 5.0, 12.0, 20.0];

/** For the fixtures that must qualify — a null here means the fixture is wrong. */
function derived(series: SeriesSpec[]): SteamLaunchDriftStats {
  const stats = deriveLaunchDrift(input(series));
  if (!stats) throw new Error("fixture produced no launch drift");
  return stats;
}

describe("deriveLaunchDrift", () => {
  it("returns null with no observations", () => {
    expect(deriveLaunchDrift(input(BEAST, []))).toBeNull();
  });

  it("returns null when every unlock predates the first observation", () => {
    const early = BEAST.map((s) => ({ ...s, unlockDay: 0 }));
    expect(deriveLaunchDrift(input(early))).toBeNull();
  });

  it("discards an unlock whose nearest earlier sample is 4 days old and keeps one at 2 days", () => {
    const result = deriveLaunchDrift(
      input([
        spec("a", RISING, 6),
        spec("b", RISING, 6),
        spec("c", RISING, 6),
        spec("stale", RISING, 8),
      ])
    );
    expect(result?.receipt.map((r) => r.apiName).sort()).toEqual(["a", "b", "c"]);
    expect(result?.bracketedUnlockCount).toBe(3);
  });

  it("discards a row with a +0.9pp delta and keeps +1.0pp", () => {
    const result = deriveLaunchDrift(
      input([
        // 4.1 − 3.1 is 0.9999999999999996 in raw floats, so this row only
        // survives because the threshold test runs at Steam's own precision.
        spec("a", [3.1, 3.5, 3.8, 4.1], 2),
        spec("b", [2.0, 2.4, 2.7, 3.0], 2),
        spec("c", [3.0, 3.4, 3.7, 4.0], 2),
        spec("shy", [1.0, 1.4, 1.7, 1.9], 2),
      ])
    );
    expect(result?.receipt.map((r) => r.apiName).sort()).toEqual(["a", "b", "c"]);
  });

  it("returns null with two qualifying rows and stats with three", () => {
    expect(deriveLaunchDrift(input(BEAST.slice(0, 2)))).toBeNull();
    expect(deriveLaunchDrift(input(BEAST))).not.toBeNull();
  });

  it("ranks by relative gain, with a reported 0 treated as the resolution floor", () => {
    // 0 → 5.0 is ratio 100 against the 0.05 floor denominator, 2.0 → 20.0 is
    // ratio 10, and 10.0 → 40.0 is only ratio 4 despite the largest absolute
    // move. Steam's literal 0 means "below one decimal", not "nobody had it".
    const result = deriveLaunchDrift(
      input([
        spec("floor", [0, 1.0, 3.0, 5.0], 2),
        spec("mid", [2.0, 8.0, 15.0, 20.0], 2),
        spec("big", [10.0, 20.0, 30.0, 40.0], 2),
      ])
    );
    expect(result?.receipt.map((r) => r.apiName)).toEqual(["floor", "mid", "big"]);
  });

  it("breaks a ratio tie by absolute delta", () => {
    const result = deriveLaunchDrift(
      input([
        spec("small", [1.0, 2.0, 3.0, 4.0], 2),
        spec("large", [10.0, 20.0, 30.0, 40.0], 2),
        spec("weaker", [10.0, 13.0, 16.0, 20.0], 2),
      ])
    );
    expect(result?.receipt.map((r) => r.apiName)).toEqual(["large", "small", "weaker"]);
  });

  it("caps the receipt at 5 and sets headline to the first row", () => {
    const seven = Array.from({ length: 7 }, (_, i) => spec(`a${i}`, RISING, 2));
    const result = deriveLaunchDrift(input(seven));
    expect(result?.receipt).toHaveLength(5);
    expect(result?.bracketedUnlockCount).toBe(7);
    expect(result?.headline).toBe(result?.receipt[0]);
  });

  it("carries the headline's own series as the curve, past the unlock", () => {
    const result = deriveLaunchDrift(input(BEAST));
    expect(result?.headline.displayName).toBe("Corvus's End");
    expect(result?.curve).toEqual([0.7, 6.2, 18.9, 28.4]);
  });

  it("counts distinct observation timestamps, not history rows", () => {
    const result = deriveLaunchDrift(input(BEAST));
    expect(result?.observationCount).toBe(4);
    expect(result?.observedFrom).toBe(day(1).toISOString());
    expect(result?.observedTo).toBe(day(28).toISOString());
    expect(result?.releaseDate).toBe("2026-08-03");
  });

  it("reports the rarity Steam sent at the unlock, not the first ever reading", () => {
    const result = deriveLaunchDrift(input(BEAST));
    const munitions = result?.receipt.find((r) => r.apiName === "munitions_master");
    expect(munitions?.percentAtUnlock).toBe(3.4);
    expect(munitions?.percentNow).toBe(5.7);
  });

  it("skips an unlock whose achievement has no current rarity row", () => {
    const base = input(BEAST);
    const result = deriveLaunchDrift({
      ...base,
      unlocks: base.unlocks.map((u, i) => (i === 0 ? { ...u, percentNow: null } : u)),
    });
    expect(result).toBeNull();
  });
});

describe("launchDriftBaseSignal", () => {
  it("caps at the delta cap for a runaway launch curve", () => {
    const stats = derived([
      spec("headline", [0.1, 12.0, 25.0, 37.0], 2),
      spec("b", RISING, 2),
      spec("c", RISING, 2),
    ]);
    expect(stats.headline.percentNow).toBe(37.0);
    expect(launchDriftBaseSignal(stats)).toBe(15);
  });

  it("scales a bare 1.0pp move to half a point", () => {
    const stats = derived([
      spec("a", [1.0, 1.4, 1.7, 2.0], 2),
      spec("b", [1.0, 1.4, 1.7, 2.0], 2),
      spec("c", [1.0, 1.4, 1.7, 2.0], 2),
    ]);
    expect(launchDriftBaseSignal(stats)).toBe(0.5);
  });
});

describe("launchDriftDaysSince", () => {
  it("measures from the freshest unlock in the receipt", () => {
    expect(launchDriftDaysSince(derived(BEAST), day(28))).toBe(15);
  });

  it("clamps to 0 when the newest unlock is in the future", () => {
    expect(launchDriftDaysSince(derived(BEAST), day(0))).toBe(0);
  });
});
