import { render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { MatchCardSkeleton, MatchListSkeleton } from "./match-list-skeleton";

function renderWithMotion(ui: React.ReactNode) {
  return render(<MotionConfig reducedMotion="always">{ui}</MotionConfig>);
}

describe("MatchListSkeleton", () => {
  it("renders five list items reserving the row shape", () => {
    const { container } = renderWithMotion(<MatchListSkeleton />);
    expect(container.querySelectorAll("li").length).toBe(5);
  });

  it("renders a single card skeleton with shimmer blocks", () => {
    const { container } = renderWithMotion(<MatchCardSkeleton />);
    expect(container.querySelectorAll("div[class*='animate']").length).toBeGreaterThan(0);
  });
});
