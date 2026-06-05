import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
    useInView: vi.fn(() => true),
  };
});

import { useInView, useReducedMotion } from "motion/react";

import { MultiBeat } from "./multi-beat";

const mockedUseReducedMotion = vi.mocked(useReducedMotion);
const mockedUseInView = vi.mocked(useInView);

describe("MultiBeat", () => {
  beforeEach(() => {
    mockedUseReducedMotion.mockReturnValue(false);
    mockedUseInView.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders as a div with carousel slide ARIA", () => {
    const { container } = render(
      <MultiBeat index={1} beatCount={4}>
        <p>content</p>
      </MultiBeat>
    );
    const beat = container.querySelector("div[data-beat]");
    expect(beat).not.toBeNull();
    expect(beat?.getAttribute("role")).toBe("group");
    expect(beat?.getAttribute("aria-roledescription")).toBe("slide");
    expect(beat?.getAttribute("aria-label")).toBe("Beat 2 of 4");
    expect(beat?.getAttribute("data-beat")).toBe("1");
  });

  it("uses custom aria-label when provided", () => {
    const { container } = render(
      <MultiBeat index={0} beatCount={4} ariaLabel="Opening">
        <p>content</p>
      </MultiBeat>
    );
    expect(container.querySelector("div[data-beat]")?.getAttribute("aria-label")).toBe(
      "Opening"
    );
  });

  it("renders as a w-screen flex item under standard motion", () => {
    const { container } = render(
      <MultiBeat index={0} beatCount={2}>
        <p>content</p>
      </MultiBeat>
    );
    const beat = container.querySelector("div[data-beat]");
    expect(beat?.className).toContain("w-screen");
    expect(beat?.className).toContain("shrink-0");
    expect(beat?.className).toContain("h-full");
    // No scroll-snap classes — the horizontal track architecture doesn't
    // use native snap. (Previous design did, was reverted; see
    // multi-beat-chapter-arc.md for the audit trail.)
    expect(beat?.className).not.toContain("scroll-snap-align");
    expect(beat?.className).not.toContain("scroll-snap-stop");
  });

  it("collapses to a plain w-full block under reduced motion", () => {
    mockedUseReducedMotion.mockReturnValue(true);
    const { container } = render(
      <MultiBeat index={0} beatCount={2}>
        <p>content</p>
      </MultiBeat>
    );
    const beat = container.querySelector("div[data-beat]");
    expect(beat?.className).not.toContain("w-screen");
    expect(beat?.className).toContain("w-full");
  });

  it("invokes render-prop child with current nudge state", () => {
    const childFn = vi.fn(() => <p>fn child</p>);
    render(
      <MultiBeat index={0} beatCount={1}>
        {childFn}
      </MultiBeat>
    );
    expect(childFn).toHaveBeenCalled();
    expect(childFn).toHaveBeenLastCalledWith(true);
  });

  it("renders static children directly without invoking them", () => {
    const { getByText } = render(
      <MultiBeat index={0} beatCount={1}>
        <p>static</p>
      </MultiBeat>
    );
    expect(getByText("static")).toBeTruthy();
  });

  it("passes nudge=true immediately under reduced motion", () => {
    mockedUseReducedMotion.mockReturnValue(true);
    const childFn = vi.fn(() => <p>fn child</p>);
    render(
      <MultiBeat index={0} beatCount={1}>
        {childFn}
      </MultiBeat>
    );
    expect(childFn).toHaveBeenLastCalledWith(true);
  });

  it("flips nudge to false when useInView reports out-of-view", () => {
    mockedUseInView.mockReturnValue(false);
    const childFn = vi.fn(() => <p>fn child</p>);
    render(
      <MultiBeat index={0} beatCount={1}>
        {childFn}
      </MultiBeat>
    );
    // Initial nudge state is false (reducedMotion ?? false); useInView=false
    // keeps it false so child reveals don't fire on a non-visible beat.
    expect(childFn).toHaveBeenLastCalledWith(false);
  });
});
