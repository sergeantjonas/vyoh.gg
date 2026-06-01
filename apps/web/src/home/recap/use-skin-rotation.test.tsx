import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

import { useReducedMotion } from "motion/react";
import { FADE_HALF_MS, HOLD_MS, useSkinRotation } from "./use-skin-rotation";

const useReducedMotionMock = vi.mocked(useReducedMotion);

beforeEach(() => {
  vi.useFakeTimers();
  useReducedMotionMock.mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
  useReducedMotionMock.mockReset();
});

describe("useSkinRotation", () => {
  it("starts on activeIndex 0 with bloom blur at 0", () => {
    const { result } = renderHook(() => useSkinRotation(4));
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.bloomBlurPx.get()).toBe(0);
  });

  it("advances activeIndex at the midpoint of each crossfade", () => {
    const { result } = renderHook(() => useSkinRotation(4));
    // Hold elapses → enters phase 1 (blur ramping up), but index hasn't
    // changed yet.
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    expect(result.current.activeIndex).toBe(0);
    // Fade-half elapses → image swap at bloom peak.
    act(() => {
      vi.advanceTimersByTime(FADE_HALF_MS);
    });
    expect(result.current.activeIndex).toBe(1);
  });

  it("cycles modulo skinCount across multiple transitions", () => {
    const { result } = renderHook(() => useSkinRotation(3));
    const cyclesToWrap = 3;
    for (let i = 0; i < cyclesToWrap; i++) {
      act(() => {
        vi.advanceTimersByTime(HOLD_MS + FADE_HALF_MS);
      });
      // After each transition midpoint, advance through the back-ramp so the
      // cycle scheduler queues the next iteration.
      act(() => {
        vi.advanceTimersByTime(FADE_HALF_MS);
      });
    }
    // 3 wraps on a 3-skin rotation → back at the starting index.
    expect(result.current.activeIndex).toBe(0);
  });

  it("does not cycle when skinCount is 1 — no scheduler, no bloom", () => {
    const { result } = renderHook(() => useSkinRotation(1));
    act(() => {
      vi.advanceTimersByTime(HOLD_MS * 4);
    });
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.bloomBlurPx.get()).toBe(0);
  });

  it("pauses entirely under reduced motion — activeIndex stays at 0", () => {
    useReducedMotionMock.mockReturnValue(true);
    const { result } = renderHook(() => useSkinRotation(5));
    act(() => {
      vi.advanceTimersByTime(HOLD_MS * 3);
    });
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.bloomBlurPx.get()).toBe(0);
  });

  it("clears the pending timer + resets bloom on unmount", () => {
    const { result, unmount } = renderHook(() => useSkinRotation(3));
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    // Mid-transition: unmount and assert no further ticks happen.
    unmount();
    act(() => {
      vi.advanceTimersByTime(HOLD_MS * 4);
    });
    expect(result.current.bloomBlurPx.get()).toBe(0);
  });
});
