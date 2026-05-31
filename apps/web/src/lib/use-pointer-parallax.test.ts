import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePointerParallax } from "./use-pointer-parallax";

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, "innerWidth", { value: 1000, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 1000, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

function tick(frames: number) {
  for (let i = 0; i < frames; i++) act(() => vi.advanceTimersByTime(16));
}

function move(clientX: number, clientY: number) {
  act(() => {
    window.dispatchEvent(new PointerEvent("pointermove", { clientX, clientY }));
  });
}

describe("usePointerParallax", () => {
  it("returns motion values starting at 0", () => {
    const { result } = renderHook(() => usePointerParallax());
    expect(result.current.x.get()).toBe(0);
    expect(result.current.y.get()).toBe(0);
  });

  it("damps toward the pointer target over successive frames", () => {
    const { result } = renderHook(() =>
      usePointerParallax({ damping: 0.5, maxOffset: 10 })
    );
    // Bottom-right corner → target = (+10, +10).
    move(1000, 1000);
    tick(1);
    // First frame moves halfway toward target with damping 0.5.
    expect(result.current.x.get()).toBeCloseTo(5, 5);
    expect(result.current.y.get()).toBeCloseTo(5, 5);
    tick(1);
    expect(result.current.x.get()).toBeCloseTo(7.5, 5);
    expect(result.current.y.get()).toBeCloseTo(7.5, 5);
  });

  it("scales target by maxOffset", () => {
    const { result } = renderHook(() =>
      usePointerParallax({ damping: 1, maxOffset: 20 })
    );
    move(1000, 500);
    tick(1);
    // Right edge → nx = +1 → target = +20. Damping 1 snaps in one frame.
    expect(result.current.x.get()).toBeCloseTo(20, 5);
    // Vertical centre → ny = 0 → target = 0.
    expect(result.current.y.get()).toBeCloseTo(0, 5);
  });

  it("resets target toward origin when the pointer leaves the window", () => {
    const { result } = renderHook(() =>
      usePointerParallax({ damping: 1, maxOffset: 10 })
    );
    move(1000, 1000);
    tick(1);
    expect(result.current.x.get()).toBeCloseTo(10, 5);
    act(() => {
      window.dispatchEvent(new Event("pointerleave"));
    });
    tick(1);
    expect(result.current.x.get()).toBeCloseTo(0, 5);
    expect(result.current.y.get()).toBeCloseTo(0, 5);
  });

  it("cancels rAF and removes listeners on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const cancelSpy = vi.spyOn(globalThis, "cancelAnimationFrame");
    const { unmount } = renderHook(() => usePointerParallax());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("pointerleave", expect.any(Function));
    expect(cancelSpy).toHaveBeenCalled();
  });
});
