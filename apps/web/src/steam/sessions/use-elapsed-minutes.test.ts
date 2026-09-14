import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useElapsedMinutes } from "./use-elapsed-minutes";

describe("useElapsedMinutes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T20:10:30.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads whole minutes since the start and steps on the elapsed-minute boundary", () => {
    const { result } = renderHook(() =>
      useElapsedMinutes("2026-09-15T19:00:00.000Z", null)
    );
    expect(result.current).toBe(70);
    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(result.current).toBe(70);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(71);
  });

  it("is zero with nothing to count from", () => {
    const { result } = renderHook(() => useElapsedMinutes(null, null));
    expect(result.current).toBe(0);
  });

  it("seeds the first render from the response timestamp, then follows the clock", () => {
    // The response is two minutes old, so the document says 68 and the
    // mounted client corrects to 70 on its first tick.
    const { result } = renderHook(() =>
      useElapsedMinutes("2026-09-15T19:00:00.000Z", "2026-09-15T20:08:30.000Z")
    );
    expect(result.current).toBe(70);
  });

  it("stops ticking on unmount", () => {
    const { result, unmount } = renderHook(() =>
      useElapsedMinutes("2026-09-15T20:00:00.000Z", null)
    );
    expect(result.current).toBe(10);
    unmount();
    expect(() => vi.advanceTimersByTime(5 * 60_000)).not.toThrow();
  });
});
