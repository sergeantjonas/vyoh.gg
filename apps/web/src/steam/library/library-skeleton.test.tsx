import { render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { LibrarySkeleton } from "./library-skeleton";

function renderWithMotion(ui: React.ReactNode) {
  return render(<MotionConfig reducedMotion="always">{ui}</MotionConfig>);
}

describe("LibrarySkeleton", () => {
  it("renders a grid of tile placeholders when layout is tiles", () => {
    const { container } = renderWithMotion(<LibrarySkeleton layout="tiles" />);
    expect(container.querySelectorAll("li").length).toBe(10);
    expect(container.querySelector("ul")?.className).toContain("grid");
  });

  it("renders a list of row placeholders when layout is rows", () => {
    const { container } = renderWithMotion(<LibrarySkeleton layout="rows" />);
    expect(container.querySelectorAll("li").length).toBe(8);
    expect(container.querySelector("ul")?.className).toContain("divide-y");
  });
});
