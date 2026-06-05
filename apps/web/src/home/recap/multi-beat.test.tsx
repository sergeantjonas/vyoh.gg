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

  it("renders as an article with carousel slide ARIA", () => {
    const { container } = render(
      <MultiBeat index={1} beatCount={4}>
        <p>content</p>
      </MultiBeat>
    );
    const article = container.querySelector("div[data-beat]");
    expect(article).not.toBeNull();
    expect(article?.getAttribute("role")).toBe("group");
    expect(article?.getAttribute("aria-roledescription")).toBe("slide");
    expect(article?.getAttribute("aria-label")).toBe("Beat 2 of 4");
    expect(article?.getAttribute("data-beat")).toBe("1");
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

  it("applies snap classes and masthead-aware height under standard motion", () => {
    const { container } = render(
      <MultiBeat index={0} beatCount={2}>
        <p>content</p>
      </MultiBeat>
    );
    const article = container.querySelector("div[data-beat]");
    expect(article?.className).toContain("[scroll-snap-align:start]");
    expect(article?.className).toContain("[scroll-snap-stop:always]");
    expect(article?.className).toContain("[scroll-margin-top:var(--masthead-h)]");
    expect(article?.className).toContain("h-[calc(100dvh-var(--masthead-h))]");
  });

  it("collapses to flow under reduced motion, dropping fixed height", () => {
    mockedUseReducedMotion.mockReturnValue(true);
    const { container } = render(
      <MultiBeat index={0} beatCount={2}>
        <p>content</p>
      </MultiBeat>
    );
    const article = container.querySelector("div[data-beat]");
    // Snap classes are absent in reduced motion (no fixed viewport pages).
    expect(article?.className).not.toContain("[scroll-snap-align:start]");
    expect(article?.className).not.toContain("h-[calc(100dvh-var(--masthead-h))]");
    expect(article?.className).toContain("relative w-full");
  });

  it("invokes render-prop child with current nudge state", () => {
    const childFn = vi.fn(() => <p>fn child</p>);
    render(
      <MultiBeat index={0} beatCount={1}>
        {childFn}
      </MultiBeat>
    );
    expect(childFn).toHaveBeenCalled();
    // useInView mocked to true → nudged becomes true via the entry effect.
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
    // Reduced-motion branch passes true straight through so child reveal
    // cascades render without animation but also without staying hidden.
    expect(childFn).toHaveBeenLastCalledWith(true);
  });
});
