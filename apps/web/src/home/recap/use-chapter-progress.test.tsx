import { mainScrollRef } from "@/lib/scroll-container";
import { act, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chapterProgressFromRects, useChapterProgress } from "./use-chapter-progress";

describe("chapterProgressFromRects", () => {
  // Concrete pin shape: a 2× viewport chapter inside a 1000px container.
  // rectHeight = 2000, containerHeight = 1000, travel = 1000.
  const baseRect = { rectHeight: 2000, containerTop: 0, containerHeight: 1000 };

  it("returns 0 before the chapter enters the pin window", () => {
    expect(chapterProgressFromRects({ ...baseRect, rectTop: 1200 })).toBe(0);
    expect(chapterProgressFromRects({ ...baseRect, rectTop: 0 })).toBe(0);
  });

  it("ramps linearly 0 → 1 across the pin travel", () => {
    expect(chapterProgressFromRects({ ...baseRect, rectTop: -250 })).toBeCloseTo(0.25, 5);
    expect(chapterProgressFromRects({ ...baseRect, rectTop: -500 })).toBeCloseTo(0.5, 5);
    expect(chapterProgressFromRects({ ...baseRect, rectTop: -750 })).toBeCloseTo(0.75, 5);
  });

  it("clamps to 1 once the chapter has fully unpinned", () => {
    expect(chapterProgressFromRects({ ...baseRect, rectTop: -1000 })).toBe(1);
    expect(chapterProgressFromRects({ ...baseRect, rectTop: -2000 })).toBe(1);
  });

  it("respects a non-zero scroll-container offset within the viewport", () => {
    // Container starts 80px below the viewport top (e.g. a sticky header).
    // The chapter at rectTop = -420 has travelled (80 - -420) = 500 of its
    // 1000px window — half progress.
    expect(
      chapterProgressFromRects({
        rectTop: -420,
        rectHeight: 2000,
        containerTop: 80,
        containerHeight: 1000,
      })
    ).toBeCloseTo(0.5, 5);
  });

  it("returns 0 when the chapter is shorter than its scroll container", () => {
    // Degenerate "no pin window" shape — chapters this short shouldn't use
    // the hook in practice, but the formula must not divide by zero or flip
    // sign on the consumer.
    expect(
      chapterProgressFromRects({
        rectTop: -100,
        rectHeight: 800,
        containerTop: 0,
        containerHeight: 1000,
      })
    ).toBe(0);
  });
});

describe("useChapterProgress", () => {
  // Hook integration: register a fake scroll container, drive a scroll
  // event, verify the MotionValue updates from the rect math.
  beforeEach(() => {
    mainScrollRef.current = null;
  });

  afterEach(() => {
    mainScrollRef.current = null;
  });

  it("returns a MotionValue starting at 0 when the ref is unmounted", () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement | null>(null);
      return useChapterProgress(ref);
    });
    expect(result.current.get()).toBe(0);
  });

  it("updates progress on scroll events fired by the main scroll container", () => {
    // Hydrate the scroll container and a fake chapter element. The hook
    // reads getBoundingClientRect on each scroll tick; we drive a synthetic
    // rect to validate the wire-up without touching JSDOM scroll layout.
    const container = document.createElement("div");
    Object.defineProperty(container, "clientHeight", {
      value: 1000,
      configurable: true,
    });
    container.getBoundingClientRect = () =>
      ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }) as DOMRect;
    mainScrollRef.current = container;

    const el = document.createElement("section");
    let currentTop = 0;
    el.getBoundingClientRect = () =>
      ({
        top: currentTop,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 2000,
      }) as DOMRect;

    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement | null>(el);
      return useChapterProgress(ref);
    });
    // Initial apply at mount — chapter hasn't entered the pin yet.
    expect(result.current.get()).toBe(0);

    // Advance the synthetic rect to half-progress and fire a scroll tick.
    currentTop = -500;
    act(() => {
      container.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.get()).toBeCloseTo(0.5, 5);

    // Past the pin — clamp to 1.
    currentTop = -2000;
    act(() => {
      container.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.get()).toBe(1);
  });
});
