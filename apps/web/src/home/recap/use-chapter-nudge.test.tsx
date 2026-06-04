import { renderHook } from "@testing-library/react";
import { type RefObject, act, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChapterNudge } from "./use-chapter-nudge";

vi.mock("@/lib/scroll-container", () => ({
  mainScrollRef: { current: null },
}));

type Observer = {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  trigger: (entry: Partial<IntersectionObserverEntry>) => void;
};

const observers: Observer[] = [];

class FakeIntersectionObserver implements Observer {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = cb;
    this.options = options;
    observers.push(this);
  }
  trigger(entry: Partial<IntersectionObserverEntry>) {
    this.callback(
      [
        {
          isIntersecting: true,
          intersectionRatio: 0,
          ...entry,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver
    );
  }
}

function renderHookWithRef(triggerRatio?: number) {
  return renderHook(() => {
    const ref = useRef<HTMLElement | null>(null);
    // Attach a synthetic element so the observer has something to observe.
    if (ref.current === null) {
      const el = document.createElement("section");
      Object.defineProperty(ref, "current", {
        value: el,
        writable: true,
        configurable: true,
      });
    }
    const nudged = useChapterNudge(
      ref as RefObject<HTMLElement | null>,
      triggerRatio !== undefined ? { triggerRatio } : {}
    );
    return { nudged };
  });
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useChapterNudge", () => {
  it("starts in the un-nudged state", () => {
    const { result } = renderHookWithRef();
    expect(result.current.nudged).toBe(false);
  });

  it("does NOT fire when intersection is below the default threshold", () => {
    const { result } = renderHookWithRef();
    const io = observers[0];
    if (!io) throw new Error("IO not created");
    act(() => io.trigger({ isIntersecting: true, intersectionRatio: 0.3 }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.nudged).toBe(false);
  });

  it("flips nudged true after the settle window when intersection crosses the threshold", () => {
    const { result } = renderHookWithRef();
    const io = observers[0];
    if (!io) throw new Error("IO not created");
    act(() => io.trigger({ isIntersecting: true, intersectionRatio: 0.6 }));
    expect(result.current.nudged).toBe(false);
    // SETTLE_MS = 120 — tuned down from 500 for R-13 stacked-beat reveal
    // continuity. The boundary check still asserts the contract.
    act(() => {
      vi.advanceTimersByTime(119);
    });
    expect(result.current.nudged).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.nudged).toBe(true);
  });

  it("disconnects the observer after firing — one-shot", () => {
    renderHookWithRef();
    const io = observers[0];
    if (!io) throw new Error("IO not created");
    act(() => io.trigger({ isIntersecting: true, intersectionRatio: 0.6 }));
    expect(io.disconnect).toHaveBeenCalled();
  });

  it("respects a caller-supplied triggerRatio override", () => {
    const { result } = renderHookWithRef(0.2);
    const io = observers[0];
    if (!io) throw new Error("IO not created");
    act(() => io.trigger({ isIntersecting: true, intersectionRatio: 0.25 }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.nudged).toBe(true);
  });

  it("passes the trigger ratio as the IO threshold so the browser only delivers entries near it", () => {
    renderHookWithRef(0.5);
    const io = observers[0];
    if (!io) throw new Error("IO not created");
    expect(io.options?.threshold).toBe(0.5);
  });

  it("scales the threshold down for sections taller than the viewport (multi-beat)", () => {
    // Simulate a 2.4× viewport section (4-beat × 0.6 beat-viewports). The
    // viewport-relative triggerRatio (0.5 by default) must translate to an
    // observer threshold of 0.5 / 2.4 so the IO can actually deliver an
    // entry — the raw ratio caps at 1/2.4 throughout the pin window.
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    });
    HTMLElement.prototype.getBoundingClientRect = vi.fn(() => ({
      height: 1920,
      width: 1280,
      top: 0,
      left: 0,
      right: 1280,
      bottom: 1920,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })) as unknown as () => DOMRect;

    renderHookWithRef();
    const io = observers[0];
    if (!io) throw new Error("IO not created");
    expect(io.options?.threshold).toBeCloseTo(0.5 / 2.4, 4);

    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it("fires multi-beat nudge when intersection ratio crosses the scaled threshold", () => {
    // Same 2.4× section; the observer should fire when intersection ratio
    // reaches the scaled threshold (~0.21), which is the realistic max for
    // a 2.4× section.
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    });
    HTMLElement.prototype.getBoundingClientRect = vi.fn(() => ({
      height: 1920,
      width: 1280,
      top: 0,
      left: 0,
      right: 1280,
      bottom: 1920,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })) as unknown as () => DOMRect;

    const { result } = renderHookWithRef();
    const io = observers[0];
    if (!io) throw new Error("IO not created");
    act(() => io.trigger({ isIntersecting: true, intersectionRatio: 0.25 }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.nudged).toBe(true);

    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });
});
