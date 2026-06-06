import { renderHook } from "@testing-library/react";
import { motionValue } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import {
  ChapterMultiBeatContext,
  type ChapterMultiBeatContextValue,
  computeBeatRanges,
  useBeatProgress,
} from "./use-beat-progress";

describe("computeBeatRanges", () => {
  it("returns [] for beatCount of 0", () => {
    expect(computeBeatRanges([], 0)).toEqual([]);
    expect(computeBeatRanges([0.1, 0.3], 0)).toEqual([]);
    expect(computeBeatRanges([], -1)).toEqual([]);
  });

  it("derives enter/dwell/exit ranges from piecewise stops", () => {
    // Two beats: dwell0 = [0.1, 0.3], dwell1 = [0.6, 0.9].
    // Beat 0: enterStart=0 (edge), dwell=[0.1, 0.3], exitEnd=0.6 (next dwell start).
    // Beat 1: enterStart=0.3 (prior dwell end), dwell=[0.6, 0.9], exitEnd=1 (edge).
    const ranges = computeBeatRanges([0.1, 0.3, 0.6, 0.9], 2);
    expect(ranges).toEqual([
      { enterStart: 0, dwellStart: 0.1, dwellEnd: 0.3, exitEnd: 0.6 },
      { enterStart: 0.3, dwellStart: 0.6, dwellEnd: 0.9, exitEnd: 1 },
    ]);
  });

  it("derives ranges for the canonical 4-beat shape", () => {
    // Mirrors ChapterMultiBeat's piecewise output for N=4 with default
    // EDGE_DWELL=3, DWELL=2, TRANSITION=4 (total 22 units).
    // dwell0 = [0, 3/22], transition 4/22 → dwell1 = [7/22, 9/22], ...
    const u = 1 / 22;
    const stops = [
      0,
      3 * u, // beat 0 dwell (edge)
      7 * u,
      9 * u, // beat 1 dwell (middle)
      13 * u,
      15 * u, // beat 2 dwell (middle)
      19 * u,
      22 * u, // beat 3 dwell (edge)
    ];
    const ranges = computeBeatRanges(stops, 4);
    expect(ranges).toHaveLength(4);
    expect(ranges[0]?.enterStart).toBe(0);
    expect(ranges[3]?.exitEnd).toBe(1);
    // Beat 1's enter starts at beat 0's dwell end.
    expect(ranges[1]?.enterStart).toBeCloseTo(3 * u);
    // Beat 2's exit ends at beat 3's dwell start.
    expect(ranges[2]?.exitEnd).toBeCloseTo(19 * u);
  });

  it("falls back to safe defaults when stops are missing", () => {
    // Truncated stops shouldn't crash — out-of-bounds reads default.
    const ranges = computeBeatRanges([0.1], 2);
    expect(ranges).toHaveLength(2);
    expect(ranges[0]?.dwellStart).toBe(0.1);
    expect(ranges[0]?.dwellEnd).toBe(1); // missing stops[1] → fallback 1
    expect(ranges[1]?.dwellStart).toBe(0); // missing stops[2] → fallback 0
  });
});

describe("useBeatProgress", () => {
  it("returns static dwell-state values outside a ChapterMultiBeat context", () => {
    const { result } = renderHook(() => useBeatProgress(0));
    // No provider → reducedMotion fallback path. Values land at the
    // "fully in dwell" end-state.
    expect(result.current.enterProgress.get()).toBe(1);
    expect(result.current.dwellProgress.get()).toBe(0.5);
    expect(result.current.exitProgress.get()).toBe(0);
    expect(result.current.combinedProgress.get()).toBe(0.5);
    expect(result.current.range).toEqual({
      enterStart: 0,
      dwellStart: 0,
      dwellEnd: 1,
      exitEnd: 1,
    });
  });

  // The scroll-coupling math is validated at three representative
  // chapter-progress positions. Each position spins up a fresh hook so
  // the assertion reads `useTransform`'s initial-computed value, which
  // is reliable in happy-dom. Mid-test `.set()` on the source isn't
  // used because derived MotionValue subscription timing doesn't always
  // propagate synchronously in the test environment (in production,
  // Motion's frame loop handles it).
  it.each([
    {
      label: "pre-dwell (progress 0)",
      progress: 0,
      enter: 0,
      dwell: 0,
      exit: 0,
    },
    {
      label: "mid-dwell of beat 0 (progress 0.2)",
      progress: 0.2,
      enter: 1,
      dwell: 0.5,
      exit: 0,
    },
    {
      label: "mid-exit of beat 0 (progress 0.45)",
      progress: 0.45,
      enter: 1,
      dwell: 1,
      exit: 0.5,
    },
  ])("returns scroll-coupled values: $label", ({ progress, enter, dwell, exit }) => {
    const value: ChapterMultiBeatContextValue = {
      scrollYProgress: motionValue(progress),
      beatCount: 2,
      beatRanges: [
        { enterStart: 0, dwellStart: 0.1, dwellEnd: 0.3, exitEnd: 0.6 },
        { enterStart: 0.3, dwellStart: 0.6, dwellEnd: 0.9, exitEnd: 1 },
      ],
      reducedMotion: false,
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ChapterMultiBeatContext.Provider value={value}>
        {children}
      </ChapterMultiBeatContext.Provider>
    );
    const { result } = renderHook(() => useBeatProgress(0), { wrapper });
    expect(result.current.enterProgress.get()).toBeCloseTo(enter);
    expect(result.current.dwellProgress.get()).toBeCloseTo(dwell);
    expect(result.current.exitProgress.get()).toBeCloseTo(exit);
  });

  it("short-circuits to dwell-state values under reducedMotion: true", () => {
    const scrollYProgress = motionValue(0.2);
    const value: ChapterMultiBeatContextValue = {
      scrollYProgress,
      beatCount: 1,
      beatRanges: [{ enterStart: 0, dwellStart: 0.1, dwellEnd: 0.9, exitEnd: 1 }],
      reducedMotion: true,
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ChapterMultiBeatContext.Provider value={value}>
        {children}
      </ChapterMultiBeatContext.Provider>
    );
    const { result } = renderHook(() => useBeatProgress(0), { wrapper });
    // reducedMotion bypasses scroll coupling — same static values as
    // outside-context.
    expect(result.current.enterProgress.get()).toBe(1);
    expect(result.current.dwellProgress.get()).toBe(0.5);
    expect(result.current.exitProgress.get()).toBe(0);
  });
});
