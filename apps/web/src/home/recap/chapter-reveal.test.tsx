import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

import { useReducedMotion } from "motion/react";
import { ChapterReveal } from "./chapter-reveal";

const useReducedMotionMock = vi.mocked(useReducedMotion);

beforeEach(() => {
  useReducedMotionMock.mockReturnValue(false);
});

afterEach(() => {
  useReducedMotionMock.mockReset();
});

describe("ChapterReveal", () => {
  it("renders an m.div wrapper with initial hidden state before viewport entry", () => {
    const { container } = render(
      <ChapterReveal>
        <span data-testid="content">hello</span>
      </ChapterReveal>
    );
    const wrapper = container.querySelector("[data-testid='content']")?.parentElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper?.tagName).toBe("DIV");
    // Initial state: opacity 0, translateY at the rise offset. motion sets
    // these inline via the `initial` prop.
    expect(wrapper?.style.opacity).toBe("0");
  });

  it("renders the end-state plainly under reduced motion (no inline opacity, no motion wrapper)", () => {
    useReducedMotionMock.mockReturnValue(true);
    const { container } = render(
      <ChapterReveal className="my-band">
        <span data-testid="content">hello</span>
      </ChapterReveal>
    );
    const wrapper = container.querySelector("[data-testid='content']")?.parentElement;
    expect(wrapper?.style.opacity).toBe("");
    expect(wrapper?.className).toContain("my-band");
  });

  it("forwards className to the motion wrapper", () => {
    const { container } = render(
      <ChapterReveal className="my-class">
        <span data-testid="content">hello</span>
      </ChapterReveal>
    );
    const wrapper = container.querySelector("[data-testid='content']")?.parentElement;
    expect(wrapper?.className).toContain("my-class");
  });

  it("accepts delay/duration/rise/active props without runtime errors", () => {
    expect(() =>
      render(
        <ChapterReveal delay={0.1} duration={1} rise={20} active={true}>
          <span>hello</span>
        </ChapterReveal>
      )
    ).not.toThrow();
  });

  it("holds at the hidden state when active=false", () => {
    const { container } = render(
      <ChapterReveal active={false}>
        <span data-testid="content">hello</span>
      </ChapterReveal>
    );
    const wrapper = container.querySelector("[data-testid='content']")?.parentElement;
    expect(wrapper?.style.opacity).toBe("0");
  });
});
