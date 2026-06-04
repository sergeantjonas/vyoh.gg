import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

// Stub the nudge hook so tests don't need IntersectionObserver wiring; the
// exit-dissolve behavior is independent of the entrance-nudge state.
vi.mock("./use-chapter-nudge", () => ({
  useChapterNudge: vi.fn(() => false),
}));

// Mock the engine gate so the test can exercise both branches deterministically.
// happy-dom doesn't define `window.ViewTimeline`, so without this mock every
// test would land on the Motion fallback; we want explicit coverage of both.
// Uses a hoisted mutable ref + a getter on the mock so individual tests can
// flip the gate without re-importing the module.
const engineGateState = vi.hoisted(() => ({ hasViewTimeline: false }));

vi.mock("./has-view-timeline", () => ({
  get HAS_VIEW_TIMELINE() {
    return engineGateState.hasViewTimeline;
  },
}));

import { useReducedMotion } from "motion/react";
import { ChapterBeat } from "./chapter-beat";

const useReducedMotionMock = vi.mocked(useReducedMotion);

beforeEach(() => {
  useReducedMotionMock.mockReturnValue(false);
  engineGateState.hasViewTimeline = false;
});

afterEach(() => {
  useReducedMotionMock.mockReset();
});

describe("ChapterBeat", () => {
  it("renders an outer snap-aligned wrapper with the beat index, snap classes, and tall height", () => {
    const { container } = render(
      <ChapterBeat index={2} slug="ahri-stats">
        <span data-testid="content">hi</span>
      </ChapterBeat>
    );
    const section = container.querySelector("section");
    expect(section).toBeTruthy();
    expect(section?.getAttribute("data-beat")).toBe("2");
    expect(section?.getAttribute("data-beat-slug")).toBe("ahri-stats");
    expect(section?.className).toContain("[scroll-snap-align:start]");
    expect(section?.className).toContain("[scroll-snap-stop:always]");
    // Wrapper taller than viewport so inner sticky has runway to pin.
    expect(section?.className).toContain("h-[130dvh]");
  });

  it("renders a sticky inner motion <div> with the consumer-provided layout className", () => {
    const { container } = render(
      <ChapterBeat index={0} className="flex flex-col px-6">
        <span data-testid="content">x</span>
      </ChapterBeat>
    );
    const inner = container.querySelector("[data-testid='content']")?.parentElement;
    expect(inner).toBeTruthy();
    expect(inner?.tagName).toBe("DIV");
    expect(inner?.className).toContain("sticky");
    expect(inner?.className).toContain("top-0");
    expect(inner?.className).toContain("h-dvh");
    // Consumer-provided layout flows onto the inner sticky.
    expect(inner?.className).toContain("flex");
    expect(inner?.className).toContain("px-6");
    // No inline opacity/filter applied at mount — the fade animation runs
    // via Motion `animate()` after the scroll threshold is crossed, with
    // no pre-set initial style.
  });

  it("renders a plain identity <section> under reduced motion (no inner sticky, no tall wrapper)", () => {
    useReducedMotionMock.mockReturnValue(true);
    const { container } = render(
      <ChapterBeat index={1} className="flex flex-col">
        <span data-testid="content">hi</span>
      </ChapterBeat>
    );
    const section = container.querySelector("section");
    const content = container.querySelector("[data-testid='content']");
    // Body renders directly as a child of the section; no inner wrapper.
    expect(content?.parentElement).toBe(section);
    expect(section?.className).not.toContain("[scroll-snap-align:start]");
    expect(section?.className).not.toContain("h-[130dvh]");
  });

  it("invokes the render-prop child with the beat's nudge state", () => {
    const fn = vi.fn(() => <span data-testid="render-prop">via-fn</span>);
    const { getByTestId } = render(<ChapterBeat index={0}>{fn}</ChapterBeat>);
    expect(getByTestId("render-prop")).toBeTruthy();
    expect(fn).toHaveBeenCalledWith(false);
  });

  it("renders static children as-is when no render prop is passed", () => {
    const { getByTestId } = render(
      <ChapterBeat index={0}>
        <span data-testid="static">static</span>
      </ChapterBeat>
    );
    expect(getByTestId("static")).toBeTruthy();
  });

  it("opts into the CSS animation-timeline path via data attributes when ViewTimeline is available", () => {
    engineGateState.hasViewTimeline = true;
    const { container } = render(
      <ChapterBeat index={0} className="flex flex-col">
        <span data-testid="content">x</span>
      </ChapterBeat>
    );
    const section = container.querySelector("section");
    const inner = container.querySelector("[data-testid='content']")?.parentElement;
    // Wrapper carries the timeline-source attribute; inner carries the
    // consumer attribute. motion.css keys both off these.
    expect(section?.hasAttribute("data-beat-wrapper")).toBe(true);
    expect(inner?.hasAttribute("data-beat-inner")).toBe(true);
    expect(inner?.hasAttribute("data-css-timeline")).toBe(true);
    // No Motion inline style projection on the CSS-timeline path.
    expect(inner?.getAttribute("style") ?? "").toBe("");
    // Same layout geometry as the Motion branch.
    expect(section?.className).toContain("h-[130dvh]");
    expect(inner?.className).toContain("sticky");
    expect(inner?.className).toContain("flex");
  });

  it("does not emit CSS-timeline data attributes on the Motion fallback (Firefox)", () => {
    engineGateState.hasViewTimeline = false;
    const { container } = render(
      <ChapterBeat index={0}>
        <span data-testid="content">x</span>
      </ChapterBeat>
    );
    const section = container.querySelector("section");
    const inner = container.querySelector("[data-testid='content']")?.parentElement;
    expect(section?.hasAttribute("data-beat-wrapper")).toBe(false);
    expect(inner?.hasAttribute("data-beat-inner")).toBe(false);
    expect(inner?.hasAttribute("data-css-timeline")).toBe(false);
  });

  it("propagates ariaLabel to the outer wrapper section", () => {
    const { container } = render(
      <ChapterBeat index={0} ariaLabel="Ahri intro beat">
        <span>x</span>
      </ChapterBeat>
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("aria-label")).toBe("Ahri intro beat");
  });
});
