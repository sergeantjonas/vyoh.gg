import { act, render } from "@testing-library/react";
import { configureAxe } from "jest-axe";
import { motionValue } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { EditorialChrome } from "./editorial-chrome";
import {
  ChapterMultiBeatContext,
  type ChapterMultiBeatContextValue,
} from "./use-beat-progress";

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function wrap(value: ChapterMultiBeatContextValue) {
  return ({ children }: { children: ReactNode }) => (
    <ChapterMultiBeatContext.Provider value={value}>
      {children}
    </ChapterMultiBeatContext.Provider>
  );
}

const FOUR_BEAT_RANGES = [
  { enterStart: 0, dwellStart: 0, dwellEnd: 0.14, exitEnd: 0.32 },
  { enterStart: 0.14, dwellStart: 0.32, dwellEnd: 0.41, exitEnd: 0.59 },
  { enterStart: 0.41, dwellStart: 0.59, dwellEnd: 0.68, exitEnd: 0.86 },
  { enterStart: 0.68, dwellStart: 0.86, dwellEnd: 1, exitEnd: 1 },
];

describe("EditorialChrome", () => {
  it("renders nothing outside a ChapterMultiBeatContext", () => {
    const { container } = render(<EditorialChrome />);
    expect(container.querySelector("[data-editorial-chrome]")).toBeNull();
  });

  it("renders nothing when beatCount is 0", () => {
    const Wrapper = wrap({
      scrollYProgress: motionValue(0),
      beatCount: 0,
      beatRanges: [],
      reducedMotion: false,
    });
    const { container } = render(
      <Wrapper>
        <EditorialChrome />
      </Wrapper>
    );
    expect(container.querySelector("[data-editorial-chrome]")).toBeNull();
  });

  it("renders the page marker + N dots when context is present", () => {
    const Wrapper = wrap({
      scrollYProgress: motionValue(0),
      beatCount: 4,
      beatRanges: FOUR_BEAT_RANGES,
      reducedMotion: false,
    });
    const { container } = render(
      <Wrapper>
        <EditorialChrome />
      </Wrapper>
    );
    const chrome = container.querySelector("[data-editorial-chrome]");
    expect(chrome).not.toBeNull();
    expect(chrome?.textContent).toContain("01");
    expect(chrome?.textContent).toContain("04");
    expect(container.querySelectorAll("li").length).toBe(4);
  });

  it("flips the active dot when scrollYProgress crosses enter midpoints", () => {
    const scrollYProgress = motionValue(0);
    const Wrapper = wrap({
      scrollYProgress,
      beatCount: 4,
      beatRanges: FOUR_BEAT_RANGES,
      reducedMotion: false,
    });
    const { container } = render(
      <Wrapper>
        <EditorialChrome />
      </Wrapper>
    );

    // At progress 0, beat 0 active.
    let active = container.querySelectorAll("li[data-active]");
    expect(active.length).toBe(1);
    expect(active[0]).toBe(container.querySelectorAll("li")[0]);

    // Halfway through beat 0 → beat 1 transition is at
    // (0.14 + 0.32) / 2 = 0.23. Past that, beat 1 should be active.
    act(() => {
      scrollYProgress.set(0.25);
    });
    active = container.querySelectorAll("li[data-active]");
    expect(active.length).toBe(1);
    expect(active[0]).toBe(container.querySelectorAll("li")[1]);

    // Last beat: enter midpoint = (0.68 + 0.86) / 2 = 0.77.
    act(() => {
      scrollYProgress.set(0.9);
    });
    active = container.querySelectorAll("li[data-active]");
    expect(active.length).toBe(1);
    expect(active[0]).toBe(container.querySelectorAll("li")[3]);
  });

  it("exposes the live beat number to assistive technology", () => {
    const scrollYProgress = motionValue(0.4); // past beat-1 enter midpoint
    const Wrapper = wrap({
      scrollYProgress,
      beatCount: 4,
      beatRanges: FOUR_BEAT_RANGES,
      reducedMotion: false,
    });
    const { container } = render(
      <Wrapper>
        <EditorialChrome />
      </Wrapper>
    );
    expect(container.querySelector(".sr-only")?.textContent).toBe("Beat 2 of 4");
  });

  it("passes axe", async () => {
    const Wrapper = wrap({
      scrollYProgress: motionValue(0),
      beatCount: 4,
      beatRanges: FOUR_BEAT_RANGES,
      reducedMotion: false,
    });
    const { container } = render(
      <Wrapper>
        <EditorialChrome />
      </Wrapper>
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
