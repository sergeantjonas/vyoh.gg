import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

vi.mock("./use-chapter-nudge", () => ({
  useChapterNudge: vi.fn(() => true),
}));

import { useReducedMotion } from "motion/react";

import { ChapterBeat } from "./chapter-beat";
import { useChapterNudge } from "./use-chapter-nudge";

const useReducedMotionMock = vi.mocked(useReducedMotion);
const useChapterNudgeMock = vi.mocked(useChapterNudge);

describe("ChapterBeat", () => {
  beforeEach(() => {
    useReducedMotionMock.mockReturnValue(false);
    useChapterNudgeMock.mockReturnValue(true);
  });

  afterEach(() => {
    useReducedMotionMock.mockReset();
    useChapterNudgeMock.mockReset();
  });

  it("renders a viewport-tall snap-aligned section with the index and snap classes", () => {
    const { container } = render(
      <ChapterBeat index={2} slug="steam-chips">
        <div data-testid="content">content</div>
      </ChapterBeat>
    );
    const section = container.querySelector(
      "section[data-beat='2']"
    ) as HTMLElement | null;
    expect(section).toBeTruthy();
    expect(section?.getAttribute("data-beat-slug")).toBe("steam-chips");
    // Section owns the snap + size classes; layout className lands on the
    // inner content wrapper so the exit transform can ride on top of it.
    expect(section?.className).toContain("h-dvh");
    expect(section?.className).toContain("[scroll-snap-align:start]");
    expect(section?.className).toContain("[scroll-snap-stop:always]");
    expect(section?.className).toContain("overflow-hidden");
  });

  it("applies the caller's layout className to the inner content wrapper, not the section", () => {
    const { container } = render(
      <ChapterBeat index={0} className="px-6 pt-[22vh]">
        <div data-testid="content">content</div>
      </ChapterBeat>
    );
    const section = container.querySelector("section");
    const inner = container.querySelector("[data-beat-content]") as HTMLElement | null;
    // Layout className must move onto the inner motion wrapper so the
    // exit transform applies to the laid-out content area.
    expect(section?.className).not.toContain("px-6");
    expect(inner?.className).toContain("px-6");
    expect(inner?.className).toContain("pt-[22vh]");
  });

  it("renders the inner motion wrapper with neutral exit state on mount (opacity 1, no blur)", () => {
    const { container } = render(
      <ChapterBeat index={0}>
        <div data-testid="content">content</div>
      </ChapterBeat>
    );
    const inner = container.querySelector("[data-beat-content]") as HTMLElement | null;
    // Exit is a focus shift, not a position shift. At progress=0 opacity
    // stays at 1 and filter resolves to blur(0px) — both the asserted
    // neutral state. Critically, there is NO transform: the beat content
    // does NOT move faster than the section's natural scroll, which is
    // what made the earlier translate-based exit read as "scroll harder".
    expect(inner?.style.opacity).toBe("1");
    expect(inner?.style.filter).toContain("blur(0px)");
    expect(inner?.style.transform ?? "").not.toContain("translateY");
  });

  it("threads the beat's nudge state into a render-prop child", () => {
    useChapterNudgeMock.mockReturnValue(false);
    const renderProp = vi.fn((nudged: boolean) => (
      <span data-testid="nudge">{nudged ? "yes" : "no"}</span>
    ));
    const { rerender, getByTestId } = render(
      <ChapterBeat index={1}>{renderProp}</ChapterBeat>
    );
    expect(getByTestId("nudge").textContent).toBe("no");

    useChapterNudgeMock.mockReturnValue(true);
    rerender(<ChapterBeat index={1}>{renderProp}</ChapterBeat>);
    expect(getByTestId("nudge").textContent).toBe("yes");
  });

  it("under reduced motion: drops h-dvh + snap classes and skips the motion wrapper", () => {
    useReducedMotionMock.mockReturnValue(true);
    const { container } = render(
      <ChapterBeat index={0} className="px-6 pt-[22vh]">
        <div data-testid="content">content</div>
      </ChapterBeat>
    );
    const section = container.querySelector("section");
    expect(section?.className).not.toContain("h-dvh");
    expect(section?.className).not.toContain("scroll-snap-align");
    // No motion wrapper — content lives in a plain div carrying the
    // layout className so flow scrolls naturally without a forced
    // viewport-sized page.
    expect(container.querySelector("[data-beat-content]")).toBeNull();
    const innerDiv = section?.querySelector(":scope > div") as HTMLElement | null;
    expect(innerDiv?.className).toContain("px-6");
  });

  it("forwards aria-label to the section landmark", () => {
    const { container } = render(
      <ChapterBeat index={0} ariaLabel="Verdict">
        <div />
      </ChapterBeat>
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("aria-label")).toBe("Verdict");
  });
});
