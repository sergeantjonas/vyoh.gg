import { render } from "@testing-library/react";
import { type MotionValue, useMotionValue } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

import { useReducedMotion } from "motion/react";
import { ChapterProgressContext } from "./chapter-context";
import { ChapterReveal } from "./chapter-reveal";

const useReducedMotionMock = vi.mocked(useReducedMotion);

function ProgressHarness({
  progress,
  children,
}: {
  progress: MotionValue<number>;
  children: React.ReactNode;
}) {
  return (
    <ChapterProgressContext.Provider value={progress}>
      {children}
    </ChapterProgressContext.Provider>
  );
}

beforeEach(() => {
  useReducedMotionMock.mockReturnValue(false);
});

afterEach(() => {
  useReducedMotionMock.mockReset();
});

describe("ChapterReveal", () => {
  it("hides content (opacity 0) before the reveal window starts", () => {
    function Probe() {
      const p = useMotionValue(0);
      return (
        <ProgressHarness progress={p}>
          <ChapterReveal from={0.2} to={0.4}>
            <span>hello</span>
          </ChapterReveal>
        </ProgressHarness>
      );
    }
    const { container } = render(<Probe />);
    const wrapper = container.querySelector("span")?.parentElement;
    expect(wrapper?.style.opacity).toBe("0");
  });

  it("shows content (opacity 1) when initial progress is past the reveal window", () => {
    function Probe() {
      const p = useMotionValue(0.5);
      return (
        <ProgressHarness progress={p}>
          <ChapterReveal from={0.2} to={0.4}>
            <span>hello</span>
          </ChapterReveal>
        </ProgressHarness>
      );
    }
    const { container } = render(<Probe />);
    const wrapper = container.querySelector("span")?.parentElement;
    expect(wrapper?.style.opacity).toBe("1");
  });

  it("ramps opacity proportionally at the reveal window midpoint", () => {
    function Probe() {
      const p = useMotionValue(0.5);
      return (
        <ProgressHarness progress={p}>
          <ChapterReveal from={0} to={1}>
            <span>hello</span>
          </ChapterReveal>
        </ProgressHarness>
      );
    }
    const { container } = render(<Probe />);
    const wrapper = container.querySelector("span")?.parentElement;
    expect(Number(wrapper?.style.opacity)).toBeCloseTo(0.5, 5);
  });

  it("renders the end-state plainly under reduced motion (no inline opacity/y)", () => {
    useReducedMotionMock.mockReturnValue(true);
    function Probe() {
      const p = useMotionValue(0);
      return (
        <ProgressHarness progress={p}>
          <ChapterReveal from={0.2} to={0.4}>
            <span data-testid="content">hello</span>
          </ChapterReveal>
        </ProgressHarness>
      );
    }
    const { container } = render(<Probe />);
    const wrapper = container.querySelector("[data-testid='content']")?.parentElement;
    // Under reduced motion the wrapper is a plain div without inline styles.
    expect(wrapper?.style.opacity).toBe("");
    expect(wrapper?.tagName).toBe("DIV");
  });

  it("falls back to end-state when used outside a ChapterContainer", () => {
    const { container } = render(
      <ChapterReveal from={0.2} to={0.4}>
        <span>hello</span>
      </ChapterReveal>
    );
    const wrapper = container.querySelector("span")?.parentElement;
    expect(wrapper?.style.opacity).toBe("1");
  });

  it("applies className to the wrapper", () => {
    const { container } = render(
      <ChapterReveal from={0} to={1} className="my-class">
        <span>hello</span>
      </ChapterReveal>
    );
    const wrapper = container.querySelector("span")?.parentElement;
    expect(wrapper?.className).toContain("my-class");
  });
});
