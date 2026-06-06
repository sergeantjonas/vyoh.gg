import { render } from "@testing-library/react";
import { motionValue } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { BeatParallaxLayer } from "./beat-parallax";
import {
  ChapterMultiBeatContext,
  type ChapterMultiBeatContextValue,
} from "./use-beat-progress";

function wrap(value: ChapterMultiBeatContextValue) {
  return ({ children }: { children: ReactNode }) => (
    <ChapterMultiBeatContext.Provider value={value}>
      {children}
    </ChapterMultiBeatContext.Provider>
  );
}

describe("BeatParallaxLayer", () => {
  it("renders an m.div carrying the depth data attribute and children", () => {
    const Wrapper = wrap({
      scrollYProgress: motionValue(0.2),
      beatCount: 1,
      beatRanges: [{ enterStart: 0, dwellStart: 0.1, dwellEnd: 0.9, exitEnd: 1 }],
      reducedMotion: false,
    });
    const { container } = render(
      <Wrapper>
        <BeatParallaxLayer beatIndex={0} depth={2}>
          <span>fg</span>
        </BeatParallaxLayer>
      </Wrapper>
    );
    const layer = container.querySelector("[data-beat-parallax-depth]");
    expect(layer).not.toBeNull();
    expect(layer?.getAttribute("data-beat-parallax-depth")).toBe("2");
    expect(layer?.textContent).toBe("fg");
  });

  it("renders motionlessly outside a ChapterMultiBeat context", () => {
    // No provider → useBeatProgress short-circuits to static values, so
    // the layer renders without crashing and emits a stable structure.
    const { container } = render(
      <BeatParallaxLayer beatIndex={0} depth={1}>
        <span>bg</span>
      </BeatParallaxLayer>
    );
    expect(container.querySelector("[data-beat-parallax-depth]")?.textContent).toBe("bg");
  });

  it("accepts depth 1 (background) and 3 (foreground)", () => {
    // Smoke test — render both depths, verify they tag the data
    // attribute correctly. Numeric depth verification is the only
    // public observable here; the underlying transforms are exercised
    // in use-beat-progress.test.tsx.
    const Wrapper = wrap({
      scrollYProgress: motionValue(0.5),
      beatCount: 1,
      beatRanges: [{ enterStart: 0, dwellStart: 0.1, dwellEnd: 0.9, exitEnd: 1 }],
      reducedMotion: false,
    });
    const { container, rerender } = render(
      <Wrapper>
        <BeatParallaxLayer beatIndex={0} depth={1}>
          <span>bg</span>
        </BeatParallaxLayer>
      </Wrapper>
    );
    expect(container.querySelector("[data-beat-parallax-depth='1']")).not.toBeNull();
    rerender(
      <Wrapper>
        <BeatParallaxLayer beatIndex={0} depth={3}>
          <span>fg</span>
        </BeatParallaxLayer>
      </Wrapper>
    );
    expect(container.querySelector("[data-beat-parallax-depth='3']")).not.toBeNull();
  });
});
