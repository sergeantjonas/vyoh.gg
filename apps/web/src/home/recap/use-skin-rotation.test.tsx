import { act, renderHook } from "@testing-library/react";
import { type MotionValue, useMotionValue } from "motion/react";
import { describe, expect, it } from "vitest";
import {
  BLOOM_HALF_WINDOW,
  BLOOM_PEAK_PX,
  activeIndexAtProgress,
  bloomBlurAtProgress,
  useSkinRotation,
} from "./use-skin-rotation";

describe("activeIndexAtProgress", () => {
  it("returns 0 for any progress when there is at most one skin", () => {
    expect(activeIndexAtProgress(0, 1)).toBe(0);
    expect(activeIndexAtProgress(0.5, 1)).toBe(0);
    expect(activeIndexAtProgress(1, 1)).toBe(0);
    expect(activeIndexAtProgress(0.5, 0)).toBe(0);
  });

  it("steps through each segment for a multi-skin rotation", () => {
    // Four skins → breakpoints at 0.25, 0.5, 0.75.
    expect(activeIndexAtProgress(0, 4)).toBe(0);
    expect(activeIndexAtProgress(0.2, 4)).toBe(0);
    expect(activeIndexAtProgress(0.25, 4)).toBe(1);
    expect(activeIndexAtProgress(0.49, 4)).toBe(1);
    expect(activeIndexAtProgress(0.5, 4)).toBe(2);
    expect(activeIndexAtProgress(0.74, 4)).toBe(2);
    expect(activeIndexAtProgress(0.75, 4)).toBe(3);
    expect(activeIndexAtProgress(1, 4)).toBe(3);
  });

  it("clamps progress outside [0, 1] without exceeding the last index", () => {
    expect(activeIndexAtProgress(-0.2, 3)).toBe(0);
    expect(activeIndexAtProgress(1.5, 3)).toBe(2);
  });
});

describe("bloomBlurAtProgress", () => {
  it("returns 0 with a single skin — no rotation, no bloom", () => {
    expect(bloomBlurAtProgress(0, 1)).toBe(0);
    expect(bloomBlurAtProgress(0.5, 1)).toBe(0);
    expect(bloomBlurAtProgress(0.999, 1)).toBe(0);
  });

  it("returns 0 outside every bloom window", () => {
    // Four skins → breakpoints at 0.25, 0.5, 0.75 (half-window = 0.05).
    // 0.1 sits well outside all three; bloom should be flat 0.
    expect(bloomBlurAtProgress(0.1, 4)).toBe(0);
    expect(bloomBlurAtProgress(0.35, 4)).toBe(0);
    expect(bloomBlurAtProgress(0.9, 4)).toBe(0);
  });

  it("peaks exactly at each breakpoint", () => {
    expect(bloomBlurAtProgress(0.25, 4)).toBeCloseTo(BLOOM_PEAK_PX, 5);
    expect(bloomBlurAtProgress(0.5, 4)).toBeCloseTo(BLOOM_PEAK_PX, 5);
    expect(bloomBlurAtProgress(0.75, 4)).toBeCloseTo(BLOOM_PEAK_PX, 5);
  });

  it("falls linearly toward the window edges", () => {
    // Half-way through the window → half-peak.
    const half = bloomBlurAtProgress(0.25 + BLOOM_HALF_WINDOW / 2, 4);
    expect(half).toBeCloseTo(BLOOM_PEAK_PX / 2, 5);
  });

  it("symmetric around the breakpoint", () => {
    const before = bloomBlurAtProgress(0.5 - BLOOM_HALF_WINDOW / 2, 4);
    const after = bloomBlurAtProgress(0.5 + BLOOM_HALF_WINDOW / 2, 4);
    expect(before).toBeCloseTo(after, 5);
  });
});

describe("useSkinRotation", () => {
  it("starts with activeIndex 0 at progress 0", () => {
    const { result } = renderHook(() => {
      const progress = useMotionValue(0);
      return useSkinRotation(progress, 4);
    });
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.bloomBlurPx.get()).toBe(0);
  });

  it("updates activeIndex when progress crosses a breakpoint", () => {
    const progressMv: { current: MotionValue<number> | null } = { current: null };
    const { result } = renderHook(() => {
      const progress = useMotionValue(0);
      progressMv.current = progress;
      return useSkinRotation(progress, 4);
    });
    act(() => {
      progressMv.current?.set(0.3);
    });
    expect(result.current.activeIndex).toBe(1);
    act(() => {
      progressMv.current?.set(0.8);
    });
    expect(result.current.activeIndex).toBe(3);
  });

  it("publishes bloom blur as a MotionValue that tracks progress", () => {
    const progressMv: { current: MotionValue<number> | null } = { current: null };
    const { result } = renderHook(() => {
      const progress = useMotionValue(0);
      progressMv.current = progress;
      return useSkinRotation(progress, 4);
    });
    act(() => {
      progressMv.current?.set(0.25);
    });
    expect(result.current.bloomBlurPx.get()).toBeCloseTo(BLOOM_PEAK_PX, 5);
    act(() => {
      progressMv.current?.set(0.1);
    });
    expect(result.current.bloomBlurPx.get()).toBe(0);
  });

  it("returns activeIndex 0 with a single-skin rotation regardless of progress", () => {
    const progressMv: { current: MotionValue<number> | null } = { current: null };
    const { result } = renderHook(() => {
      const progress = useMotionValue(0);
      progressMv.current = progress;
      return useSkinRotation(progress, 1);
    });
    act(() => {
      progressMv.current?.set(0.7);
    });
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.bloomBlurPx.get()).toBe(0);
  });
});
