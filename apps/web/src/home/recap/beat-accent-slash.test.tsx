import { render } from "@testing-library/react";
import { motionValue } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { BeatAccentSlash } from "./beat-accent-slash";
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

describe("BeatAccentSlash", () => {
  it("renders the data-slash element with aria-hidden", () => {
    const { container } = render(<BeatAccentSlash beatIndex={0} />);
    const slash = container.querySelector("[data-beat-accent-slash]");
    expect(slash).not.toBeNull();
    expect(slash?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders inside the beat with no crash outside context", () => {
    // Outside ChapterMultiBeatContext, useBeatProgress short-circuits
    // to static values; the slash should still render at its rest
    // position without throwing.
    const { container } = render(<BeatAccentSlash beatIndex={0} />);
    expect(container.querySelector("[data-beat-accent-slash]")).not.toBeNull();
  });

  it("forwards className to the outer motion wrapper", () => {
    const { container } = render(
      <BeatAccentSlash beatIndex={0} className="my-decorator" />
    );
    expect(container.querySelector(".my-decorator")).not.toBeNull();
  });

  it("renders an inner skewed bar", () => {
    // The two-div split (outer for motion x/opacity, inner for static
    // skew) is load-bearing — Motion's translateX would otherwise
    // overwrite a sibling-level skew. Verify the inner div exists.
    const { container } = render(<BeatAccentSlash beatIndex={0} />);
    const outer = container.querySelector("[data-beat-accent-slash]");
    expect(outer?.firstElementChild).not.toBeNull();
  });

  it("renders inside a multi-beat context without throwing", () => {
    const Wrapper = wrap({
      scrollYProgress: motionValue(0.2),
      beatCount: 4,
      beatRanges: [
        { enterStart: 0, dwellStart: 0, dwellEnd: 0.14, exitEnd: 0.32 },
        { enterStart: 0.14, dwellStart: 0.32, dwellEnd: 0.41, exitEnd: 0.59 },
        { enterStart: 0.41, dwellStart: 0.59, dwellEnd: 0.68, exitEnd: 0.86 },
        { enterStart: 0.68, dwellStart: 0.86, dwellEnd: 1, exitEnd: 1 },
      ],
      reducedMotion: false,
    });
    const { container } = render(
      <Wrapper>
        <BeatAccentSlash beatIndex={1} from="right" />
      </Wrapper>
    );
    expect(container.querySelector("[data-beat-accent-slash]")).not.toBeNull();
  });
});
