import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mainScrollRef } from "@/lib/scroll-container";
import { useMainHeight } from "@/lib/use-main-height";

// happy-dom doesn't implement ResizeObserver — stub it so the hook's effect can
// register and the test path runs to completion. We don't need to fire size
// changes here; the hook reads clientHeight on mount, which is what the
// production fallback relies on for first-paint correctness.
class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("useMainHeight", () => {
  let originalRO: typeof ResizeObserver | undefined;
  beforeEach(() => {
    originalRO = globalThis.ResizeObserver;
    (globalThis as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      StubResizeObserver as unknown as typeof ResizeObserver;
  });
  afterEach(() => {
    if (originalRO) {
      (globalThis as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
        originalRO;
    }
    mainScrollRef.current = null;
  });

  it("returns null when <main> has not mounted yet", () => {
    mainScrollRef.current = null;
    const { result } = renderHook(() => useMainHeight());
    expect(result.current).toBeNull();
  });

  it("returns the clientHeight of <main> once mounted", () => {
    const main = document.createElement("div");
    vi.spyOn(main, "clientHeight", "get").mockReturnValue(742);
    mainScrollRef.current = main;
    const { result } = renderHook(() => useMainHeight());
    expect(result.current).toBe(742);
  });

  it("disconnects its ResizeObserver on unmount", () => {
    const disconnect = vi.fn();
    class TrackingObserver {
      observe() {}
      unobserve() {}
      disconnect = disconnect;
    }
    (globalThis as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      TrackingObserver as unknown as typeof ResizeObserver;
    mainScrollRef.current = document.createElement("div");
    const { unmount } = renderHook(() => useMainHeight());
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
