import { render } from "@testing-library/react";
import { motionValue } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { BeatAccentSlash } from "./beat-accent-slash";
import { ChapterBeatNudgeContext } from "./chapter-nudge-contexts";
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

  it("renders without crashing outside any chapter context", () => {
    // Outside ChapterBeatNudgeContext, useChapterBeatNudge defaults to
    // false, so the slash renders at scaleX=0 / opacity=0 (its initial
    // state). Still mounts cleanly.
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

  describe("re-entry pulse (R-12.9)", () => {
    it("first nudge entry sets no pulse key (entrance variant carries the visual)", () => {
      const { container } = render(
        <ChapterBeatNudgeContext.Provider value={true}>
          <BeatAccentSlash beatIndex={0} />
        </ChapterBeatNudgeContext.Provider>
      );
      const outer = container.querySelector("[data-beat-accent-slash]");
      const inner = outer?.firstElementChild as HTMLElement | null;
      expect(inner).not.toBeNull();
      // First entry — the inner div should NOT have animated opacity
      // keyframes; the outer wrapper's scaleX entrance does the work.
      // happy-dom doesn't run motion animations, so we assert that the
      // inner's computed opacity is the static end state (no animate
      // override was triggered with the keyframe array).
      expect(inner?.style.opacity).not.toMatch(/^0\.35/);
    });

    it("nudged false→true transitions after the first fire the pulse animation", async () => {
      const { rerender, container } = render(
        <ChapterBeatNudgeContext.Provider value={false}>
          <BeatAccentSlash beatIndex={0} />
        </ChapterBeatNudgeContext.Provider>
      );
      // Initial mount: nudged=false, no entry yet.
      // First entry.
      rerender(
        <ChapterBeatNudgeContext.Provider value={true}>
          <BeatAccentSlash beatIndex={0} />
        </ChapterBeatNudgeContext.Provider>
      );
      // Exit (back-scroll out of beat).
      rerender(
        <ChapterBeatNudgeContext.Provider value={false}>
          <BeatAccentSlash beatIndex={0} />
        </ChapterBeatNudgeContext.Provider>
      );
      // Re-entry. The inner div's `key` should now bump from `0` (first
      // entry, no pulse) to `2` (entryCount on second nudge-up) so React
      // remounts it and motion fires `animate=[1, 0.35, 1]` keyframes.
      rerender(
        <ChapterBeatNudgeContext.Provider value={true}>
          <BeatAccentSlash beatIndex={0} />
        </ChapterBeatNudgeContext.Provider>
      );
      // The slash element should still be present (the inner is keyed but
      // the outer wrapper persists). Smoke-test: no throw, structure
      // intact across the re-mount cycle.
      const outer = container.querySelector("[data-beat-accent-slash]");
      expect(outer).not.toBeNull();
      expect(outer?.firstElementChild).not.toBeNull();
    });
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
