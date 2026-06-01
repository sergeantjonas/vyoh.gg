import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

import { useReducedMotion } from "motion/react";
import { useRef } from "react";
import { useChapterRevealProgress } from "./use-chapter-reveal-progress";

const useReducedMotionMock = vi.mocked(useReducedMotion);

function harness() {
  return renderHook(() => {
    const ref = useRef<HTMLElement | null>(null);
    if (!ref.current) {
      ref.current = document.createElement("section");
    }
    return useChapterRevealProgress(ref);
  });
}

beforeEach(() => {
  useReducedMotionMock.mockReturnValue(false);
});

afterEach(() => {
  useReducedMotionMock.mockReset();
});

describe("useChapterRevealProgress", () => {
  it("initial progress is 0 — animation hasn't started yet", () => {
    const { result } = harness();
    expect(result.current.get()).toBe(0);
  });

  it("jumps straight to 1 under prefers-reduced-motion (no animation)", () => {
    useReducedMotionMock.mockReturnValue(true);
    const { result } = harness();
    expect(result.current.get()).toBe(1);
  });

  it("falls back to end-state when IntersectionObserver is unavailable", () => {
    // Pretend the env (older browser, older test runner) has no IO support.
    const original = (globalThis as { IntersectionObserver?: unknown })
      .IntersectionObserver;
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = undefined;
    try {
      const { result } = harness();
      expect(result.current.get()).toBe(1);
    } finally {
      (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = original;
    }
  });
});
