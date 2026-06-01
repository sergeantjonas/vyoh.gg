import { mainScrollRef } from "@/lib/scroll-container";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useChapterPinFade } from "./use-chapter-pin-fade";

type RectStub = {
  top: number;
  height: number;
};

function harness(rect: RectStub) {
  return renderHook(() => {
    const ref = useRef<HTMLElement | null>(null);
    if (!ref.current) {
      ref.current = {
        getBoundingClientRect: () =>
          ({
            top: rect.top,
            height: rect.height,
            bottom: rect.top + rect.height,
            left: 0,
            right: 0,
            width: 0,
            x: 0,
            y: rect.top,
            toJSON: () => ({}),
          }) as DOMRect,
      } as unknown as HTMLElement;
    }
    return useChapterPinFade(ref, 120);
  });
}

beforeEach(() => {
  const main = document.createElement("div");
  // Stub container rect: viewport-shaped at top of window.
  main.getBoundingClientRect = () =>
    ({
      top: 0,
      bottom: 800,
      height: 800,
      width: 1280,
      left: 0,
      right: 1280,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  Object.defineProperty(main, "clientHeight", { value: 800, configurable: true });
  mainScrollRef.current = main;
});

afterEach(() => {
  mainScrollRef.current = null;
});

describe("useChapterPinFade", () => {
  it("returns 0 when the chapter is well below the ramp window (pre-pin approach)", () => {
    const { result } = harness({ top: 600, height: 1600 });
    expect(result.current.get()).toBe(0);
  });

  it("returns 1 once the chapter has reached pin start (rect.top <= 0)", () => {
    const { result } = harness({ top: 0, height: 1600 });
    expect(result.current.get()).toBe(1);
  });

  it("stays at 1 throughout the pin (rect.top deeply negative)", () => {
    const { result } = harness({ top: -400, height: 1600 });
    expect(result.current.get()).toBe(1);
  });

  it("ramps linearly across the ramp window above pin start", () => {
    // 60px above pin start in a 120px ramp = halfway → 0.5
    const { result } = harness({ top: 60, height: 1600 });
    expect(result.current.get()).toBeCloseTo(0.5, 5);
  });

  it("stays at 1 after the chapter has unpinned (rect.top below pin-end)", () => {
    const { result } = harness({ top: -2000, height: 1600 });
    expect(result.current.get()).toBe(1);
  });
});
